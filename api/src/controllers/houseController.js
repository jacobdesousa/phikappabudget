const { pool } = require("../db/pool");
const { idParamSchema } = require("../validation/common");
const { currentSchoolYearStart } = require("../utils/schoolYear");
const { roundMoney } = require("../utils/money");
const {
  yearSessionQuerySchema,
  assignmentCreateSchema,
  assignmentUpdateSchema,
} = require("../validation/house");
const {
  rateForOccupancy,
  hasOverride,
  baseAmountFor,
  sessionBaseFor,
  rebateFor,
  totalOwedFor,
  dueToDateFor,
  rangesOverlap,
} = require("../utils/houseFees");

// Session row + instalment schedule + per-room rates for one year/session.
async function loadContext(year, sessionType) {
  const [sessionRes, instRes, ratesRes] = await Promise.all([
    pool.query(
      `SELECT session_type, terms, start_date::text AS start_date, end_date::text AS end_date,
              member_rebate, prepay_discount_pct, prepay_deadline::text AS prepay_deadline,
              security_deposit_amount
       FROM house_sessions WHERE school_year = $1 AND session_type = $2`,
      [year, sessionType]
    ),
    pool.query(
      `SELECT seq, due_date::text AS due_date, weight_pct
       FROM house_session_instalments
       WHERE school_year = $1 AND session_type = $2 ORDER BY seq ASC`,
      [year, sessionType]
    ),
    pool.query(
      `SELECT room_id, capacity, rate_per_person
       FROM house_room_rates WHERE school_year = $1 AND session_type = $2`,
      [year, sessionType]
    ),
  ]);

  return {
    session: sessionRes.rows[0] ?? null,
    instalments: instRes.rows,
    ratesByRoom: new Map(ratesRes.rows.map((r) => [Number(r.room_id), r])),
  };
}

const ASSIGNMENT_SELECT = `
  SELECT a.id, a.school_year, a.session_type, a.room_id, a.bed, a.brother_id,
         a.occupancy, a.start_date::text AS start_date, a.end_date::text AS end_date,
         a.base_amount, a.amount_override, a.override_note,
         a.member_discount, a.double_rebate, a.prepay_discount, a.notes,
         r.room_code, r.floor, r.sort_order,
         b.first_name, b.last_name, b.email, b.phone, b.status AS brother_status
  FROM house_assignments a
  JOIN house_rooms r ON r.id = a.room_id
  JOIN brothers b ON b.id = a.brother_id
`;

function decorate(row, ctx) {
  const rate = ctx.ratesByRoom.get(Number(row.room_id));
  const total_owed = totalOwedFor(row, ctx.session, rate);

  // The individual steps are returned so the UI can show its working rather
  // than re-deriving the arithmetic and drifting from the server.
  const session_base = sessionBaseFor(row, ctx.session, rate);
  const rebate_amount = rebateFor(row, ctx.session, rate);
  // An override is billed as entered, so neither discount applies — report them
  // as zero rather than letting the UI show a deduction that wasn't taken.
  const is_override = hasOverride(row);
  const prepay_pct =
    !is_override && row.prepay_discount ? Number(ctx.session?.prepay_discount_pct ?? 0) : 0;
  const prepay_amount = roundMoney((session_base - rebate_amount) * (prepay_pct / 100));

  return {
    ...row,
    capacity: rate?.capacity ?? 1,
    // resolved_rate is per term; session_base is what the whole session costs
    // before discounts.
    resolved_rate: rateForOccupancy(rate, row.occupancy),
    base_amount_effective: baseAmountFor(row, rate),
    session_base,
    terms: Number(ctx.session?.terms) || 1,
    rebate_per_term:
      !is_override && row.member_discount ? Number(ctx.session?.member_rebate ?? 0) : 0,
    rebate_beds:
      row.occupancy === "full_room" && row.double_rebate ? Math.max(rate?.capacity ?? 1, 1) : 1,
    rebate_amount,
    prepay_pct,
    prepay_amount,
    is_override,
    total_owed,
  };
}

