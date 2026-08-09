const { pool } = require("../db/pool");
const { idParamSchema } = require("../validation/common");
const { schoolYearStartForDate } = require("../utils/schoolYear");
const { roundMoney } = require("../utils/money");
const {
  paymentCreateSchema,
  paymentUpdateSchema,
  depositCreateSchema,
  depositUpdateSchema,
} = require("../validation/house");

async function listHousePayments(req, res) {
  const clauses = [];
  const params = [];

  if (req.query.brother_id) {
    params.push(Number(req.query.brother_id));
    clauses.push(`p.brother_id = $${params.length}`);
  }
  if (req.query.year) {
    params.push(Number(req.query.year));
    clauses.push(`p.school_year = $${params.length}`);
  }
  if (req.query.session) {
    params.push(String(req.query.session));
    clauses.push(`p.session_type = $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT p.id, p.brother_id, p.school_year, p.session_type, p.assignment_id,
            p.paid_at::text AS paid_at, p.amount, p.memo,
            b.first_name, b.last_name
     FROM house_payments p
     JOIN brothers b ON b.id = p.brother_id
     ${where}
     ORDER BY p.paid_at DESC, p.id DESC`,
    params
  );
  res.status(200).json(rows);
}

async function createHousePayment(req, res) {
  const payload = paymentCreateSchema.parse(req.body);
  const schoolYear = payload.school_year ?? schoolYearStartForDate(payload.paid_at);

  const { rows } = await pool.query(
    `INSERT INTO house_payments
       (brother_id, school_year, session_type, assignment_id, paid_at, amount, memo)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, brother_id, school_year, session_type, assignment_id,
               paid_at::text AS paid_at, amount, memo`,
    [
      payload.brother_id,
      schoolYear,
      payload.session_type,
      payload.assignment_id ?? null,
      payload.paid_at,
      roundMoney(payload.amount),
      payload.memo ?? null,
    ]
  );
  res.status(201).json(rows[0]);
}

async function updateHousePayment(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const payload = paymentUpdateSchema.parse(req.body);

  const existingRes = await pool.query(
    `SELECT *, paid_at::text AS paid_at FROM house_payments WHERE id = $1`,
    [id]
  );
  const existing = existingRes.rows[0];
  if (!existing) {
    return res.status(404).json({ error: { message: "Payment not found" } });
  }

  const merged = { ...existing, ...payload };
  const { rows } = await pool.query(
    `UPDATE house_payments SET
       school_year = $1, session_type = $2, assignment_id = $3,
       paid_at = $4, amount = $5, memo = $6
     WHERE id = $7
     RETURNING id, brother_id, school_year, session_type, assignment_id,
               paid_at::text AS paid_at, amount, memo`,
    [
      merged.school_year,
      merged.session_type,
      merged.assignment_id ?? null,
      merged.paid_at,
      roundMoney(merged.amount),
      merged.memo ?? null,
      id,
    ]
  );
  res.status(200).json(rows[0]);
}

async function deleteHousePayment(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const { rowCount } = await pool.query(`DELETE FROM house_payments WHERE id = $1`, [id]);
  if (!rowCount) {
    return res.status(404).json({ error: { message: "Payment not found" } });
  }
  res.status(204).send();
}

// ── Security deposits (per resident, not per session) ───────────────────────

// Replaces a deposit's deductions wholesale — the dialog always sends the full
// list. Runs inside the caller's transaction.
async function replaceDeductions(client, depositId, deductions) {
  await client.query(`DELETE FROM house_deposit_deductions WHERE deposit_id = $1`, [depositId]);
  for (const d of deductions) {
    await client.query(
      `INSERT INTO house_deposit_deductions (deposit_id, description, amount) VALUES ($1,$2,$3)`,
      [depositId, d.description ?? null, roundMoney(d.amount)]
    );
  }
}

async function loadDeposit(id) {
  const { rows } = await pool.query(
    `SELECT d.id, d.brother_id, d.amount, d.received_at::text AS received_at,
            d.status, d.released_at::text AS released_at,
            d.refund_cheque_number, d.note,
            b.first_name, b.last_name,
            COALESCE(
              (SELECT json_agg(json_build_object('id', x.id, 'description', x.description, 'amount', x.amount)
                               ORDER BY x.id)
               FROM house_deposit_deductions x WHERE x.deposit_id = d.id),
              '[]'::json
            ) AS deductions
     FROM house_deposits d
     JOIN brothers b ON b.id = d.brother_id
     WHERE d.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

async function listHouseDeposits(req, res) {
  const clauses = [];
  const params = [];
  if (req.query.brother_id) {
    params.push(Number(req.query.brother_id));
    clauses.push(`d.brother_id = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const { rows } = await pool.query(
    `SELECT d.id, d.brother_id, d.amount, d.received_at::text AS received_at,
            d.status, d.released_at::text AS released_at,
            d.refund_cheque_number, d.note,
            b.first_name, b.last_name,
            COALESCE(
              (SELECT json_agg(json_build_object('id', x.id, 'description', x.description, 'amount', x.amount)
                               ORDER BY x.id)
               FROM house_deposit_deductions x WHERE x.deposit_id = d.id),
              '[]'::json
            ) AS deductions
     FROM house_deposits d
     JOIN brothers b ON b.id = d.brother_id
     ${where}
     ORDER BY d.received_at DESC NULLS LAST, d.id DESC`,
    params
  );
  res.status(200).json(rows);
}

async function createHouseDeposit(req, res) {
  const payload = depositCreateSchema.parse(req.body);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO house_deposits
         (brother_id, amount, received_at, status, released_at, refund_cheque_number, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        payload.brother_id,
        roundMoney(payload.amount),
        payload.received_at ?? null,
        payload.status,
        payload.released_at ?? null,
        payload.refund_cheque_number ?? null,
        payload.note ?? null,
      ]
    );
    await replaceDeductions(client, rows[0].id, payload.deductions ?? []);
    await client.query("COMMIT");
    return res.status(201).json(await loadDeposit(rows[0].id));
  } catch (e) {
    await client.query("ROLLBACK");
    if (e.code === "23505") {
      return res
        .status(409)
        .json({ error: { message: "This resident already has a deposit — edit that one instead." } });
    }
    throw e;
  } finally {
    client.release();
  }
}

