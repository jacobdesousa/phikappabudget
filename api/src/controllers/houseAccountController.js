// Residence fees sit in a bank account separate from the social budget. This
// controller covers what happens to that account: the derived balance, the
// periodic disbursements that split it between the housing corporation and the
// chapter, and the odds and ends (bank fees, corrections) that fit nowhere else.
//
// The only bridge back into the social budget is postDisbursementRevenue —
// nothing else here writes to `revenue` or `expenses`.
const { pool } = require("../db/pool");
const { idParamSchema } = require("../validation/common");
const { schoolYearStartForDate, currentSchoolYearStart } = require("../utils/schoolYear");
const { sessionTypeForDate } = require("../utils/houseFees");
const { roundMoney } = require("../utils/money");
const {
  yearSessionQuerySchema,
  disbursementCreateSchema,
  disbursementUpdateSchema,
  adjustmentCreateSchema,
  adjustmentUpdateSchema,
  transactionQuerySchema,
  postRevenueSchema,
} = require("../validation/house");

const REBATE_CATEGORY_NAME = "House Fee Rebate";

// sub_total is derived rather than stored: it is always the balance less both
// security lines, and storing it would let the two drift apart.
const DISBURSEMENT_SELECT = `
  SELECT d.id, d.school_year, d.session_type,
         d.disbursed_on::text AS disbursed_on,
         d.bank_balance, d.security_to_refund, d.security_on_account,
         (d.bank_balance - d.security_to_refund - d.security_on_account) AS sub_total,
         d.notes,
         COALESCE(
           (SELECT json_agg(json_build_object(
                     'id', s.id, 'payee', s.payee, 'pct', s.pct,
                     'amount', s.amount, 'cheque_number', s.cheque_number,
                     'revenue_id', s.revenue_id)
                   ORDER BY s.id)
            FROM house_disbursement_shares s WHERE s.disbursement_id = d.id),
           '[]'::json
         ) AS shares
  FROM house_disbursements d`;

// Ordering doubles as the running-total order, so it must be stable.
const DISBURSEMENT_ORDER = `ORDER BY d.disbursed_on ASC NULLS LAST, d.id ASC`;

async function loadDisbursement(id) {
  const { rows } = await pool.query(`${DISBURSEMENT_SELECT} WHERE d.id = $1`, [id]);
  return rows[0] ?? null;
}

// Splits a sub-total across payees by percentage. Largest-remainder so the
// shares always add back up to the sub-total exactly — a cent lost to rounding
// would show up as an unexplained residue in the account balance.
function splitShares(subTotal, payees) {
  const cents = Math.round(Number(subTotal) * 100);
  const exact = payees.map((p) => (cents * Number(p.pct)) / 100);
  const floors = exact.map((v) => Math.floor(v));
  let leftover = cents - floors.reduce((sum, v) => sum + v, 0);

  const byRemainder = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < byRemainder.length && leftover > 0; k += 1, leftover -= 1) {
    floors[byRemainder[k].i] += 1;
  }

  return payees.map((p, i) => ({ payee: p.payee, pct: Number(p.pct), amount: floors[i] / 100 }));
}

// The bank balance the treasurer types comes off the statement; the balance we
// derive comes from recorded payments, deposits and past disbursements. A gap
// between them is real money the system doesn't know about — interest, a bank
// fee, a payment nobody entered. Book the difference so the derived balance
// always reconciles to the statement, and label it clearly enough that someone
// can go find out what it was.
//
// Runs inside the caller's transaction, after the disbursement row exists and
// before its shares do.
async function reconcileBankBalance(client, disbursementId, enteredBalance, occurredOn) {
  await client.query(`DELETE FROM house_account_adjustments WHERE disbursement_id = $1`, [
    disbursementId,
  ]);

  const derived = await accountBalance({
    executor: client,
    excludeDisbursementId: disbursementId,
  });
  const delta = roundMoney(enteredBalance - derived.balance);
  if (delta === 0) return null;

  const { rows } = await client.query(
    `INSERT INTO house_account_adjustments
       (occurred_on, amount, description, school_year, disbursement_id)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, occurred_on::text AS occurred_on, amount, description, school_year,
               disbursement_id`,
    [
      occurredOn,
      delta,
      `Bank reconciliation — statement $${enteredBalance.toFixed(2)} vs recorded $${derived.balance.toFixed(2)}`,
      schoolYearStartForDate(occurredOn),
      disbursementId,
    ]
  );
  return rows[0];
}

