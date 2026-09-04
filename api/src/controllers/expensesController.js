const { pool } = require("../db/pool");
const { idParamSchema } = require("../validation/common");
const {
  expenseCategorySchema,
  expenseCreateSchema,
  expenseUpdateSchema,
  expenseSubmissionSchema,
  expenseDisbursementSchema,
} = require("../validation/expenses");
const { currentSchoolYearStart, schoolYearStartForDate } = require("../utils/schoolYear");
const { roundMoney } = require("../utils/money");
const { uploadToS3, streamFromS3 } = require("../utils/s3");
const { useS3, makeFilename } = require("../middleware/upload");

const MISC_CATEGORY_NAME = "Misc";

// The catch-all every orphaned entry lands in. Created on demand so a database
// that predates the seed still gets one.
async function ensureMiscCategoryId(client) {
  const q = client ?? pool;
  const found = await q.query("SELECT id FROM expense_categories WHERE name = $1", [
    MISC_CATEGORY_NAME,
  ]);
  if (found.rows[0]) return found.rows[0].id;
  const created = await q.query(
    "INSERT INTO expense_categories (name) VALUES ($1) RETURNING id",
    [MISC_CATEGORY_NAME]
  );
  return created.rows[0].id;
}

async function listExpenseCategories(req, res) {
  const { rows } = await pool.query("SELECT * FROM expense_categories ORDER BY name ASC");
  return res.status(200).json(rows);
}

async function createExpenseCategory(req, res) {
  const payload = expenseCategorySchema.parse(req.body);
  const result = await pool.query(
    "INSERT INTO expense_categories (name) VALUES ($1) RETURNING *",
    [payload.name]
  );
  return res.status(201).json(result.rows[0]);
}

async function updateExpenseCategory(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const payload = expenseCategorySchema.parse(req.body);
  const result = await pool.query(
    "UPDATE expense_categories SET name = $1 WHERE id = $2 RETURNING *",
    [payload.name, id]
  );
  if (!result.rows[0]) {
    return res.status(404).json({ error: { message: "Category not found" } });
  }
  return res.status(200).json(result.rows[0]);
}

