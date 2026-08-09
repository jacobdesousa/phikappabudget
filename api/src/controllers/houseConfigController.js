const { pool } = require("../db/pool");
const { currentSchoolYearStart } = require("../utils/schoolYear");
const { roundMoney } = require("../utils/money");
const {
  houseConfigUpsertSchema,
  seedConfigSchema,
  SESSION_TYPES,
} = require("../validation/house");
const {
  DEFAULT_ROOM_RATES,
  DEFAULT_PAYEES,
  defaultSession,
} = require("../utils/houseFees");

async function listRooms(req, res) {
  const { rows } = await pool.query(
    `SELECT id, room_code, floor, sort_order, is_active, notes
     FROM house_rooms
     ORDER BY sort_order ASC, room_code ASC`
  );
  res.status(200).json(rows);
}

// Everything the config page needs for one school year, in one call.
async function getHouseConfig(req, res) {
  const year = req.query.year ? Number(req.query.year) : currentSchoolYearStart();

  const [roomsRes, sessionsRes, instRes, ratesRes, payeesRes] = await Promise.all([
    pool.query(
      `SELECT id, room_code, floor, sort_order, is_active, notes
       FROM house_rooms ORDER BY sort_order ASC, room_code ASC`
    ),
    pool.query(
      `SELECT session_type, terms, start_date::text AS start_date, end_date::text AS end_date,
              member_rebate, prepay_discount_pct, prepay_deadline::text AS prepay_deadline,
              security_deposit_amount
       FROM house_sessions WHERE school_year = $1`,
      [year]
    ),
    pool.query(
      `SELECT session_type, seq, due_date::text AS due_date, weight_pct
       FROM house_session_instalments WHERE school_year = $1
       ORDER BY session_type ASC, seq ASC`,
      [year]
    ),
    pool.query(
      `SELECT session_type, room_id, capacity, rate_per_person
       FROM house_room_rates WHERE school_year = $1`,
      [year]
    ),
    pool.query(
      `SELECT payee, pct, is_internal, sort_order
       FROM house_disbursement_payees WHERE school_year = $1
       ORDER BY sort_order ASC, payee ASC`,
      [year]
    ),
  ]);

  const sessions = sessionsRes.rows.map((s) => ({
    ...s,
    instalments: instRes.rows.filter((i) => i.session_type === s.session_type),
  }));

  res.status(200).json({
    year,
    rooms: roomsRes.rows,
    sessions,
    rates: ratesRes.rows,
    payees: payeesRes.rows,
    is_configured: sessions.length > 0,
  });
}

async function upsertHouseConfig(req, res) {
  const payload = houseConfigUpsertSchema.parse(req.body);
  const year = payload.year;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const s of payload.sessions) {
      await client.query(
        `INSERT INTO house_sessions
           (school_year, session_type, terms, start_date, end_date, member_rebate,
            prepay_discount_pct, prepay_deadline, security_deposit_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (school_year, session_type) DO UPDATE SET
           terms = EXCLUDED.terms,
           start_date = EXCLUDED.start_date,
           end_date = EXCLUDED.end_date,
           member_rebate = EXCLUDED.member_rebate,
           prepay_discount_pct = EXCLUDED.prepay_discount_pct,
           prepay_deadline = EXCLUDED.prepay_deadline,
           security_deposit_amount = EXCLUDED.security_deposit_amount`,
        [
          year,
          s.session_type,
          s.terms,
          s.start_date ?? null,
          s.end_date ?? null,
          roundMoney(s.member_rebate),
          s.prepay_discount_pct,
          s.prepay_deadline ?? null,
          roundMoney(s.security_deposit_amount),
        ]
      );

      // Full replace: the config page always sends the whole schedule.
      await client.query(
        `DELETE FROM house_session_instalments WHERE school_year = $1 AND session_type = $2`,
        [year, s.session_type]
      );
      for (const inst of s.instalments) {
        await client.query(
          `INSERT INTO house_session_instalments
             (school_year, session_type, seq, due_date, weight_pct)
           VALUES ($1,$2,$3,$4,$5)`,
          [year, s.session_type, inst.seq, inst.due_date ?? null, inst.weight_pct]
        );
      }
    }

    for (const r of payload.rates) {
      await client.query(
        `INSERT INTO house_room_rates
           (school_year, session_type, room_id, capacity, rate_per_person)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (school_year, session_type, room_id) DO UPDATE SET
           capacity = EXCLUDED.capacity,
           rate_per_person = EXCLUDED.rate_per_person`,
        [year, r.session_type, r.room_id, r.capacity, r.rate_per_person ?? null]
      );
    }

    if (payload.payees) {
      for (const p of payload.payees) {
        await client.query(
          `INSERT INTO house_disbursement_payees (school_year, payee, pct, is_internal, sort_order)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (school_year, payee) DO UPDATE SET
             pct = EXCLUDED.pct,
             is_internal = EXCLUDED.is_internal,
             sort_order = EXCLUDED.sort_order`,
          [year, p.payee, p.pct, p.is_internal, p.sort_order ?? null]
        );
      }
    }

    await client.query("COMMIT");
    return res.status(200).json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// Copy a prior year's setup forward (shifting dates by the year delta), or lay
