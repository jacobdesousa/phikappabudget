const { pool } = require("../db/pool");
const { legacyAdjustmentSchema } = require("../validation/roomDraw");
const { idParamSchema } = require("../validation/common");

const OFFICE_WEIGHTS = {
  past: {
    alpha: 3, beta: 3, pi: 3, sigma: 3, tau: 3,
    iota: 2, psi: 2, gamma: 2, theta: 2, chi: 2, zeta: 2,
    omega: 1, upsilon: 1, rho: 1, phi: 1,
  },
  incoming: {
    alpha: 6, beta: 6, pi: 6, sigma: 6, tau: 6,
    iota: 4, psi: 4, gamma: 4, theta: 4, chi: 4, zeta: 4,
    omega: 2, upsilon: 2, rho: 2, phi: 2,
  },
};

const EXEC_OFFICES = new Set(["alpha", "beta", "pi"]);

function pledgeClassDate(pledge_class) {
  if (!pledge_class) return null;
  const m = String(pledge_class).match(/^(Fall|Spring)\s+(\d{4})$/);
  if (!m) return null;
  const year = parseInt(m[2], 10);
  const month = m[1] === "Fall" ? 8 : 0; // 0-indexed: 8=Sep, 0=Jan
  return new Date(year, month, 1);
}