async function updateHouseDeposit(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const payload = depositUpdateSchema.parse(req.body);

  const existingRes = await pool.query(
    `SELECT *, received_at::text AS received_at, released_at::text AS released_at
     FROM house_deposits WHERE id = $1`,
    [id]
  );
  const existing = existingRes.rows[0];
  if (!existing) {
    return res.status(404).json({ error: { message: "Deposit not found" } });
  }

  const merged = { ...existing, ...payload };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE house_deposits SET
         brother_id = $1, amount = $2, received_at = $3, status = $4, released_at = $5,
         refund_cheque_number = $6, note = $7
       WHERE id = $8`,
      [
        merged.brother_id,
        roundMoney(merged.amount),
        merged.received_at ?? null,
        merged.status,
        merged.released_at ?? null,
        merged.refund_cheque_number ?? null,
        merged.note ?? null,
        id,
      ]
    );
    // Only touch deductions when the caller sent them.
    if (payload.deductions !== undefined) {
      await replaceDeductions(client, id, payload.deductions);
    }
    await client.query("COMMIT");
    return res.status(200).json(await loadDeposit(id));
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function deleteHouseDeposit(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const { rowCount } = await pool.query(`DELETE FROM house_deposits WHERE id = $1`, [id]);
  if (!rowCount) {
    return res.status(404).json({ error: { message: "Deposit not found" } });
  }
  res.status(204).send();
}

module.exports = {
  listHousePayments,
  createHousePayment,
  updateHousePayment,
  deleteHousePayment,
  listHouseDeposits,
  createHouseDeposit,
  updateHouseDeposit,
  deleteHouseDeposit,
};