// The room's whole capacity is taken by a full_room assignment, so it conflicts
// with every bed rather than just its own.
async function findOverlap({ schoolYear, sessionType, roomId, bed, occupancy, startDate, endDate, excludeId }) {
  const { rows } = await pool.query(
    `SELECT a.id, a.bed, a.occupancy, a.start_date::text AS start_date, a.end_date::text AS end_date,
            b.first_name, b.last_name
     FROM house_assignments a
     JOIN brothers b ON b.id = a.brother_id
     WHERE a.school_year = $1 AND a.session_type = $2 AND a.room_id = $3
       AND ($4::int IS NULL OR a.id <> $4)`,
    [schoolYear, sessionType, roomId, excludeId ?? null]
  );

  return (
    rows.find((other) => {
      const sharesBed =
        occupancy === "full_room" || other.occupancy === "full_room" || other.bed === bed;
      if (!sharesBed) return false;
      return rangesOverlap(startDate, endDate, other.start_date, other.end_date);
    }) ?? null
  );
}

async function listAssignments(req, res) {
  const q = yearSessionQuerySchema.parse(req.query);
  const year = q.year ?? currentSchoolYearStart();
  const sessionType = q.session ?? "winter";

  const ctx = await loadContext(year, sessionType);
  const { rows } = await pool.query(
    `${ASSIGNMENT_SELECT}
     WHERE a.school_year = $1 AND a.session_type = $2
     ORDER BY r.sort_order ASC, r.room_code ASC, a.bed ASC, a.start_date ASC`,
    [year, sessionType]
  );

  res.status(200).json({
    year,
    session_type: sessionType,
    session: ctx.session,
    instalments: ctx.instalments,
    assignments: rows.map((r) => decorate(r, ctx)),
  });
}

// Rooms with their per-bed occupancy for the selected year/session — the shape
// the residents page renders directly.
async function getRoster(req, res) {
  const q = yearSessionQuerySchema.parse(req.query);
  const year = q.year ?? currentSchoolYearStart();
  const sessionType = q.session ?? "winter";

  const ctx = await loadContext(year, sessionType);
  const [roomsRes, assignmentsRes] = await Promise.all([
    pool.query(
      `SELECT id, room_code, floor, sort_order, is_active, notes
       FROM house_rooms WHERE is_active = TRUE
       ORDER BY sort_order ASC, room_code ASC`
    ),
    pool.query(
      `${ASSIGNMENT_SELECT}
       WHERE a.school_year = $1 AND a.session_type = $2
       ORDER BY a.bed ASC, a.start_date ASC`,
      [year, sessionType]
    ),
  ]);

  const decorated = assignmentsRes.rows.map((r) => decorate(r, ctx));

  const rooms = roomsRes.rows.map((room) => {
    const rate = ctx.ratesByRoom.get(Number(room.id));
    const capacity = rate?.capacity ?? 1;
    const mine = decorated.filter((a) => Number(a.room_id) === Number(room.id));
    const isBoughtOut = mine.some((a) => a.occupancy === "full_room");
    const beds = [];
    for (let bed = 1; bed <= capacity; bed++) {
      beds.push({
        bed,
        // A full_room occupant fills every bed in the room.
        assignments: mine.filter((a) => a.occupancy === "full_room" || a.bed === bed),
      });
    }
    return {
      ...room,
      capacity,
      rate_per_person: rate?.rate_per_person ?? null,
      is_bought_out: isBoughtOut,
      beds,
    };
  });

  res.status(200).json({
    year,
    session_type: sessionType,
    session: ctx.session,
    instalments: ctx.instalments,
    rooms,
  });
}