// Returns all Fall/Spring semesters overlapping [start, end].
// Fall: Sep 1 – Dec 31, Spring: Jan 1 – Apr 30
function getSemestersInRange(start, end) {
  const sems = [];
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  for (let y = startYear; y <= endYear; y++) {
    const sprStart = new Date(y, 0, 1);
    const sprEnd = new Date(y, 3, 30);
    if (sprStart <= end && sprEnd >= start) sems.push({ year: y, term: "Spring" });

    const fallStart = new Date(y, 8, 1);
    const fallEnd = new Date(y, 11, 31);
    if (fallStart <= end && fallEnd >= start) sems.push({ year: y, term: "Fall" });
  }
  return sems;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function getStandings(req, res) {
  const today = new Date();
  const currentYear = today.getFullYear();

  const { rows: brothers } = await pool.query(
    `SELECT id, first_name, last_name, pledge_class, graduation, status
     FROM brothers WHERE status IN ('Active', 'Alumnus')
     ORDER BY first_name, last_name`
  );

  if (brothers.length === 0) return res.json([]);

  const brotherIds = brothers.map((b) => b.id);

  const [tenuresRes, missingMeetingsRes, missingWorkdaysRes, legacyRes] = await Promise.all([
    pool.query(
      `SELECT brother_id, office_key, start_date::date AS start_date, end_date::date AS end_date
       FROM brother_offices WHERE brother_id = ANY($1)`,
      [brotherIds]
    ),
    pool.query(
      `SELECT ma.brother_id, mm.meeting_date::date AS event_date
       FROM meeting_attendance ma
       JOIN meeting_minutes mm ON mm.id = ma.meeting_id
       WHERE ma.status = 'Missing' AND ma.brother_id = ANY($1)`,
      [brotherIds]
    ),
    pool.query(
      `SELECT wa.brother_id, w.workday_date::date AS event_date
       FROM workday_attendance wa
       JOIN workdays w ON w.id = wa.workday_id
       WHERE wa.status = 'Missing' AND wa.brother_id = ANY($1)`,
      [brotherIds]
    ),
    pool.query(
      `SELECT brother_id, SUM(points)::float AS total_points
       FROM room_draw_legacy_points WHERE brother_id = ANY($1)
       GROUP BY brother_id`,
      [brotherIds]
    ),
  ]);

  // Group by brother_id
  const tenuresByBrother = {};
  for (const t of tenuresRes.rows) {
    (tenuresByBrother[t.brother_id] ??= []).push(t);
  }

  const missingMeetingsByBrother = {};
  for (const r of missingMeetingsRes.rows) {
    (missingMeetingsByBrother[r.brother_id] ??= []).push(new Date(r.event_date));
  }

  const missingWorkdaysByBrother = {};
  for (const r of missingWorkdaysRes.rows) {
    (missingWorkdaysByBrother[r.brother_id] ??= []).push(new Date(r.event_date));
  }

  const legacyByBrother = {};
  for (const r of legacyRes.rows) {
    legacyByBrother[r.brother_id] = r.total_points ?? 0;
  }

  const standings = brothers.map((b) => {
    const accumStart = pledgeClassDate(b.pledge_class);

    const base = {
      brother_id: b.id,
      first_name: b.first_name,
      last_name: b.last_name,
      over_graduation: !!(b.graduation && b.graduation < currentYear && b.status === "Active"),
      bypasses_ranking: false,
      accumulation_end: null,
      points_stripped: false,
    };

    if (!accumStart) {
      return { ...base, total: 0, breakdown: emptyBreakdown() };
    }

    const accumEnd = new Date(accumStart);
    accumEnd.setFullYear(accumEnd.getFullYear() + 4);

    const strippedAfter = new Date(accumEnd);
    strippedAfter.setFullYear(strippedAfter.getFullYear() + 1);

    const accEndStr = accumEnd.toISOString().slice(0, 10);

    if (today >= strippedAfter) {
      return { ...base, total: 0, breakdown: emptyBreakdown(), accumulation_end: accEndStr, points_stripped: true };
    }

    const effectiveEnd = today < accumEnd ? today : accumEnd;
    const bTenures = tenuresByBrother[b.id] ?? [];

    const pastBrother = getSemestersInRange(accumStart, effectiveEnd).length;

    let pastOffice = 0;
    let incoming = 0;
    let bypassesRanking = false;

    for (const t of bTenures) {
      const tenureStart = new Date(t.start_date);
      const tenureEnd = t.end_date ? new Date(t.end_date) : today;

      // Check if currently alpha/beta/pi
      if (EXEC_OFFICES.has(t.office_key) && tenureStart <= today && tenureEnd >= today) {
        bypassesRanking = true;
      }

      const pastWeight = OFFICE_WEIGHTS.past[t.office_key];
      const incomingWeight = OFFICE_WEIGHTS.incoming[t.office_key];
      if (!pastWeight && !incomingWeight) continue;

      if (pastWeight) {
        const overlapStart = tenureStart > accumStart ? tenureStart : accumStart;
        const overlapEnd = tenureEnd < effectiveEnd ? tenureEnd : effectiveEnd;
        if (overlapStart <= overlapEnd) {
          pastOffice += getSemestersInRange(overlapStart, overlapEnd).length * pastWeight;
        }
      }

      if (incomingWeight && tenureStart >= accumStart && tenureStart <= effectiveEnd) {
        incoming += incomingWeight;
      }
    }

    const missedMeetings = (missingMeetingsByBrother[b.id] ?? []).filter(
      (d) => d >= accumStart && d <= effectiveEnd
    ).length;
    const missedWorkdays = (missingWorkdaysByBrother[b.id] ?? []).filter(
      (d) => d >= accumStart && d <= effectiveEnd
    ).length;

    const meetingDeductions = round2(-0.15 * missedMeetings);
    const workdayDeductions = round2(-0.15 * missedWorkdays);
    const legacyPts = legacyByBrother[b.id] ?? 0;

    const total = round2(pastBrother + pastOffice + incoming + meetingDeductions + workdayDeductions + legacyPts);

    return {
      ...base,
      total,
      breakdown: { past_brother: pastBrother, past_office: pastOffice, incoming, meeting_deductions: meetingDeductions, workday_deductions: workdayDeductions, legacy: legacyPts },
      bypasses_ranking: bypassesRanking,
      accumulation_end: accEndStr,
    };
  });

  standings.sort((a, b) => {
    if (a.bypasses_ranking !== b.bypasses_ranking) return a.bypasses_ranking ? -1 : 1;
    if (a.over_graduation !== b.over_graduation) return a.over_graduation ? 1 : -1;
    return b.total - a.total;
  });

  res.json(standings);
}

function emptyBreakdown() {
  return { past_brother: 0, past_office: 0, incoming: 0, meeting_deductions: 0, workday_deductions: 0, legacy: 0 };
}

async function getLegacyAdjustments(req, res) {
  const { rows } = await pool.query(
    `SELECT rdlp.id, rdlp.brother_id, b.first_name, b.last_name,
            rdlp.points, rdlp.reason, rdlp.created_at
     FROM room_draw_legacy_points rdlp
     JOIN brothers b ON b.id = rdlp.brother_id
     ORDER BY b.first_name, b.last_name, rdlp.created_at`
  );
  res.json(rows);
}

async function addLegacyAdjustment(req, res) {
  const payload = legacyAdjustmentSchema.parse(req.body);
  const { rows } = await pool.query(
    `INSERT INTO room_draw_legacy_points (brother_id, points, reason, added_by_user_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [payload.brother_id, payload.points, payload.reason, req.auth.userId]
  );
  res.status(201).json(rows[0]);
}

async function deleteLegacyAdjustment(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const { rowCount } = await pool.query(
    `DELETE FROM room_draw_legacy_points WHERE id = $1`,
    [id]
  );
  if (!rowCount) return res.status(404).json({ error: { message: "Adjustment not found" } });
  res.status(204).send();
}

module.exports = { getStandings, getLegacyAdjustments, addLegacyAdjustment, deleteLegacyAdjustment };