// Cheque numbers arrive keyed by payee. Returns a lookup that yields null for
// a payee the caller didn't mention, so an absent entry clears nothing.
function chequeLookup(cheques) {
  const byPayee = new Map((cheques ?? []).map((c) => [c.payee, c.cheque_number ?? null]));
  return (payee) => byPayee.get(payee) ?? null;
}

// Running per-payee totals, the spreadsheet's "PKSAB Totals" / "TSPHC Totals"
// rows. Reset each school year, so the figure beside a disbursement is what
// that payee has received year to date — which is the number anyone reconciling
// a year actually wants. Rows arrive in date order, so a running tally keyed by
// year and payee is enough.
function attachRunningTotals(rows) {
  const totals = new Map();
  for (const row of rows) {
    for (const share of row.shares) {
      const key = `${row.school_year}|${share.payee}`;
      const next = roundMoney((totals.get(key) ?? 0) + Number(share.amount));
      totals.set(key, next);
      share.running_total = next;
    }
  }
  return rows;
}

// The two deposit lines on a disbursement, from live data. Every received
// deposit falls into exactly one of them, so the pair sums to the deposits
// actually sitting in the account and a disbursement can subtract both without
// double-counting:
//
//   to_refund — the resident's last session is behind us, so this money is on
//               its way back out.
//   held      — the resident is still in the house this session or a later one,
//               so the deposit stays put.
//
// Both are gross, so `to_refund + held` is always exactly the deposit money in
// the account. Deductions are deliberately ignored here: money withheld for
// damages does belong to the chapter, but it only becomes disbursable once the
// refund is actually processed and the deposit flips to `refunded` — at which
// point the account balance keeps the deducted portion on its own. Netting it
// off earlier would disburse money still sitting against an open deposit.
//
// "Later" is measured against today, not a session the user picked: the account
// page is a running ledger, so "still resident" has one true answer.
const SESSION_ORDINAL = `CASE WHEN a.session_type = 'winter' THEN 0 ELSE 1 END`;
const CURRENT_SESSION_ORDINAL = `CASE WHEN $2::text = 'winter' THEN 0 ELSE 1 END`;

async function securitySnapshot() {
  const now = new Date();
  const year = schoolYearStartForDate(now);
  const sessionType = sessionTypeForDate(now);

  const stillResident = `EXISTS (
    SELECT 1 FROM house_assignments a
    WHERE a.brother_id = dep.brother_id
      AND (a.school_year > $1
           OR (a.school_year = $1 AND ${SESSION_ORDINAL} >= ${CURRENT_SESSION_ORDINAL}))
  )`;

  const { rows } = await pool.query(
    `WITH dep AS (
       SELECT d.id, d.brother_id, d.amount
       FROM house_deposits d
       WHERE d.status = 'received'
     )
     SELECT
       COALESCE(SUM(amount) FILTER (WHERE NOT ${stillResident}), 0) AS to_refund,
       COALESCE(SUM(amount) FILTER (WHERE ${stillResident}), 0) AS held,
       COUNT(*) FILTER (WHERE NOT ${stillResident}) AS to_refund_count,
       COUNT(*) FILTER (WHERE ${stillResident}) AS held_count
     FROM dep`,
    [year, sessionType]
  );
  const r = rows[0];
  return {
    as_of_year: year,
    as_of_session: sessionType,
    to_refund: roundMoney(r.to_refund),
    held: roundMoney(r.held),
    to_refund_count: Number(r.to_refund_count),
    held_count: Number(r.held_count),
  };
}

