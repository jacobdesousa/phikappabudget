const { pool } = require("../db/pool");

// Per-year category availability, shared by revenue and expenses. The two
// ledgers had already grown two copies of the same category CRUD; this is the
// half that would otherwise become a third and fourth.
//
// A category's identity is global and permanent — entries point at it, budget
// allocations key on it, and the budget's year-over-year comparison joins on it
// — so "which categories does 2026-27 offer" is a separate list rather than a
// duplicated category row per year.
const KINDS = {
  expense: {
    categoryTable: "expense_categories",
    yearTable: "expense_category_years",
    entryTable: "expenses",
    allocationTable: "budget_expense_allocations",
  },
  revenue: {
    categoryTable: "revenue_categories",
    yearTable: "revenue_category_years",
    entryTable: "revenue",
    allocationTable: "budget_revenue_allocations",
  },
};

const MISC_CATEGORY_NAME = "Misc";

function kindConfig(kind) {
  const cfg = KINDS[kind];
  if (!cfg) throw new Error(`Unknown category kind: ${kind}`);
  return cfg;
}

// The categories a year offers, for pickers. Misc is always included: it is the
// fallback every orphaned entry lands in, so a year without it has nowhere to
// put one.
async function listForYear(kind, schoolYear) {
  const { categoryTable, yearTable } = kindConfig(kind);
  const { rows } = await pool.query(
    `SELECT c.*
     FROM ${categoryTable} c
     WHERE c.name = $2 OR EXISTS (
       SELECT 1 FROM ${yearTable} y
       WHERE y.category_id = c.id AND y.school_year = $1
     )
     ORDER BY c.name ASC`,
    [schoolYear, MISC_CATEGORY_NAME]
  );
  return rows;
}

// Every category, each flagged with whether the given year offers it, plus what
// it is carrying that year. The config page needs all three to tell the
// treasurer what removing one would actually do.
async function listWithYearState(kind, schoolYear) {
  const { categoryTable, yearTable, entryTable, allocationTable } = kindConfig(kind);
  const { rows } = await pool.query(
    `SELECT
       c.*,
       (y.category_id IS NOT NULL)                     AS in_year,
       COALESCE(e.entry_count, 0)::int                 AS entry_count,
       COALESCE(e.entry_total, 0)                      AS entry_total,
       COALESCE(a.budgeted_amount, 0)                  AS budgeted_amount
     FROM ${categoryTable} c
     LEFT JOIN ${yearTable} y
       ON y.category_id = c.id AND y.school_year = $1
     LEFT JOIN (
       SELECT category_id, COUNT(*) AS entry_count, SUM(amount) AS entry_total
       FROM ${entryTable} WHERE school_year = $1 GROUP BY category_id
     ) e ON e.category_id = c.id
     LEFT JOIN ${allocationTable} a
       ON a.category_id = c.id AND a.school_year = $1
     ORDER BY c.name ASC`,
    [schoolYear]
  );
  return rows;
}

async function addToYear(kind, categoryId, schoolYear) {
  const { yearTable } = kindConfig(kind);
  await pool.query(
    `INSERT INTO ${yearTable} (school_year, category_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [schoolYear, categoryId]
  );
}

// Removing a category from one year moves that year's entries to Misc, exactly
// as deleting it outright moves all of them. Money is never dropped, only
// relabelled, and other years keep the category untouched.
//
// The year's budgeted amount goes with the allocation row. That leaves the
// year's budgeted total visibly short, which is deliberate: it is the
// treasurer's cue to re-budget rather than a number quietly moved somewhere it
// was never typed.
async function removeFromYear(kind, categoryId, schoolYear, ensureMiscId) {
  const { yearTable, entryTable, allocationTable } = kindConfig(kind);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const miscId = await ensureMiscId(client);
    if (Number(miscId) === Number(categoryId)) {
      throw Object.assign(new Error("misc"), { code: "MISC_PROTECTED" });
    }
    const moved = await client.query(
      `UPDATE ${entryTable} SET category_id = $1 WHERE category_id = $2 AND school_year = $3`,
      [miscId, categoryId, schoolYear]
    );
    await client.query(
      `DELETE FROM ${allocationTable} WHERE category_id = $1 AND school_year = $2`,
      [categoryId, schoolYear]
    );
    await client.query(
      `DELETE FROM ${yearTable} WHERE category_id = $1 AND school_year = $2`,
      [categoryId, schoolYear]
    );
    await client.query("COMMIT");
    return { reassigned: moved.rowCount };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// Copy a year's category list onto another year — the usual way a new year
// starts, since the list rarely changes much. Additive: anything already
// offered in the target year stays.
async function importFromYear(kind, fromYear, toYear) {
  const { yearTable } = kindConfig(kind);
  const { rowCount } = await pool.query(
    `INSERT INTO ${yearTable} (school_year, category_id)
     SELECT $2, category_id FROM ${yearTable} WHERE school_year = $1
     ON CONFLICT DO NOTHING`,
    [fromYear, toYear]
  );
  return { imported: rowCount };
}

// The years that have any category list at all, newest first — what the config
// page offers as import sources.
async function yearsWithCategories(kind) {
  const { yearTable } = kindConfig(kind);
  const { rows } = await pool.query(
    `SELECT DISTINCT school_year FROM ${yearTable} ORDER BY school_year DESC`
  );
  return rows.map((r) => Number(r.school_year));
}

module.exports = {
  MISC_CATEGORY_NAME,
  listForYear,
  listWithYearState,
  addToYear,
  removeFromYear,
  importFromYear,
  yearsWithCategories,
};