// down the fee-schedule defaults when there is nothing to copy.
async function seedHouseConfig(req, res) {
  const payload = seedConfigSchema.parse({ ...req.query, ...req.body });
  const year = payload.year;

  const existing = await pool.query(
    `SELECT 1 FROM house_sessions WHERE school_year = $1 LIMIT 1`,
    [year]
  );
  if (existing.rows[0]) {
    return res
      .status(409)
      .json({ error: { message: `School year ${year} is already configured` } });
  }

  const roomsRes = await pool.query(`SELECT id, room_code FROM house_rooms`);
  const roomIdByCode = new Map(roomsRes.rows.map((r) => [r.room_code, r.id]));

  let sessions = null;
  let rates = null;
  let payees = null;

  if (payload.from !== undefined) {
    const delta = year - payload.from;
    const [fromSessions, fromInst, fromRates, fromPayees] = await Promise.all([
      pool.query(`SELECT * FROM house_sessions WHERE school_year = $1`, [payload.from]),
      pool.query(`SELECT * FROM house_session_instalments WHERE school_year = $1`, [payload.from]),
      pool.query(`SELECT * FROM house_room_rates WHERE school_year = $1`, [payload.from]),
      pool.query(`SELECT * FROM house_disbursement_payees WHERE school_year = $1`, [payload.from]),
    ]);

    if (!fromSessions.rows.length) {
      return res
        .status(404)
        .json({ error: { message: `School year ${payload.from} has no config to copy` } });
    }

    const shift = (d) => {
      if (!d) return null;
      const dt = new Date(d);
      dt.setFullYear(dt.getFullYear() + delta);
      return dt.toISOString().slice(0, 10);
    };

    sessions = fromSessions.rows.map((s) => ({
      session_type: s.session_type,
      terms: s.terms,
      start_date: shift(s.start_date),
      end_date: shift(s.end_date),
      member_rebate: Number(s.member_rebate),
      prepay_discount_pct: Number(s.prepay_discount_pct),
      prepay_deadline: shift(s.prepay_deadline),
      security_deposit_amount: Number(s.security_deposit_amount),
      instalments: fromInst.rows
        .filter((i) => i.session_type === s.session_type)
        .map((i) => ({
          seq: i.seq,
          due_date: shift(i.due_date),
          weight_pct: Number(i.weight_pct),
        })),
    }));
    rates = fromRates.rows.map((r) => ({
      session_type: r.session_type,
      room_id: r.room_id,
      capacity: r.capacity,
      rate_per_person: r.rate_per_person,
    }));
    payees = fromPayees.rows.map((p) => ({
      payee: p.payee,
      pct: Number(p.pct),
      is_internal: p.is_internal,
      sort_order: p.sort_order,
    }));
  } else {
    sessions = SESSION_TYPES.map((t) => defaultSession(year, t));
    rates = [];
    for (const sessionType of SESSION_TYPES) {
      for (const [code, defaults] of Object.entries(DEFAULT_ROOM_RATES)) {
        const roomId = roomIdByCode.get(code);
        if (!roomId) continue;
        rates.push({ session_type: sessionType, room_id: roomId, ...defaults });
      }
    }
    payees = DEFAULT_PAYEES;
  }

  req.body = { year, sessions, rates, payees };
  return upsertHouseConfig(req, res);
}

module.exports = { listRooms, getHouseConfig, upsertHouseConfig, seedHouseConfig };