// The balance is never stored. Note deposits count as an inflow whether they
// are still held or have since been refunded — the refund is subtracted
// separately, net of whatever was deducted.
// `exclude` omits one disbursement's own shares and its own reconciliation
// adjustment, which is what reconciling that disbursement has to measure
// against — otherwise it would be netting against its own effect.
async function accountBalance({ executor = pool, excludeDisbursementId = null } = {}) {
  const { rows } = await executor.query(
    `SELECT
       (SELECT COALESCE(SUM(amount), 0) FROM house_payments) AS payments_total,
       (SELECT COALESCE(SUM(amount), 0) FROM house_deposits
         WHERE status IN ('received', 'refunded')) AS deposits_in,
       (SELECT COALESCE(SUM(amount), 0) FROM house_deposits
         WHERE status = 'received') AS deposits_held,
       (SELECT COALESCE(SUM(GREATEST(d.amount - COALESCE(
                 (SELECT SUM(x.amount) FROM house_deposit_deductions x
                  WHERE x.deposit_id = d.id), 0), 0)), 0)
          FROM house_deposits d WHERE d.status = 'refunded') AS deposits_refunded,
       (SELECT COALESCE(SUM(s.amount), 0)
          FROM house_disbursement_shares s
         WHERE $1::int IS NULL OR s.disbursement_id <> $1) AS disbursed_total,
       (SELECT COALESCE(SUM(amount), 0) FROM house_account_adjustments
         WHERE $1::int IS NULL OR disbursement_id IS DISTINCT FROM $1)
         AS adjustments_total`,
    [excludeDisbursementId]
  );
  const r = rows[0];
  const payments_total = roundMoney(r.payments_total);
  const deposits_in = roundMoney(r.deposits_in);
  const deposits_held = roundMoney(r.deposits_held);
  const deposits_refunded = roundMoney(r.deposits_refunded);
  const disbursed_total = roundMoney(r.disbursed_total);
  const adjustments_total = roundMoney(r.adjustments_total);

  const balance = roundMoney(
    payments_total + deposits_in - deposits_refunded - disbursed_total + adjustments_total
  );

  return {
    payments_total,
    deposits_in,
    deposits_held,
    deposits_refunded,
    disbursed_total,
    adjustments_total,
    balance,
    // What could actually be disbursed today: deposits aren't the chapter's money.
    undisbursed_surplus: roundMoney(balance - deposits_held),
  };
}

async function listPayees(year) {
  const { rows } = await pool.query(
    `SELECT id, school_year, payee, pct, is_internal, sort_order
     FROM house_disbursement_payees
     WHERE school_year = $1
     ORDER BY sort_order ASC NULLS LAST, id ASC`,
    [year]
  );
  return rows;
}

async function loadAdjustments(year) {
  const filtered = year !== undefined && year !== null;
  const { rows } = await pool.query(
    `SELECT id, occurred_on::text AS occurred_on, amount, description, school_year,
            disbursement_id
     FROM house_account_adjustments
     ${filtered ? "WHERE school_year = $1" : ""}
     ORDER BY occurred_on ASC NULLS LAST, id ASC`,
    filtered ? [year] : []
  );
  return rows;
}

// ── Account overview ────────────────────────────────────────────────────────

// The account is one running ledger, not a per-session view: the balance was
// never year-scoped, and at roughly six disbursements a year the whole history
// is shorter than the effort of paging through it. Everything is returned, as
// of today, and the page groups it by school year.
async function getHouseAccount(req, res) {
  const currentYear = currentSchoolYearStart();

  const [balance, security, payees, allRes, adjustments] = await Promise.all([
    accountBalance(),
    securitySnapshot(),
    // Current config, for pricing a new disbursement. Historical rows carry
    // their own captured percentages.
    listPayees(currentYear),
    pool.query(`${DISBURSEMENT_SELECT} ${DISBURSEMENT_ORDER}`),
    loadAdjustments(),
  ]);

  res.status(200).json({
    current_year: currentYear,
    balance,
    security,
    payees,
    // Running totals restart each school year, so the column reconciles with
    // the rows under the same subheader.
    disbursements: attachRunningTotals(allRes.rows),
    adjustments,
  });
}

