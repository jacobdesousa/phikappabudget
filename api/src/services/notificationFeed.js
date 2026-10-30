const { pool } = require("../db/pool");
const { addDays, daysBetween, currentSchoolYearStart } = require("../utils/schoolYear");
const { formatSlotRange } = require("../utils/partyTime");
const { sessionTypeForDate } = require("../utils/houseFees");
const { duesCategoryForBrother } = require("../utils/pledgeClass");
const { isActiveInYear } = require("../utils/membership");
const {
  loadDuesPlanContext,
  loadDuesPaidByBrother,
  duesBalanceFor,
  instalmentsForCategory,
} = require("./duesBalance");
const { houseBalancesFor } = require("./houseBalance");
const { loadOutstandingMakeups } = require("./makeupQueries");
const { buildSchedule, loadSettings } = require("../controllers/choresController");
const { periodForDateWithNext } = require("../utils/chores");

// Everything that concerns one brother, in one shape.
//
// The page and (later) the reminder emails both read from here, which is the
// only way they can be guaranteed to agree. Items are derived on every request
// rather than stored: a shift that moves, a payment that lands or a makeup that
// gets completed should change the feed with no row to clean up. The one thing
// that IS stored is whether a brother has read an item — see notification_reads
// and the `key` field, which has to stay stable for that to mean anything.
//
// `asOf` is an explicit "YYYY-MM-DD" throughout. CURRENT_DATE would be the
// UTC server's idea of today, which after 8pm in Toronto is tomorrow.

const FEED_KINDS = ["dues_due", "house_fee_due", "shift", "workday", "chore_duty", "makeup"];

// Two weeks is what "upcoming" means here. The old 60-day shift horizon kept
// the badge permanently lit, which is the same as having no badge.
const HORIZON_DAYS = 14;
// Money looks further back than forward: an instalment that came due last month
// and is still short is more urgent than one due next week.
const MONEY_LOOKBACK_DAYS = 30;

function severityFor(daysUntil, { overdue = false } = {}) {
  if (overdue) return "urgent";
  if (daysUntil <= 3) return "warning";
  return "info";
}