async function createAssignment(req, res) {
  const payload = assignmentCreateSchema.parse(req.body);
  const ctx = await loadContext(payload.school_year, payload.session_type);
  if (!ctx.session) {
    return res.status(404).json({
      error: { message: `No ${payload.session_type} session configured for ${payload.school_year}` },
    });
  }

  const rate = ctx.ratesByRoom.get(Number(payload.room_id));
  const startDate = payload.start_date ?? ctx.session.start_date;
  const endDate = payload.end_date ?? ctx.session.end_date;

  const conflict = await findOverlap({
    schoolYear: payload.school_year,
    sessionType: payload.session_type,
    roomId: payload.room_id,
    bed: payload.bed,
    occupancy: payload.occupancy,
    startDate,
    endDate,
  });
  if (conflict) {
    return res.status(409).json({
      error: {
        message: `Room is already occupied by ${conflict.first_name} ${conflict.last_name} from ${conflict.start_date ?? "?"} to ${conflict.end_date ?? "?"}`,
      },
    });
  }

  // Active brothers get the member rebate by default; boarders and alumni don't.
  let memberDiscount = payload.member_discount;
  if (memberDiscount === undefined) {
    const b = await pool.query(`SELECT status FROM brothers WHERE id = $1`, [payload.brother_id]);
    memberDiscount = b.rows[0]?.status === "Active";
  }

  const baseAmount =
    payload.base_amount ?? rateForOccupancy(rate, payload.occupancy) ?? null;

  const { rows } = await pool.query(
    `INSERT INTO house_assignments
       (school_year, session_type, room_id, bed, brother_id, occupancy,
        start_date, end_date, base_amount, amount_override, override_note,
        member_discount, double_rebate, prepay_discount, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING id`,
    [
      payload.school_year,
      payload.session_type,
      payload.room_id,
      payload.bed,
      payload.brother_id,
      payload.occupancy,
      startDate,
      endDate,
      baseAmount === null ? null : roundMoney(baseAmount),
      payload.amount_override === null || payload.amount_override === undefined
        ? null
        : roundMoney(payload.amount_override),
      payload.override_note ?? null,
      memberDiscount,
      payload.double_rebate ?? false,
      payload.prepay_discount ?? false,
      payload.notes ?? null,
    ]
  );

  // Every resident owes a deposit at room allocation, so create it up front
  // rather than relying on someone to remember. One per person — a returning
  // resident keeps the deposit already on file.
  await pool.query(
    `INSERT INTO house_deposits (brother_id, amount, status)
     VALUES ($1, $2, 'outstanding')
     ON CONFLICT (brother_id) DO NOTHING`,
    [payload.brother_id, roundMoney(Number(ctx.session.security_deposit_amount ?? 0))]
  );

  const created = await pool.query(`${ASSIGNMENT_SELECT} WHERE a.id = $1`, [rows[0].id]);
  return res.status(201).json(decorate(created.rows[0], ctx));
}

async function updateAssignment(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const payload = assignmentUpdateSchema.parse(req.body);

  const existingRes = await pool.query(
    `SELECT *, start_date::text AS start_date, end_date::text AS end_date
     FROM house_assignments WHERE id = $1`,
    [id]
  );
  const existing = existingRes.rows[0];
  if (!existing) {
    return res.status(404).json({ error: { message: "Assignment not found" } });
  }

  const merged = { ...existing, ...payload };
  const ctx = await loadContext(merged.school_year, merged.session_type);

  const conflict = await findOverlap({
    schoolYear: merged.school_year,
    sessionType: merged.session_type,
    roomId: merged.room_id,
    bed: merged.bed,
    occupancy: merged.occupancy,
    startDate: merged.start_date,
    endDate: merged.end_date,
    excludeId: id,
  });
  if (conflict) {
    return res.status(409).json({
      error: {
        message: `Room is already occupied by ${conflict.first_name} ${conflict.last_name} from ${conflict.start_date ?? "?"} to ${conflict.end_date ?? "?"}`,
      },
    });
  }

  const money = (v) => (v === null || v === undefined ? null : roundMoney(v));

  await pool.query(
    `UPDATE house_assignments SET
       room_id = $1, bed = $2, brother_id = $3, occupancy = $4,
       start_date = $5, end_date = $6, base_amount = $7, amount_override = $8,
       override_note = $9, member_discount = $10, double_rebate = $11,
       prepay_discount = $12, notes = $13
     WHERE id = $14`,
    [
      merged.room_id,
      merged.bed,
      merged.brother_id,
      merged.occupancy,
      merged.start_date ?? null,
      merged.end_date ?? null,
      money(merged.base_amount),
      money(merged.amount_override),
      merged.override_note ?? null,
      merged.member_discount,
      merged.double_rebate,
      merged.prepay_discount,
      merged.notes ?? null,
      id,
    ]
  );

  const updated = await pool.query(`${ASSIGNMENT_SELECT} WHERE a.id = $1`, [id]);
  return res.status(200).json(decorate(updated.rows[0], ctx));
}