// ── Transactions ────────────────────────────────────────────────────────────

// Every movement of money through the residence account, derived rather than
// stored — the same five sources accountBalance() sums, unrolled into rows.
// The running balance is computed over the whole ledger in date order and only
// then paginated, so page 3 still shows true balances.
//
// A refunded deposit produces two rows: the money came in when it was received
// and went back out, net of deductions, when it was released.
const TRANSACTIONS_SQL = `
  WITH tx AS (
    SELECT 'payment'::text AS kind, p.id AS source_id,
           p.paid_at AS occurred_on,
           b.first_name || ' ' || b.last_name AS counterparty,
           p.memo AS detail, NULL::text AS cheque_number,
           p.amount AS amount
    FROM house_payments p
    JOIN brothers b ON b.id = p.brother_id

    UNION ALL

    SELECT 'deposit', d.id, d.received_at,
           b.first_name || ' ' || b.last_name, d.note, NULL,
           d.amount
    FROM house_deposits d
    JOIN brothers b ON b.id = d.brother_id
    WHERE d.status IN ('received', 'refunded') AND d.received_at IS NOT NULL

    UNION ALL

    SELECT 'deposit_refund', d.id, d.released_at,
           b.first_name || ' ' || b.last_name,
           CASE WHEN COALESCE(x.deductions, 0) > 0
                THEN 'less $' || to_char(x.deductions, 'FM999999990.00') || ' deductions'
                ELSE NULL END,
           d.refund_cheque_number,
           -GREATEST(d.amount - COALESCE(x.deductions, 0), 0)
    FROM house_deposits d
    JOIN brothers b ON b.id = d.brother_id
    LEFT JOIN (
      SELECT deposit_id, SUM(amount) AS deductions
      FROM house_deposit_deductions GROUP BY deposit_id
    ) x ON x.deposit_id = d.id
    WHERE d.status = 'refunded' AND d.released_at IS NOT NULL

    UNION ALL

    SELECT 'disbursement', s.id, hd.disbursed_on,
           s.payee, NULL, s.cheque_number,
           -s.amount
    FROM house_disbursement_shares s
    JOIN house_disbursements hd ON hd.id = s.disbursement_id

    UNION ALL

    SELECT 'adjustment', a.id, a.occurred_on,
           NULL, a.description, NULL,
           a.amount
    FROM house_account_adjustments a
  ),
  ordered AS (
    SELECT tx.*,
           SUM(amount) OVER (
             ORDER BY occurred_on, kind, source_id
             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
           ) AS running_balance
    FROM tx
    WHERE occurred_on IS NOT NULL
  )
  SELECT occurred_on::text AS occurred_on, kind, source_id, counterparty, detail,
         cheque_number, amount, running_balance,
         COUNT(*) OVER () AS total_count
  FROM ordered
  ORDER BY occurred_on DESC, kind DESC, source_id DESC
  LIMIT $1 OFFSET $2`;

async function listTransactions(req, res) {
  const { limit, offset } = transactionQuerySchema.parse(req.query);

  const { rows } = await pool.query(TRANSACTIONS_SQL, [limit, offset]);
  res.status(200).json({
    limit,
    offset,
    total: rows.length ? Number(rows[0].total_count) : 0,
    transactions: rows.map((r) => ({
      kind: r.kind,
      source_id: Number(r.source_id),
      occurred_on: r.occurred_on,
      counterparty: r.counterparty,
      detail: r.detail,
      cheque_number: r.cheque_number,
      amount: roundMoney(r.amount),
      running_balance: roundMoney(r.running_balance),
    })),
  });
}

