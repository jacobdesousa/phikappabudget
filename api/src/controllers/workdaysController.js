const { pool } = require("../db/pool");
const { idParamSchema } = require("../validation/common");
const { workdayUpsertSchema } = require("../validation/workdays");
const { schoolYearStartForDate } = require("../utils/schoolYear");
const { roundMoney } = require("../utils/money");

function monthForDate(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function chooseActiveEarningRate(row, rates) {
  // Precedence:
  // coveralls+nametag > coveralls > late > present
  if ((row.coveralls ?? false) && (row.nametag ?? false)) return rates.active_coveralls_nametag_rate;
  if (row.coveralls ?? false) return rates.active_coveralls_rate;
  if (row.status === "Late") return rates.active_late_rate;
  return rates.active_present_rate;
}

function choosePledgeEarningRate(row, rates) {
  if (row.status === "Late") return rates.pledge_late_rate;
  return rates.pledge_present_rate;
}

async function getWorkdayPayload(db, workdayId) {
  const wdRes = await db.query(
    `
      SELECT id, workday_date, bonus_month, title, school_year, created_at, updated_at
      FROM workdays
      WHERE id = $1
    `,
    [workdayId]
  );
  const workday = wdRes.rows[0];
  if (!workday) return null;

  const attendanceRes = await db.query(
    `
      SELECT
        a.id,
        a.workday_id,
        a.brother_id,
        a.status,
        a.coveralls,
        a.nametag,
        a.makeup_completed_at,
        COALESCE(a.member_first_name, b.first_name) AS first_name,
        COALESCE(a.member_last_name, b.last_name) AS last_name,
        COALESCE(a.brother_status_at_workday, b.status) AS brother_status_at_workday
      FROM workday_attendance a
      LEFT JOIN brothers b ON b.id = a.brother_id
      WHERE a.workday_id = $1
      ORDER BY COALESCE(a.member_last_name, b.last_name) ASC NULLS LAST,
               COALESCE(a.member_first_name, b.first_name) ASC NULLS LAST,
               a.id ASC
    `,
    [workdayId]
  );

  const month = workday.bonus_month ?? monthForDate(workday.workday_date);
  const ratesRes = await db.query(
    `
      SELECT
        active_present_rate,
        active_late_rate,
        active_coveralls_rate,
        active_coveralls_nametag_rate,
        pledge_present_rate,
        pledge_late_rate
      FROM chapter_bonus_workday_rates
      WHERE month = $1
    `,
    [month]
  );
  const raw = ratesRes.rows[0] ?? {};
  const rates = {
    active_present_rate: roundMoney(Number(raw.active_present_rate ?? 0)),
    active_late_rate: roundMoney(Number(raw.active_late_rate ?? 0)),
    active_coveralls_rate: roundMoney(Number(raw.active_coveralls_rate ?? 0)),
    active_coveralls_nametag_rate: roundMoney(Number(raw.active_coveralls_nametag_rate ?? 0)),
    pledge_present_rate: roundMoney(Number(raw.pledge_present_rate ?? 0)),
    pledge_late_rate: roundMoney(Number(raw.pledge_late_rate ?? 0)),
  };

  const attended = attendanceRes.rows.filter((r) => r.status === "Present" || r.status === "Late");
  const activeRows = attended.filter((r) => (r.brother_status_at_workday ?? "Active") !== "Pledge");
  const pledgeRows = attended.filter((r) => (r.brother_status_at_workday ?? "Active") === "Pledge");

  const active_present_count = activeRows.filter((r) => r.status === "Present" && !(r.coveralls ?? false)).length;
  const active_late_count = activeRows.filter((r) => r.status === "Late" && !(r.coveralls ?? false)).length;
  const active_coveralls_count = activeRows.filter((r) => (r.coveralls ?? false) && !(r.nametag ?? false)).length;
  const active_coveralls_nametag_count = activeRows.filter((r) => (r.coveralls ?? false) && (r.nametag ?? false)).length;
  const pledge_present_count = pledgeRows.filter((r) => r.status === "Present").length;
  const pledge_late_count = pledgeRows.filter((r) => r.status === "Late").length;

  const earnings_total = roundMoney(
    activeRows.reduce((sum, r) => sum + chooseActiveEarningRate(r, rates), 0) +
      pledgeRows.reduce((sum, r) => sum + choosePledgeEarningRate(r, rates), 0)
  );

  const summary = {
    attended_counts: {
      active_present: active_present_count,
      active_late: active_late_count,
      active_coveralls: active_coveralls_count,
      active_coveralls_nametag: active_coveralls_nametag_count,
      pledge_present: pledge_present_count,
      pledge_late: pledge_late_count,
      total:
        active_present_count +
        active_late_count +
        active_coveralls_count +
        active_coveralls_nametag_count +
        pledge_present_count +
        pledge_late_count,
    },
    earnings_total,
  };

  return { ...workday, attendance: attendanceRes.rows, summary };
}

async function listWorkdays(req, res) {
  const bonusMonth = req.query.bonus_month ? String(req.query.bonus_month) : null;
  const includeSummary = String(req.query.include_summary ?? "") === "1";

  const params = [];
  let where = "";
  if (bonusMonth) {
    params.push(bonusMonth);
    where = "WHERE w.bonus_month = $1";
  }

  if (!includeSummary) {
    const { rows } = await pool.query(
      `
        SELECT w.id, w.workday_date, w.bonus_month, w.title, w.school_year, w.created_at, w.updated_at
        FROM workdays w
        ${where}
        ORDER BY w.workday_date DESC, w.id DESC
      `,
      params
    );
    return res.status(200).json(rows);
  }

  const aggRes = await pool.query(
    `
      SELECT
        w.id,
        w.workday_date,
        w.bonus_month,
        COUNT(*) FILTER (WHERE a.status IN ('Present','Late') AND COALESCE(a.brother_status_at_workday,'Active') <> 'Pledge' AND a.status='Present' AND NOT COALESCE(a.coveralls,false)) AS active_present_count,
        COUNT(*) FILTER (WHERE a.status IN ('Present','Late') AND COALESCE(a.brother_status_at_workday,'Active') <> 'Pledge' AND a.status='Late' AND NOT COALESCE(a.coveralls,false)) AS active_late_count,
        COUNT(*) FILTER (WHERE a.status IN ('Present','Late') AND COALESCE(a.brother_status_at_workday,'Active') <> 'Pledge' AND COALESCE(a.coveralls,false) AND NOT COALESCE(a.nametag,false)) AS active_coveralls_count,
        COUNT(*) FILTER (WHERE a.status IN ('Present','Late') AND COALESCE(a.brother_status_at_workday,'Active') <> 'Pledge' AND COALESCE(a.coveralls,false) AND COALESCE(a.nametag,false)) AS active_coveralls_nametag_count,
        COUNT(*) FILTER (WHERE a.status IN ('Present','Late') AND COALESCE(a.brother_status_at_workday,'Active') = 'Pledge' AND a.status='Present') AS pledge_present_count,
        COUNT(*) FILTER (WHERE a.status IN ('Present','Late') AND COALESCE(a.brother_status_at_workday,'Active') = 'Pledge' AND a.status='Late') AS pledge_late_count
      FROM workdays w
      JOIN workday_attendance a ON a.workday_id = w.id
      ${where}
      GROUP BY w.id, w.workday_date, w.bonus_month
      ORDER BY w.workday_date DESC, w.id DESC
    `,
    params
  );

  // We expect this to be called with a single bonus_month from the Chapter Bonus page.
  const ratesRes = bonusMonth
    ? await pool.query(
        `
          SELECT
            active_present_rate,
            active_late_rate,
            active_coveralls_rate,
            active_coveralls_nametag_rate,
            pledge_present_rate,
            pledge_late_rate
          FROM chapter_bonus_workday_rates
          WHERE month = $1
        `,
        [bonusMonth]
      )
    : { rows: [] };
  const raw = ratesRes.rows[0] ?? {};
  const rates = {
    active_present_rate: roundMoney(Number(raw.active_present_rate ?? 0)),
    active_late_rate: roundMoney(Number(raw.active_late_rate ?? 0)),
    active_coveralls_rate: roundMoney(Number(raw.active_coveralls_rate ?? 0)),
    active_coveralls_nametag_rate: roundMoney(Number(raw.active_coveralls_nametag_rate ?? 0)),
    pledge_present_rate: roundMoney(Number(raw.pledge_present_rate ?? 0)),
    pledge_late_rate: roundMoney(Number(raw.pledge_late_rate ?? 0)),
  };

  const rows = aggRes.rows.map((r) => {
    const earnings_total = roundMoney(
      Number(r.active_present_count) * rates.active_present_rate +
        Number(r.active_late_count) * rates.active_late_rate +
        Number(r.active_coveralls_count) * rates.active_coveralls_rate +
        Number(r.active_coveralls_nametag_count) * rates.active_coveralls_nametag_rate +
        Number(r.pledge_present_count) * rates.pledge_present_rate +
        Number(r.pledge_late_count) * rates.pledge_late_rate
    );
    const total =
      Number(r.active_present_count) +
      Number(r.active_late_count) +
      Number(r.active_coveralls_count) +
      Number(r.active_coveralls_nametag_count) +
      Number(r.pledge_present_count) +
      Number(r.pledge_late_count);
    return {
      id: r.id,
      workday_date: r.workday_date,
      bonus_month: r.bonus_month,
      summary: {
        attended_counts: {
          active_present: Number(r.active_present_count),
          active_late: Number(r.active_late_count),
          active_coveralls: Number(r.active_coveralls_count),
          active_coveralls_nametag: Number(r.active_coveralls_nametag_count),
          pledge_present: Number(r.pledge_present_count),
          pledge_late: Number(r.pledge_late_count),
          total,
        },
        earnings_total,
      },
    };
  });

  return res.status(200).json(rows);
}

async function getWorkday(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const payload = await getWorkdayPayload(pool, id);
  if (!payload) return res.status(404).json({ error: { message: "Workday not found" } });
  return res.status(200).json(payload);
}

async function createWorkday(req, res) {
  const payload = workdayUpsertSchema.parse(req.body);
  const workdayDate = payload.workday_date;
  const schoolYear = schoolYearStartForDate(workdayDate);
  const bonusMonth = payload.bonus_month ?? monthForDate(workdayDate);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const wdRes = await client.query(
      `
        INSERT INTO workdays (workday_date, bonus_month, title, school_year)
        VALUES ($1,$2,$3,$4)
        RETURNING *
      `,
      [workdayDate, bonusMonth, payload.title ?? null, schoolYear]
    );
    const workday = wdRes.rows[0];

    // Initialize attendance for all brothers as Missing unless payload provided
    const brothersRes = await client.query(
      "SELECT id, first_name, last_name, status FROM brothers WHERE status IN ('Active', 'Pledge') ORDER BY last_name ASC, first_name ASC"
    );
    const provided = new Map((payload.attendance ?? []).map((a) => [a.brother_id, a.status]));
    for (const b of brothersRes.rows) {
      const status = provided.get(b.id) ?? "Missing";
      await client.query(
        `INSERT INTO workday_attendance (
           workday_id, brother_id, status, member_first_name, member_last_name, brother_status_at_workday
         ) VALUES ($1,$2,$3,$4,$5,$6)`,
        [workday.id, b.id, status, b.first_name ?? null, b.last_name ?? null, b.status ?? null]
      );
    }

    await client.query("COMMIT");
    return res.status(201).json(workday);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function updateWorkday(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const payload = workdayUpsertSchema.parse(req.body);
  const workdayDate = payload.workday_date;
  const schoolYear = schoolYearStartForDate(workdayDate);
  const bonusMonth = payload.bonus_month ?? monthForDate(workdayDate);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const wdRes = await client.query(
      `
        UPDATE workdays
        SET workday_date = $1, bonus_month = $2, title = $3, school_year = $4, updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `,
      [workdayDate, bonusMonth, payload.title ?? null, schoolYear, id]
    );
    const workday = wdRes.rows[0];
    if (!workday) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: { message: "Workday not found" } });
    }

    // Update attendance without rewriting snapshot fields.
    const rows = payload.attendance ?? [];
    for (const a of rows) {
      const existingRes = await client.query(
        `
          SELECT brother_status_at_workday, member_first_name, member_last_name
          FROM workday_attendance
          WHERE workday_id = $1 AND brother_id = $2
        `,
        [id, a.brother_id]
      );
      const existing = existingRes.rows[0] ?? null;

      let snapshotStatus = existing?.brother_status_at_workday ?? null;
      let snapshotFirst = existing?.member_first_name ?? null;
      let snapshotLast = existing?.member_last_name ?? null;

      if (!existing) {
        const broRes = await client.query("SELECT first_name, last_name, status FROM brothers WHERE id = $1", [
          a.brother_id,
        ]);
        const bro = broRes.rows[0];
        snapshotFirst = bro?.first_name ?? null;
        snapshotLast = bro?.last_name ?? null;
        snapshotStatus = bro?.status ?? null;
      }

      const isPledge = snapshotStatus === "Pledge";
      const isCoverallApplicable = !isPledge && (a.status === "Present" || a.status === "Late");
      const coveralls = isCoverallApplicable ? Boolean(a.coveralls) : null;
      const nametag = isCoverallApplicable ? Boolean(a.nametag) : null;

      const isMakeupApplicable = a.status === "Missing" || a.status === "Excused";
      const makeupCompletedAt = isMakeupApplicable && a.makeup_completed_at ? a.makeup_completed_at : null;

      const updateRes = await client.query(
        `
          UPDATE workday_attendance
          SET status = $3,
              coveralls = $4,
              nametag = $5,
              makeup_completed_at = $6
          WHERE workday_id = $1 AND brother_id = $2
        `,
        [id, a.brother_id, a.status, coveralls, nametag, makeupCompletedAt]
      );

      if (updateRes.rowCount === 0) {
        await client.query(
          `
            INSERT INTO workday_attendance (
              workday_id, brother_id, status, coveralls, nametag, makeup_completed_at,
              member_first_name, member_last_name, brother_status_at_workday
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          `,
          [id, a.brother_id, a.status, coveralls, nametag, makeupCompletedAt, snapshotFirst, snapshotLast, snapshotStatus]
        );
      }
    }

    await client.query("COMMIT");
    const full = await getWorkdayPayload(pool, id);
    return res.status(200).json(full ?? workday);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function deleteWorkday(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const result = await pool.query("DELETE FROM workdays WHERE id = $1", [id]);
  if (result.rowCount === 0) return res.status(404).json({ error: { message: "Workday not found" } });
  return res.status(204).send();
}

module.exports = {
  listWorkdays,
  getWorkday,
  createWorkday,
  updateWorkday,
  deleteWorkday,
};