async function deleteAssignment(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const { rowCount } = await pool.query(`DELETE FROM house_assignments WHERE id = $1`, [id]);
  if (!rowCount) {
    return res.status(404).json({ error: { message: "Assignment not found" } });
  }
  return res.status(204).send();
}

// Per-resident balances for a year/session. Mirrors duesPaymentsSummary.
async function houseSummary(req, res) {
  const q = yearSessionQuerySchema.parse(req.query);
  const year = q.year ?? currentSchoolYearStart();
  const sessionType = q.session ?? "winter";

  const ctx = await loadContext(year, sessionType);
  if (!ctx.session) {
    return res
      .status(404)
      .json({ error: { message: `No ${sessionType} session configured for ${year}` } });
  }

  const [assignmentsRes, paymentsRes, depositsRes] = await Promise.all([
    pool.query(
      `${ASSIGNMENT_SELECT}
       WHERE a.school_year = $1 AND a.session_type = $2
       ORDER BY r.sort_order ASC, r.room_code ASC, a.bed ASC`,
      [year, sessionType]
    ),
    pool.query(
      `SELECT brother_id,
              COALESCE(SUM(amount), 0) AS total_paid,
              COUNT(id) AS payment_count,
              MAX(paid_at)::text AS last_paid_at
       FROM house_payments
       WHERE school_year = $1 AND session_type = $2
       GROUP BY brother_id`,
      [year, sessionType]
    ),
    pool.query(
      `SELECT brother_id,
              COALESCE(SUM(CASE WHEN status = 'received' THEN amount ELSE 0 END), 0) AS deposit_held
       FROM house_deposits GROUP BY brother_id`
    ),
  ]);

  const paymentsByBrother = new Map(paymentsRes.rows.map((r) => [Number(r.brother_id), r]));
  const depositByBrother = new Map(depositsRes.rows.map((r) => [Number(r.brother_id), r]));
  const today = new Date();

  // A resident with two assignments (mid-session move) owes the sum of both,
  // and their payments count once against that combined total.
  const byBrother = new Map();
  for (const row of assignmentsRes.rows) {
    const decorated = decorate(row, ctx);
    const brotherId = Number(row.brother_id);
    const entry = byBrother.get(brotherId) ?? {
      brother_id: brotherId,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      phone: row.phone,
      brother_status: row.brother_status,
      assignments: [],
      total_owed: 0,
    };
    entry.assignments.push(decorated);
    entry.total_owed = roundMoney(entry.total_owed + decorated.total_owed);
    byBrother.set(brotherId, entry);
  }

  const enriched = [...byBrother.values()].map((entry) => {
    const agg = paymentsByBrother.get(entry.brother_id);
    const totalPaid = Number(agg?.total_paid ?? 0);
    const dueToDate = dueToDateFor(entry.total_owed, ctx.instalments, today);
    return {
      ...entry,
      year,
      session_type: sessionType,
      total_paid: totalPaid,
      payment_count: Number(agg?.payment_count ?? 0),
      last_paid_at: agg?.last_paid_at ?? null,
      deposit_held: Number(depositByBrother.get(entry.brother_id)?.deposit_held ?? 0),
      due_to_date: dueToDate,
      balance_total: roundMoney(entry.total_owed - totalPaid),
      balance_due_to_date: roundMoney(dueToDate - totalPaid),
      is_behind: roundMoney(dueToDate - totalPaid) > 0,
    };
  });

  // Ordered by room so the table reads in the same sequence as the residents
  // page and the fee schedule. A resident who moved mid-session sorts by their
  // first room.
  const roomKey = (r) => {
    const first = r.assignments[0];
    return {
      sort: Number(first?.sort_order ?? Number.MAX_SAFE_INTEGER),
      code: first?.room_code ?? "",
      bed: Number(first?.bed ?? 0),
    };
  };

  enriched.sort((a, b) => {
    const ka = roomKey(a);
    const kb = roomKey(b);
    return (
      ka.sort - kb.sort ||
      ka.code.localeCompare(kb.code) ||
      ka.bed - kb.bed ||
      (a.first_name ?? "").localeCompare(b.first_name ?? "")
    );
  });

  return res.status(200).json({
    year,
    session_type: sessionType,
    session: ctx.session,
    instalments: ctx.instalments,
    residents: enriched,
  });
}

module.exports = {
  listAssignments,
  getRoster,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  houseSummary,
};