// ── Disbursements ───────────────────────────────────────────────────────────

async function listDisbursements(req, res) {
  const clauses = [];
  const params = [];
  if (req.query.year) {
    params.push(Number(req.query.year));
    clauses.push(`d.school_year = $${params.length}`);
  }
  if (req.query.session) {
    params.push(String(req.query.session));
    clauses.push(`d.session_type = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const { rows } = await pool.query(
    `${DISBURSEMENT_SELECT} ${where} ${DISBURSEMENT_ORDER}`,
    params
  );
  res.status(200).json(rows);
}

async function createDisbursement(req, res) {
  const payload = disbursementCreateSchema.parse(req.body);
  // The date the money moved decides which school year and session the
  // disbursement belongs to — there is nothing for the client to choose.
  const on = payload.disbursed_on ?? new Date();
  const schoolYear = payload.school_year ?? schoolYearStartForDate(on);
  const sessionType = payload.session_type ?? sessionTypeForDate(on);

  const payees = await listPayees(schoolYear);
  if (!payees.length) {
    return res.status(409).json({
      error: {
        message: `No disbursement payees configured for ${schoolYear}. Set the split on the House Config page first.`,
      },
    });
  }

  const bankBalance = roundMoney(payload.bank_balance);
  const toRefund = roundMoney(payload.security_to_refund);
  const onAccount = roundMoney(payload.security_on_account);
  const subTotal = roundMoney(bankBalance - toRefund - onAccount);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO house_disbursements
         (school_year, session_type, disbursed_on,
          bank_balance, security_to_refund, security_on_account, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        schoolYear,
        sessionType,
        payload.disbursed_on,
        bankBalance,
        toRefund,
        onAccount,
        payload.notes ?? null,
      ]
    );
    const id = rows[0].id;

    // Before the shares exist, so the reconciliation measures the account as it
    // stood when the statement was read.
    await reconcileBankBalance(client, id, bankBalance, payload.disbursed_on);

    // pct is copied onto the share so a later config change can't rewrite history.
    const chequeFor = chequeLookup(payload.cheques);
    for (const share of splitShares(subTotal, payees)) {
      await client.query(
        `INSERT INTO house_disbursement_shares
           (disbursement_id, payee, pct, amount, cheque_number)
         VALUES ($1,$2,$3,$4,$5)`,
        [id, share.payee, share.pct, share.amount, chequeFor(share.payee)]
      );
    }
    await client.query("COMMIT");
    return res.status(201).json(await loadDisbursement(id));
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function updateDisbursement(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const payload = disbursementUpdateSchema.parse(req.body);

  const existingRes = await pool.query(
    `SELECT *, disbursed_on::text AS disbursed_on FROM house_disbursements WHERE id = $1`,
    [id]
  );
  const existing = existingRes.rows[0];
  if (!existing) {
    return res.status(404).json({ error: { message: "Disbursement not found" } });
  }

  const merged = { ...existing, ...payload };
  // Moving the date moves which year and session it belongs to, unless the
  // caller pinned them explicitly.
  if (payload.disbursed_on && payload.school_year === undefined) {
    merged.school_year = schoolYearStartForDate(payload.disbursed_on);
  }
  if (payload.disbursed_on && payload.session_type === undefined) {
    merged.session_type = sessionTypeForDate(payload.disbursed_on);
  }

  const bankBalance = roundMoney(merged.bank_balance);
  const toRefund = roundMoney(merged.security_to_refund);
  const onAccount = roundMoney(merged.security_on_account);

  const figuresChanged =
    bankBalance !== roundMoney(existing.bank_balance) ||
    toRefund !== roundMoney(existing.security_to_refund) ||
    onAccount !== roundMoney(existing.security_on_account);

  const sharesRes = await pool.query(
    `SELECT id, payee, pct, revenue_id FROM house_disbursement_shares
     WHERE disbursement_id = $1 ORDER BY id ASC`,
    [id]
  );
  const posted = sharesRes.rows.filter((s) => s.revenue_id !== null);

  if (figuresChanged && posted.length) {
    return res.status(409).json({
      error: {
        message:
          "This disbursement has already been posted to revenue — the amounts can't be changed. Delete the revenue entry first.",
      },
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE house_disbursements SET
         school_year = $1, session_type = $2,
         disbursed_on = $3, bank_balance = $4,
         security_to_refund = $5, security_on_account = $6, notes = $7
       WHERE id = $8`,
      [
        merged.school_year,
        merged.session_type,
        merged.disbursed_on ?? null,
        bankBalance,
        toRefund,
        onAccount,
        merged.notes ?? null,
        id,
      ]
    );

    if (figuresChanged) {
      // Recompute from each share's stored pct, never from current config.
      const subTotal = roundMoney(bankBalance - toRefund - onAccount);
      const recomputed = splitShares(subTotal, sharesRes.rows);
      for (let i = 0; i < sharesRes.rows.length; i += 1) {
        await client.query(`UPDATE house_disbursement_shares SET amount = $1 WHERE id = $2`, [
          recomputed[i].amount,
          sharesRes.rows[i].id,
        ]);
      }
    }

    if (figuresChanged) {
      // Replaces this disbursement's own reconciliation rather than stacking a
      // second one; accountBalance excludes it while measuring.
      await reconcileBankBalance(client, id, bankBalance, merged.disbursed_on);
    }

    // Cheque numbers are independent of the amounts: they can be filled in
    // after the fact, and stay editable once the share is posted to revenue.
    if (payload.cheques !== undefined) {
      const chequeFor = chequeLookup(payload.cheques);
      for (const share of sharesRes.rows) {
        await client.query(
          `UPDATE house_disbursement_shares SET cheque_number = $1 WHERE id = $2`,
          [chequeFor(share.payee), share.id]
        );
      }
    }
    await client.query("COMMIT");
    return res.status(200).json(await loadDisbursement(id));
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function deleteDisbursement(req, res) {
  const { id } = idParamSchema.parse(req.params);

  const postedRes = await pool.query(
    `SELECT 1 FROM house_disbursement_shares
     WHERE disbursement_id = $1 AND revenue_id IS NOT NULL LIMIT 1`,
    [id]
  );
  if (postedRes.rowCount) {
    return res.status(409).json({
      error: {
        message:
          "This disbursement has been posted to revenue. Delete the revenue entry before removing it.",
      },
    });
  }

  const { rowCount } = await pool.query(`DELETE FROM house_disbursements WHERE id = $1`, [id]);
  if (!rowCount) {
    return res.status(404).json({ error: { message: "Disbursement not found" } });
  }
  res.status(204).send();
}

// Records the chapter's share as ordinary revenue, the same way Chapter Bonus
// actuals arrive. The budgeted figure stays a live computation in
// budgetController — this only supplies the actual.
async function postDisbursementRevenue(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const payload = postRevenueSchema.parse(req.body ?? {});

  const disbursement = await loadDisbursement(id);
  if (!disbursement) {
    return res.status(404).json({ error: { message: "Disbursement not found" } });
  }
  let payeeName = payload.payee;
  if (!payeeName) {
    const internalRes = await pool.query(
      `SELECT payee FROM house_disbursement_payees
       WHERE school_year = $1 AND is_internal = TRUE
       ORDER BY sort_order ASC NULLS LAST, id ASC LIMIT 1`,
      [disbursement.school_year]
    );
    payeeName = internalRes.rows[0]?.payee;
  }
  if (!payeeName) {
    return res.status(409).json({
      error: {
        message: `No internal payee is configured for ${disbursement.school_year}, so there is nothing to post.`,
      },
    });
  }

  const share = disbursement.shares.find((s) => s.payee === payeeName);
  if (!share) {
    return res
      .status(404)
      .json({ error: { message: `This disbursement has no share for ${payeeName}.` } });
  }
  if (share.revenue_id !== null) {
    return res
      .status(409)
      .json({ error: { message: `The ${payeeName} share has already been posted to revenue.` } });
  }

  const categoryRes = await pool.query(`SELECT id FROM revenue_categories WHERE name = $1`, [
    REBATE_CATEGORY_NAME,
  ]);
  const categoryId = categoryRes.rows[0]?.id;
  if (!categoryId) {
    return res
      .status(409)
      .json({ error: { message: `Revenue category "${REBATE_CATEGORY_NAME}" is missing.` } });
  }

  const date = payload.date ?? disbursement.disbursed_on ?? new Date();
  const amount = roundMoney(share.amount);
  const description =
    payload.description ??
    `${payeeName} share — house disbursement ${disbursement.disbursed_on}`;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const revenueRes = await client.query(
      `INSERT INTO revenue
         (date, description, category_id, cash_amount, square_amount, etransfer_amount,
          amount, school_year)
       VALUES ($1,$2,$3,0,0,$4,$4,$5)
       RETURNING id`,
      [date, description, categoryId, amount, payload.school_year ?? schoolYearStartForDate(date)]
    );
    // Guarded on revenue_id so two concurrent posts can't both win.
    const linked = await client.query(
      `UPDATE house_disbursement_shares SET revenue_id = $1
       WHERE id = $2 AND revenue_id IS NULL`,
      [revenueRes.rows[0].id, share.id]
    );
    if (!linked.rowCount) {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ error: { message: `The ${payeeName} share has already been posted to revenue.` } });
    }
    await client.query("COMMIT");
    return res.status(200).json(await loadDisbursement(id));
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ── Adjustments ─────────────────────────────────────────────────────────────

async function listAdjustments(req, res) {
  const q = yearSessionQuerySchema.parse(req.query);
  const year = q.year ?? currentSchoolYearStart();
  res.status(200).json(await loadAdjustments(year));
}

async function createAdjustment(req, res) {
  const payload = adjustmentCreateSchema.parse(req.body);
  const schoolYear = payload.school_year ?? schoolYearStartForDate(payload.occurred_on);

  const { rows } = await pool.query(
    `INSERT INTO house_account_adjustments (occurred_on, amount, description, school_year)
     VALUES ($1,$2,$3,$4)
     RETURNING id, occurred_on::text AS occurred_on, amount, description, school_year`,
    [payload.occurred_on, roundMoney(payload.amount), payload.description ?? null, schoolYear]
  );
  res.status(201).json(rows[0]);
}

async function updateAdjustment(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const payload = adjustmentUpdateSchema.parse(req.body);

  const existingRes = await pool.query(
    `SELECT *, occurred_on::text AS occurred_on FROM house_account_adjustments WHERE id = $1`,
    [id]
  );
  const existing = existingRes.rows[0];
  if (!existing) {
    return res.status(404).json({ error: { message: "Adjustment not found" } });
  }

  const merged = { ...existing, ...payload };
  const { rows } = await pool.query(
    `UPDATE house_account_adjustments SET
       occurred_on = $1, amount = $2, description = $3, school_year = $4
     WHERE id = $5
     RETURNING id, occurred_on::text AS occurred_on, amount, description, school_year`,
    [
      merged.occurred_on,
      roundMoney(merged.amount),
      merged.description ?? null,
      merged.school_year,
      id,
    ]
  );
  res.status(200).json(rows[0]);
}

async function deleteAdjustment(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const { rowCount } = await pool.query(`DELETE FROM house_account_adjustments WHERE id = $1`, [id]);
  if (!rowCount) {
    return res.status(404).json({ error: { message: "Adjustment not found" } });
  }
  res.status(204).send();
}

module.exports = {
  getHouseAccount,
  listDisbursements,
  createDisbursement,
  updateDisbursement,
  deleteDisbursement,
  postDisbursementRevenue,
  listTransactions,
  listAdjustments,
  createAdjustment,
  updateAdjustment,
  deleteAdjustment,
};