// Deleting a category never deletes money. Any entries still pointing at it are
// moved to the Misc catch-all first, so the totals on the budget page are
// unchanged by the delete.
async function deleteExpenseCategory(req, res) {
  const { id } = idParamSchema.parse(req.params);

  const existingRes = await pool.query("SELECT name FROM expense_categories WHERE id = $1", [id]);
  const existing = existingRes.rows[0];
  if (!existing) {
    return res.status(404).json({ error: { message: "Category not found" } });
  }
  if (existing.name === MISC_CATEGORY_NAME) {
    return res.status(409).json({
      error: { message: `"${MISC_CATEGORY_NAME}" is the fallback category and can't be deleted.` },
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const miscId = await ensureMiscCategoryId(client);
    const moved = await client.query(
      "UPDATE expenses SET category_id = $1 WHERE category_id = $2",
      [miscId, id]
    );
    await client.query("DELETE FROM expense_categories WHERE id = $1", [id]);
    await client.query("COMMIT");
    return res.status(200).json({ reassigned: moved.rowCount, reassigned_to: MISC_CATEGORY_NAME });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function listExpenses(req, res) {
  const yearRaw = req.query.year;
  const year = yearRaw ? Number(yearRaw) : currentSchoolYearStart();

  const { rows } = await pool.query(
    `
      SELECT
        e.*,
        ec.name as category_name,
        b.first_name as reimburse_first_name,
        b.last_name as reimburse_last_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON ec.id = e.category_id
      LEFT JOIN brothers b ON b.id = e.reimburse_brother_id
      WHERE ($1::int IS NULL OR e.school_year = $1::int)
      ORDER BY e.date DESC, e.id DESC
    `,
    [Number.isFinite(year) ? year : null]
  );
  return res.status(200).json(rows);
}

// A treasurer entering an expense directly can only create it in a settled
// state: the normal one awaiting a cheque, or "recorded" for spend that will
// never have one. The submission and review statuses belong to the brother-
// facing flow and are not settable here.
function creationStatus(requested) {
  return requested === "recorded" ? "recorded" : "approved";
}

async function createExpense(req, res) {
  const payload = expenseCreateSchema.parse(req.body);
  // An explicit filing year wins; otherwise the date settles it.
  const schoolYear = payload.school_year ?? schoolYearStartForDate(payload.date);
  const amount = roundMoney(payload.amount);
  const status = creationStatus(payload.status);

  // Nothing is owed on a recorded expense, so it carries no cheque and no
  // brother even if the client sent them.
  const recorded = status === "recorded";

  const result = await pool.query(
    `
      INSERT INTO expenses
        (date, description, category_id, amount, reimburse_brother_id, cheque_number, school_year, status, approved_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *
    `,
    [
      payload.date,
      payload.description,
      payload.category_id,
      amount,
      recorded ? null : payload.reimburse_brother_id ?? null,
      recorded ? null : payload.cheque_number ?? null,
      schoolYear,
      status,
    ]
  );

  const row = result.rows[0];
  const joined = await pool.query(
    `
      SELECT
        e.*,
        ec.name as category_name,
        b.first_name as reimburse_first_name,
        b.last_name as reimburse_last_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON ec.id = e.category_id
      LEFT JOIN brothers b ON b.id = e.reimburse_brother_id
      WHERE e.id = $1
    `,
    [row.id]
  );
  return res.status(201).json(joined.rows[0]);
}

async function resolveReceiptUrl(file) {
  if (useS3) {
    const filename = makeFilename(file);
    return uploadToS3({ key: `receipts/${filename}`, buffer: file.buffer, contentType: file.mimetype });
  }
  return `/uploads/receipts/${file.filename}`;
}

async function createExpenseWithReceipt(req, res) {
  // Treasurer/manual entry with receipt attached (multipart/form-data with `receipt`).
  if (!req.file) {
    return res.status(400).json({ error: { message: "Receipt file is required." } });
  }
  const payload = expenseCreateSchema.parse(req.body);
  const schoolYear = payload.school_year ?? schoolYearStartForDate(payload.date);
  const amount = roundMoney(payload.amount);
  const receiptUrl = await resolveReceiptUrl(req.file);
  const status = creationStatus(payload.status);
  const recorded = status === "recorded";

  const result = await pool.query(
    `
      INSERT INTO expenses
        (date, description, category_id, amount, reimburse_brother_id, cheque_number, school_year, status, approved_at, receipt_url)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
      RETURNING *
    `,
    [
      payload.date,
      payload.description,
      payload.category_id,
      amount,
      recorded ? null : payload.reimburse_brother_id ?? null,
      recorded ? null : payload.cheque_number ?? null,
      schoolYear,
      status,
      receiptUrl,
    ]
  );

  const row = result.rows[0];
  const joined = await pool.query(
    `
      SELECT
        e.*,
        ec.name as category_name,
        b.first_name as reimburse_first_name,
        b.last_name as reimburse_last_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON ec.id = e.category_id
      LEFT JOIN brothers b ON b.id = e.reimburse_brother_id
      WHERE e.id = $1
    `,
    [row.id]
  );

  return res.status(201).json(joined.rows[0]);
}

async function updateExpense(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const patch = expenseUpdateSchema.parse(req.body);

  const existingRes = await pool.query("SELECT * FROM expenses WHERE id = $1", [id]);
  const existing = existingRes.rows[0];
  if (!existing) {
    return res.status(404).json({ error: { message: "Expense not found" } });
  }

  const nextDate = patch.date !== undefined ? patch.date : existing.date;

  // An explicit school_year wins. Failing that, a caller that sends a new date
  // gets the entry re-filed from it — the intuitive way to correct one. An edit
  // that touches neither keeps the filing as-is, so an unrelated change can't
  // quietly undo a deliberate override by re-deriving from the date.
  const schoolYear =
    patch.school_year !== undefined
      ? patch.school_year
      : patch.date !== undefined || existing.school_year === null
        ? schoolYearStartForDate(nextDate)
        : Number(existing.school_year);

  const nextStatus = patch.status !== undefined ? patch.status : existing.status;
  // Same rule as creation: a recorded expense owes nobody, so switching to it
  // clears the disbursement fields rather than leaving stale ones behind.
  const recorded = nextStatus === "recorded";

  const next = {
    date: nextDate,
    description: patch.description !== undefined ? patch.description : existing.description,
    category_id: patch.category_id !== undefined ? patch.category_id : existing.category_id,
    amount: roundMoney(patch.amount !== undefined ? patch.amount : existing.amount),
    reimburse_brother_id: recorded
      ? null
      : patch.reimburse_brother_id !== undefined
        ? patch.reimburse_brother_id
        : existing.reimburse_brother_id,
    cheque_number: recorded
      ? null
      : patch.cheque_number !== undefined
        ? patch.cheque_number
        : existing.cheque_number,
    school_year: schoolYear,
    status: nextStatus,
    approved_at:
      patch.status === "approved" && existing.status !== "approved"
        ? new Date()
        : existing.approved_at,
    paid_at:
      patch.status === "paid" && existing.status !== "paid"
        ? new Date()
        : existing.paid_at,
  };

  const updatedRes = await pool.query(
    `
      UPDATE expenses
      SET date = $1,
          description = $2,
          category_id = $3,
          amount = $4,
          reimburse_brother_id = $5,
          cheque_number = $6,
          school_year = $7,
          status = $8,
          approved_at = $9,
          paid_at = $10
      WHERE id = $11
      RETURNING *
    `,
    [
      next.date,
      next.description,
      next.category_id,
      next.amount,
      next.reimburse_brother_id ?? null,
      next.cheque_number ?? null,
      next.school_year,
      next.status ?? "approved",
      next.approved_at ?? null,
      next.paid_at ?? null,
      id,
    ]
  );

  const joined = await pool.query(
    `
      SELECT
        e.*,
        ec.name as category_name,
        b.first_name as reimburse_first_name,
        b.last_name as reimburse_last_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON ec.id = e.category_id
      LEFT JOIN brothers b ON b.id = e.reimburse_brother_id
      WHERE e.id = $1
    `,
    [updatedRes.rows[0].id]
  );
  return res.status(200).json(joined.rows[0]);
}

async function deleteExpense(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const result = await pool.query("DELETE FROM expenses WHERE id = $1", [id]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: { message: "Expense not found" } });
  }
  return res.status(204).send();
}

async function submitExpense(req, res) {
  // This is a public endpoint that accepts a receipt upload (multer).
  const payload = expenseSubmissionSchema.parse(req.body);
  if (!req.file) {
    return res.status(400).json({ error: { message: "Receipt file is required." } });
  }

  let submitterName = payload.submitter_name?.trim();
  let reimburseBrotherId = null;

  if (payload.submitter_brother_id) {
    const broRes = await pool.query(
      "SELECT id, first_name, last_name FROM brothers WHERE id = $1",
      [payload.submitter_brother_id]
    );
    const bro = broRes.rows[0];
    if (bro) {
      submitterName = `${bro.first_name} ${bro.last_name}`.trim();
      reimburseBrotherId = Number(bro.id);
    }
  }

  if (!submitterName) {
    return res.status(400).json({ error: { message: "Submitter name is required." } });
  }

  const date = payload.date ?? new Date();
  const schoolYear = schoolYearStartForDate(date);
  const amount = roundMoney(payload.amount);
  const description =
    payload.description?.trim() || `Submitted expense (${submitterName})`;

  const receiptUrl = await resolveReceiptUrl(req.file);

  const result = await pool.query(
    `
      INSERT INTO expenses
        (date, description, category_id, amount, school_year, status, submitted_by_name, receipt_url, submitted_at, reimburse_brother_id)
      VALUES
        ($1, $2, $3, $4, $5, 'submitted', $6, $7, NOW(), $8)
      RETURNING *
    `,
    [
      date,
      description,
      payload.category_id ?? null,
      amount,
      schoolYear,
      submitterName,
      receiptUrl,
      reimburseBrotherId,
    ]
  );

  const row = result.rows[0];
  const joined = await pool.query(
    `
      SELECT
        e.*,
        ec.name as category_name,
        b.first_name as reimburse_first_name,
        b.last_name as reimburse_last_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON ec.id = e.category_id
      LEFT JOIN brothers b ON b.id = e.reimburse_brother_id
      WHERE e.id = $1
    `,
    [row.id]
  );

  return res.status(201).json(joined.rows[0]);
}

async function approveExpense(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const existingRes = await pool.query("SELECT * FROM expenses WHERE id = $1", [id]);
  const existing = existingRes.rows[0];
  if (!existing) {
    return res.status(404).json({ error: { message: "Expense not found" } });
  }
  if (!existing.category_id) {
    return res.status(400).json({
      error: { message: "Cannot approve: missing category." },
    });
  }
  if (!existing.reimburse_brother_id) {
    return res.status(400).json({
      error: { message: "Cannot approve: missing brother to reimburse." },
    });
  }

  await pool.query(
    "UPDATE expenses SET status = 'approved', approved_at = NOW() WHERE id = $1",
    [id]
  );
  return res.status(200).json({ ok: true });
}

async function getOutstandingDisbursements(req, res) {
  const year = req.query.year ? Number(req.query.year) : currentSchoolYearStart();

  // Only approved and unpaid (no cheque number yet)
  const expensesRes = await pool.query(
    `
      SELECT
        e.*,
        ec.name as category_name,
        b.first_name as reimburse_first_name,
        b.last_name as reimburse_last_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON ec.id = e.category_id
      LEFT JOIN brothers b ON b.id = e.reimburse_brother_id
      WHERE e.school_year = $1
        AND e.status = 'approved'
        AND (e.cheque_number IS NULL OR e.cheque_number = '')
      ORDER BY e.date ASC, e.id ASC
    `,
    [year]
  );

  const rows = expensesRes.rows;
  const total = rows.reduce((acc, r) => acc + Number(r.amount ?? 0), 0);
  const byBrother = new Map();
  for (const r of rows) {
    const bid = r.reimburse_brother_id ? Number(r.reimburse_brother_id) : null;
    if (!bid) continue;
    const key = bid;
    const prev = byBrother.get(key) ?? {
      brother_id: bid,
      first_name: r.reimburse_first_name ?? "",
      last_name: r.reimburse_last_name ?? "",
      total: 0,
      count: 0,
    };
    prev.total += Number(r.amount ?? 0);
    prev.count += 1;
    byBrother.set(key, prev);
  }

  return res.status(200).json({
    year,
    total,
    by_brother: Array.from(byBrother.values()).sort(
      (a, b) => (a.last_name || "").localeCompare(b.last_name || "")
    ),
    expenses: rows,
  });
}

async function disburseExpenses(req, res) {
  const payload = expenseDisbursementSchema.parse(req.body);
  const chequeNumber = payload.cheque_number.trim();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock selected expenses
    const expRes = await client.query(
      `SELECT * FROM expenses WHERE id = ANY($1::int[]) FOR UPDATE`,
      [payload.expense_ids]
    );
    if (expRes.rowCount !== payload.expense_ids.length) {
      return res.status(400).json({ error: { message: "One or more expenses not found." } });
    }

    // Validate they are eligible
    for (const e of expRes.rows) {
      if (e.status !== "approved") {
        return res.status(400).json({
          error: { message: "All disbursed expenses must be approved." },
        });
      }
      if (e.cheque_number) {
        return res.status(400).json({
          error: { message: "All disbursed expenses must be unpaid (no cheque number yet)." },
        });
      }
      if (!e.reimburse_brother_id) {
        return res.status(400).json({
          error: { message: "All disbursed expenses must have a brother to reimburse." },
        });
      }
    }

    const updateRes = await client.query(
      `
        UPDATE expenses
        SET cheque_number = $1,
            status = 'paid',
            paid_at = NOW()
        WHERE id = ANY($2::int[])
      `,
      [chequeNumber, payload.expense_ids]
    );

    await client.query("COMMIT");
    return res.status(200).json({ ok: true, updated: updateRes.rowCount });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function attachExpenseReceipt(req, res) {
  const { id } = idParamSchema.parse(req.params);
  if (!req.file) {
    return res.status(400).json({ error: { message: "Receipt file is required." } });
  }
  const receiptUrl = await resolveReceiptUrl(req.file);

  const existingRes = await pool.query("SELECT * FROM expenses WHERE id = $1", [id]);
  const existing = existingRes.rows[0];
  if (!existing) {
    return res.status(404).json({ error: { message: "Expense not found" } });
  }

  await pool.query("UPDATE expenses SET receipt_url = $1 WHERE id = $2", [receiptUrl, id]);

  const joined = await pool.query(
    `
      SELECT
        e.*,
        ec.name as category_name,
        b.first_name as reimburse_first_name,
        b.last_name as reimburse_last_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON ec.id = e.category_id
      LEFT JOIN brothers b ON b.id = e.reimburse_brother_id
      WHERE e.id = $1
    `,
    [id]
  );
  return res.status(200).json(joined.rows[0]);
}

async function rejectExpense(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const existingRes = await pool.query("SELECT * FROM expenses WHERE id = $1", [id]);
  const existing = existingRes.rows[0];
  if (!existing) {
    return res.status(404).json({ error: { message: "Expense not found" } });
  }
  if (existing.status !== "submitted") {
    return res.status(400).json({ error: { message: "Only submitted expenses can be rejected." } });
  }
  await pool.query("UPDATE expenses SET status = 'rejected' WHERE id = $1", [id]);
  return res.status(200).json({ ok: true });
}

module.exports = {
  listExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  listExpenses,
  createExpense,
  createExpenseWithReceipt,
  updateExpense,
  deleteExpense,
  submitExpense,
  approveExpense,
  rejectExpense,
  getOutstandingDisbursements,
  disburseExpenses,
  attachExpenseReceipt,
};


