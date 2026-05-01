const { pool } = require("../db/pool");
const { monthSchema } = require("../validation/chapterBonus");
const { roundMoney } = require("../utils/money");

function parseRate(n) {
  return roundMoney(Number(n ?? 0));
}

// Defaults used when a month has no saved config yet.
// These should match the Chapter Bonus UI expectations.
const DEFAULT_RATES = {
  active_present_rate: 25,
  active_late_rate: 20,
  active_coveralls_rate: 30,
  active_coveralls_nametag_rate: 35,
  pledge_present_rate: 20,
  pledge_late_rate: 10,
};

async function getWorkdayRates(req, res) {
  const month = monthSchema.parse(String(req.query.month));
  const { rows } = await pool.query(
    `
      SELECT
        month,
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
  const row = rows[0];
  if (!row) {
    return res.status(200).json({
      month,
      active_present_rate: DEFAULT_RATES.active_present_rate,
      active_late_rate: DEFAULT_RATES.active_late_rate,
      active_coveralls_rate: DEFAULT_RATES.active_coveralls_rate,
      active_coveralls_nametag_rate: DEFAULT_RATES.active_coveralls_nametag_rate,
      pledge_present_rate: DEFAULT_RATES.pledge_present_rate,
      pledge_late_rate: DEFAULT_RATES.pledge_late_rate,
    });
  }
  return res.status(200).json({
    month,
    active_present_rate: parseRate(row.active_present_rate ?? DEFAULT_RATES.active_present_rate),
    active_late_rate: parseRate(row.active_late_rate ?? DEFAULT_RATES.active_late_rate),
    active_coveralls_rate: parseRate(row.active_coveralls_rate ?? DEFAULT_RATES.active_coveralls_rate),
    active_coveralls_nametag_rate: parseRate(row.active_coveralls_nametag_rate ?? DEFAULT_RATES.active_coveralls_nametag_rate),
    pledge_present_rate: parseRate(row.pledge_present_rate ?? DEFAULT_RATES.pledge_present_rate),
    pledge_late_rate: parseRate(row.pledge_late_rate ?? DEFAULT_RATES.pledge_late_rate),
  });
}

async function upsertWorkdayRates(req, res) {
  const month = monthSchema.parse(String(req.query.month));
  const active_present_rate = parseRate(req.body?.active_present_rate);
  const active_late_rate = parseRate(req.body?.active_late_rate);
  const active_coveralls_rate = parseRate(req.body?.active_coveralls_rate);
  const active_coveralls_nametag_rate = parseRate(req.body?.active_coveralls_nametag_rate);
  const pledge_present_rate = parseRate(req.body?.pledge_present_rate);
  const pledge_late_rate = parseRate(req.body?.pledge_late_rate);

  await pool.query(
    `
      INSERT INTO chapter_bonus_workday_rates (
        month,
        active_present_rate,
        active_late_rate,
        active_coveralls_rate,
        active_coveralls_nametag_rate,
        pledge_present_rate,
        pledge_late_rate,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
      ON CONFLICT (month) DO UPDATE
        SET active_present_rate = EXCLUDED.active_present_rate,
            active_late_rate = EXCLUDED.active_late_rate,
            active_coveralls_rate = EXCLUDED.active_coveralls_rate,
            active_coveralls_nametag_rate = EXCLUDED.active_coveralls_nametag_rate,
            pledge_present_rate = EXCLUDED.pledge_present_rate,
            pledge_late_rate = EXCLUDED.pledge_late_rate,
            updated_at = NOW()
    `,
    [
      month,
      active_present_rate,
      active_late_rate,
      active_coveralls_rate,
      active_coveralls_nametag_rate,
      pledge_present_rate,
      pledge_late_rate,
    ]
  );

  return res.status(200).json({ ok: true });
}

module.exports = { getWorkdayRates, upsertWorkdayRates };


