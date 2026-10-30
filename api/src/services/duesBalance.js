const { pool } = require("../db/pool");
const { duesCategoryForBrother } = require("../utils/pledgeClass");

// What a brother owes in dues, and when.
//
// This was inline in duesPaymentsSummary, which is a roster-wide endpoint
// behind a permission. The notifications feed needs the same arithmetic for one
// person, and a scheduled job has no request to hang a permission off, so the
// maths lives here and the endpoint became a caller.
//
// `asOf` is an explicit "YYYY-MM-DD" everywhere rather than new Date(): the
// jobs run on a UTC box, where "today" after 8pm Toronto is already tomorrow.

/** The year's plan and schedule, plus how much of it has come due by `asOf`. */
async function loadDuesPlanContext(year, asOf) {
  const [plansRes, instRes] = await Promise.all([
    pool.query("SELECT year, category, total_amount FROM dues_plan_categories WHERE year = $1", [year]),
    pool.query(
      `SELECT category, label, due_date::text AS due_date, amount
       FROM dues_plan_category_instalments
       WHERE year = $1
       ORDER BY due_date ASC`,
      [year]
    ),
  ]);

  const plans = Object.fromEntries(plansRes.rows.map((r) => [r.category, r]));
  if (!plans.regular || !plans.neophyte) return null;

  const instalments = instRes.rows;
  const dueToDateByCategory = instalments.reduce((acc, r) => {
    if (r.due_date <= asOf) {
      acc[r.category] = (acc[r.category] ?? 0) + Number(r.amount);
    }
    return acc;
  }, {});

  return { year, plans, instalments, dueToDateByCategory };
}

/** Payments so far, keyed by brother. Pass `brotherIds` to narrow it. */
async function loadDuesPaidByBrother(year, brotherIds = null) {
  const values = [year];
  let filter = "";
  if (brotherIds) {
    values.push(brotherIds);
    filter = `AND brother_id = ANY($${values.length}::int[])`;
  }

  const { rows } = await pool.query(
    `SELECT brother_id,
            COALESCE(SUM(amount), 0) AS total_paid,
            COUNT(id) AS payment_count,
            MAX(paid_at) AS last_paid_at
     FROM dues_payments
     WHERE dues_year = $1 ${filter}
     GROUP BY brother_id`,
    values
  );

  return new Map(rows.map((r) => [Number(r.brother_id), r]));
}

/**
 * One brother's position. `brother` needs id, first_name, last_name and
 * pledge_class — the category is derived from the pledge class, not stored.
 */
function duesBalanceFor(brother, ctx, agg) {
  const brotherId = Number(brother.id);
  const category = duesCategoryForBrother(brother.pledge_class, ctx.year);
  const totalOwed = Number(ctx.plans[category].total_amount);
  const dueToDate = Number(ctx.dueToDateByCategory[category] ?? 0);
  const totalPaid = Number(agg?.total_paid ?? 0);

  return {
    brother_id: brotherId,
    first_name: brother.first_name,
    last_name: brother.last_name,
    pledge_class: brother.pledge_class,
    dues_category: category,
    total_paid: totalPaid,
    payment_count: Number(agg?.payment_count ?? 0),
    last_paid_at: agg?.last_paid_at ?? null,
    year: ctx.year,
    total_owed: totalOwed,
    due_to_date: dueToDate,
    balance_total: totalOwed - totalPaid,
    balance_due_to_date: dueToDate - totalPaid,
    is_behind: dueToDate - totalPaid > 0,
  };
}

/** The instalments for a category, in date order — the feed names the next one. */
function instalmentsForCategory(ctx, category) {
  return ctx.instalments.filter((i) => i.category === category);
}

module.exports = {
  loadDuesPlanContext,
  loadDuesPaidByBrother,
  duesBalanceFor,
  instalmentsForCategory,
};