// Cents only when there are cents: "$450" reads cleaner than "$450.00" in a
// one-line notification, and "$62.50" still has to be exact.
function money(amount) {
  const value = Number(amount);
  const whole = Math.abs(value % 1) < 0.005;
  return `$${value.toLocaleString("en-CA", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function capitalize(value) {
  const s = String(value ?? "").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// Instalment labels are free text in config ("1 of 4", "First", "Instalment 2"),
// so the word is only added when it isn't already there.
function instalmentLabel(label) {
  const text = String(label ?? "").trim();
  if (!text) return "";
  return /^instal?lment/i.test(text) ? capitalize(text) : `Instalment ${text}`;
}

async function shiftItems({ brotherIds, asOf, horizonEnd }) {
  const [assigned, partySlots] = await Promise.all([
    pool.query(
      `SELECT sa.brother_id, se.id, se.shift_type, se.event_date::text AS event_date, se.title
       FROM shift_assignments sa
       JOIN shift_events se ON se.id = sa.shift_event_id
       WHERE sa.brother_id = ANY($1::int[])
         AND se.event_date BETWEEN $2::date AND $3::date
         AND sa.status <> 'absent'
       ORDER BY se.event_date ASC`,
      [brotherIds, asOf, horizonEnd]
    ),
    // The party slot is the only place a brother's hour is recorded, so it is
    // read rather than EXISTS-tested — "Party" alone is not a useful reminder.
    pool.query(
      `SELECT sps.brother_id, sps.id AS slot_id, sps.slot_start, spd.name AS duty_name,
              se.id, se.shift_type, se.event_date::text AS event_date, se.title
       FROM shift_party_slots sps
       JOIN shift_events se ON se.id = sps.shift_event_id
       JOIN shift_party_duties spd ON spd.id = sps.duty_id
       WHERE sps.brother_id = ANY($1::int[])
         AND se.event_date BETWEEN $2::date AND $3::date
         AND sps.status <> 'absent'
       ORDER BY se.event_date ASC, sps.slot_start ASC`,
      [brotherIds, asOf, horizonEnd]
    ),
  ]);

  const items = [];
  const label = { setup: "Setup", cleanup: "Cleanup", party: "Party" };

  for (const r of assigned.rows) {
    const daysUntil = daysBetween(asOf, r.event_date);
    items.push({
      brother_id: Number(r.brother_id),
      kind: "shift",
      group: "activity",
      key: `shift:${r.shift_type}:${r.id}`,
      title: `${label[r.shift_type] ?? "Shift"} shift`,
      detail: r.title ?? null,
      date: r.event_date,
      days_until: daysUntil,
      severity: severityFor(daysUntil),
      amount: null,
      href: `/shifts/${r.id}`,
    });
  }

  for (const r of partySlots.rows) {
    const daysUntil = daysBetween(asOf, r.event_date);
    items.push({
      brother_id: Number(r.brother_id),
      kind: "shift",
      group: "activity",
      key: `shift:party:${r.id}:slot:${r.slot_id}`,
      title: "Party shift",
      detail: [r.title, `${r.duty_name}, ${formatSlotRange(r.slot_start)}`]
        .filter(Boolean)
        .join(" — "),
      date: r.event_date,
      days_until: daysUntil,
      severity: severityFor(daysUntil),
      amount: null,
      href: `/shifts/${r.id}`,
    });
  }

  return items;
}

async function workdayItems({ brotherIds, asOf, horizonEnd, brothers }) {
  const { rows } = await pool.query(
    `SELECT id, workday_date::text AS workday_date, title
     FROM workdays
     WHERE workday_date BETWEEN $1::date AND $2::date
     ORDER BY workday_date ASC`,
    [asOf, horizonEnd]
  );
  if (rows.length === 0) return [];

  // Attendance rows are created as "Missing" for everyone the moment a workday
  // is made, so they say nothing about who is expected. Everyone currently on
  // the roster is.
  const expected = brotherIds.filter((id) => {
    const status = brothers.get(id)?.status;
    return status === "Active" || status === "Pledge";
  });

  const items = [];
  for (const w of rows) {
    const daysUntil = daysBetween(asOf, w.workday_date);
    for (const brotherId of expected) {
      items.push({
        brother_id: brotherId,
        kind: "workday",
        group: "activity",
        key: `workday:${w.id}`,
        title: "Workday",
        detail: w.title ?? null,
        date: w.workday_date,
        days_until: daysUntil,
        severity: severityFor(daysUntil),
        amount: null,
        href: `/workdays/${w.id}`,
      });
    }
  }
  return items;
}

async function choreItems({ brotherIds, asOf }) {
  const settings = await loadSettings();
  const { current, next } = periodForDateWithNext(asOf, settings.split_day);
  const { periods } = await buildSchedule(current.start_date, next.start_date);

  const wanted = new Set(brotherIds);
  const items = [];

  for (const period of periods) {
    const isCurrent = period.start_date === current.start_date;
    const daysUntil = daysBetween(asOf, period.start_date);
    for (const entry of period.entries ?? []) {
      const brotherId = Number(entry.brother_id);
      if (!entry.brother_id || !wanted.has(brotherId)) continue;
      items.push({
        brother_id: brotherId,
        kind: "chore_duty",
        group: "activity",
        key: `chore:${period.start_date}:${entry.duty_no}:${entry.room_id}:${entry.bed}`,
        title: isCurrent ? "Chore duty this period" : "Chore duty next period",
        detail: [entry.duty_name, period.label].filter(Boolean).join(" — "),
        date: period.start_date,
        days_until: daysUntil,
        severity: isCurrent ? "warning" : "info",
        amount: null,
        href: "/chores",
      });
    }
  }
  return items;
}

async function makeupItems({ brotherIds, asOf }) {
  const { workday, shift, party } = await loadOutstandingMakeups({ asOf, brotherIds });
  const items = [];

  const push = (row, { kind, key, title, detail, date, href }) => {
    items.push({
      brother_id: Number(row.brother_id),
      kind: "makeup",
      group: "activity",
      key,
      title,
      detail: [detail, row.makeup_assignment ? `Assigned: ${row.makeup_assignment}` : null]
        .filter(Boolean)
        .join(" — "),
      date,
      days_until: daysBetween(asOf, date),
      // An absence you have not made up is outstanding whatever the date.
      severity: "urgent",
      amount: null,
      href,
    });
  };

  for (const r of workday) {
    push(r, {
      key: `makeup:workday:${r.id}`,
      title: "Makeup owed — Workday",
      detail: r.title ?? null,
      date: r.workday_date,
      href: "/makeups",
    });
  }
  for (const r of shift) {
    push(r, {
      key: `makeup:shift:${r.id}`,
      title: `Makeup owed — ${capitalize(r.shift_type)} shift`,
      detail: r.title ?? null,
      date: r.event_date,
      href: "/makeups",
    });
  }
  for (const r of party) {
    push(r, {
      key: `makeup:party:${r.id}`,
      title: "Makeup owed — Party shift",
      detail: [r.duty_name, formatSlotRange(r.slot_start)].filter(Boolean).join(", "),
      date: r.event_date,
      href: "/makeups",
    });
  }
  return items;
}

async function duesItems({ brotherIds, asOf, brothers }) {
  const year = currentSchoolYearStart();
  const ctx = await loadDuesPlanContext(year, asOf);
  if (!ctx) return [];

  const paid = await loadDuesPaidByBrother(year, brotherIds);
  const windowStart = addDays(asOf, -MONEY_LOOKBACK_DAYS);
  const windowEnd = addDays(asOf, HORIZON_DAYS);
  const items = [];

  for (const brotherId of brotherIds) {
    const brother = brothers.get(brotherId);
    if (!brother) continue;
    // Dues are owed by the active chapter. A category can be derived from any
    // brother's pledge class, so without this an alumnus gets reminders for
    // dues they were never billed.
    if (!isActiveInYear(brother, year)) continue;

    const balance = duesBalanceFor(brother, ctx, paid.get(brotherId));
    // Paid up for the year: nothing to say, even if an instalment is imminent.
    if (balance.balance_total <= 0) continue;

    const category = duesCategoryForBrother(brother.pledge_class, year);
    const schedule = instalmentsForCategory(ctx, category);

    for (const inst of schedule) {
      if (inst.due_date < windowStart || inst.due_date > windowEnd) continue;

      // Payments are one undifferentiated pool with no instalment allocation,
      // so "is this one paid" can only ever be cumulative. The wording has to
      // match that: outstanding to date, never "this instalment is unpaid".
      const cumulative = schedule
        .filter((i) => i.due_date <= inst.due_date)
        .reduce((sum, i) => sum + Number(i.amount), 0);
      const shortfall = cumulative - balance.total_paid;
      if (shortfall <= 0) continue;

      const daysUntil = daysBetween(asOf, inst.due_date);
      const overdue = daysUntil < 0;
      items.push({
        brother_id: brotherId,
        kind: "dues_due",
        group: "money",
        key: `dues:${year}:${inst.due_date}`,
        title: overdue ? "Dues outstanding" : "Dues instalment due",
        detail: [money(Math.min(shortfall, Number(inst.amount))), instalmentLabel(inst.label)]
          .filter(Boolean)
          .join(" — "),
        date: inst.due_date,
        days_until: daysUntil,
        severity: severityFor(daysUntil, { overdue }),
        amount: Math.min(shortfall, Number(inst.amount)),
        href: "/account",
      });
    }
  }
  return items;
}

async function houseItems({ brotherIds, asOf }) {
  const year = currentSchoolYearStart();
  const sessionType = sessionTypeForDate(asOf);
  const { ctx, balances } = await houseBalancesFor({ year, sessionType, asOf, brotherIds });
  if (balances.size === 0) return [];

  const windowStart = addDays(asOf, -MONEY_LOOKBACK_DAYS);
  const windowEnd = addDays(asOf, HORIZON_DAYS);
  const items = [];

  for (const entry of balances.values()) {
    if (entry.balance_total <= 0) continue;

    for (const inst of ctx.instalments) {
      if (!inst.due_date || inst.due_date < windowStart || inst.due_date > windowEnd) continue;

      // Percentages, not dollars — a resident's schedule only exists once their
      // own total is known.
      const cumulative = ctx.instalments
        .filter((i) => i.due_date && i.due_date <= inst.due_date)
        .reduce((sum, i) => sum + entry.total_owed * (Number(i.weight_pct) / 100), 0);
      const shortfall = cumulative - entry.total_paid;
      if (shortfall <= 0) continue;

      const instAmount = entry.total_owed * (Number(inst.weight_pct) / 100);
      const daysUntil = daysBetween(asOf, inst.due_date);
      const overdue = daysUntil < 0;
      items.push({
        brother_id: entry.brother_id,
        kind: "house_fee_due",
        group: "money",
        key: `house:${year}:${sessionType}:${inst.seq}`,
        title: overdue ? "Residence fees outstanding" : "Residence fee instalment due",
        detail: [
          money(Math.min(shortfall, instAmount)),
          `Instalment ${inst.seq} of ${ctx.instalments.length}`,
          entry.rooms.length ? `Room ${entry.rooms.join(", ")}` : null,
        ]
          .filter(Boolean)
          .join(" — "),
        date: inst.due_date,
        days_until: daysUntil,
        severity: severityFor(daysUntil, { overdue }),
        amount: Math.min(shortfall, instAmount),
        href: "/account",
      });
    }
  }
  return items;
}

/**
 * Latest date first, like any other feed — the newest thing is at the top and
 * older items fall away down the list. Severity is shown on the row rather than
 * used to sort, so an overdue item from last month sits at the bottom where its
 * date puts it. A stable key breaks ties so the order never jitters between
 * requests.
 */
function sortItems(items) {
  return items.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
}

/**
 * Items for many brothers at once. Bulk is the only implementation — the
 * digest needs it, and having the single-brother path go through the same code
 * is what stops the page and the email disagreeing.
 */
async function buildFeeds({ brotherIds, asOf, kinds = FEED_KINDS }) {
  const ids = (brotherIds ?? []).map(Number).filter(Number.isFinite);
  const result = new Map(ids.map((id) => [id, []]));
  if (ids.length === 0) return result;

  const horizonEnd = addDays(asOf, HORIZON_DAYS);
  const brothersRes = await pool.query(
    `SELECT id, first_name, last_name, pledge_class, status, alumni_date
     FROM brothers WHERE id = ANY($1::int[])`,
    [ids]
  );
  const brothers = new Map(brothersRes.rows.map((b) => [Number(b.id), b]));

  const wanted = new Set(kinds);
  const jobs = [];
  if (wanted.has("shift")) jobs.push(shiftItems({ brotherIds: ids, asOf, horizonEnd }));
  if (wanted.has("workday")) jobs.push(workdayItems({ brotherIds: ids, asOf, horizonEnd, brothers }));
  if (wanted.has("chore_duty")) jobs.push(choreItems({ brotherIds: ids, asOf }));
  if (wanted.has("makeup")) jobs.push(makeupItems({ brotherIds: ids, asOf }));
  if (wanted.has("dues_due")) jobs.push(duesItems({ brotherIds: ids, asOf, brothers }));
  if (wanted.has("house_fee_due")) jobs.push(houseItems({ brotherIds: ids, asOf }));

  // One source failing should not blank the whole feed — a missing dues plan
  // for the year is a configuration gap, not a reason to hide someone's shifts.
  const settled = await Promise.allSettled(jobs);
  for (const outcome of settled) {
    if (outcome.status === "rejected") {
      console.error("[notifications] feed source failed:", outcome.reason?.message ?? outcome.reason);
      continue;
    }
    for (const item of outcome.value) {
      const bucket = result.get(item.brother_id);
      if (bucket) bucket.push(item);
    }
  }

  for (const [id, items] of result) result.set(id, sortItems(items));
  return result;
}

/** One brother, with their read state applied. */
async function buildFeed(brotherId, { asOf, kinds } = {}) {
  if (!brotherId) return [];
  const feeds = await buildFeeds({ brotherIds: [brotherId], asOf, kinds });
  const items = feeds.get(Number(brotherId)) ?? [];
  if (items.length === 0) return items;

  const { rows } = await pool.query(
    `SELECT item_key, read_at FROM notification_reads
     WHERE brother_id = $1 AND item_key = ANY($2::text[])`,
    [brotherId, items.map((i) => i.key)]
  );
  const readAt = new Map(rows.map((r) => [r.item_key, r.read_at]));

  return items.map((item) => ({
    ...item,
    read: readAt.has(item.key),
    read_at: readAt.get(item.key) ?? null,
  }));
}

module.exports = { buildFeeds, buildFeed, FEED_KINDS, HORIZON_DAYS };
