const { pool } = require("../db/pool");
const { idParamSchema } = require("../validation/common");
const { bonusDeductionCreateSchema, monthSchema } = require("../validation/chapterBonus");
const { roundMoney } = require("../utils/money");

async function computePenaltyAmount(month, violationType) {
  // Count existing deductions of this type in the month, then select tier.
  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS count FROM chapter_bonus_deductions WHERE month = $1 AND violation_type = $2`,
    [month, violationType]
  );
  const occurrenceNumber = Number(countRes.rows[0]?.count ?? 0) + 1;

  const tiersRes = await pool.query(
    `
      SELECT t.tier_number, t.amount
      FROM chapter_bonus_violation_rules r
      JOIN chapter_bonus_violation_rule_tiers t ON t.rule_id = r.id
      WHERE r.violation_type = $1
      ORDER BY t.tier_number ASC
    `,
    [violationType]
  );
  if (tiersRes.rows.length === 0) return null;

  const tiers = tiersRes.rows.map((r) => ({ tier_number: Number(r.tier_number), amount: Number(r.amount) }));
  const maxTier = Math.max(...tiers.map((t) => t.tier_number));
  const targetTier = Math.min(occurrenceNumber, maxTier);
  const tier = tiers.find((t) => t.tier_number === targetTier) ?? tiers[tiers.length - 1];
  return roundMoney(Number(tier.amount));
}

async function listBonusDeductions(req, res) {
  const month = req.query.month ? monthSchema.parse(String(req.query.month)) : null;
  const params = [];
  let where = "";
  if (month) {
    params.push(month);
    where = "WHERE month = $1";
  }

  const { rows } = await pool.query(
    `
      SELECT id, month, amount, violation_type, comments, photo_url, created_at
      FROM chapter_bonus_deductions
      ${where}
      ORDER BY created_at DESC, id DESC
    `,
    params
  );
  return res.status(200).json(rows);
}

async function bonusMonthSummary(req, res) {
  const month = monthSchema.parse(String(req.query.month));
  const { rows } = await pool.query(
    `
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM chapter_bonus_deductions
      WHERE month = $1
    `,
    [month]
  );
  return res.status(200).json({ month, total: roundMoney(Number(rows[0]?.total ?? 0)) });
}

async function createBonusDeduction(req, res) {
  const payload = bonusDeductionCreateSchema.parse(req.body);

  const photoUrl = req.file ? `/uploads/chapter-bonus/${req.file.filename}` : null;
  const computed = payload.amount ? roundMoney(payload.amount) : await computePenaltyAmount(payload.month, payload.violation_type);
  if (!computed) {
    return res.status(400).json({
      error: {
        message:
          "No configured penalty for this violation type. Add a rule in Chapter Bonus Config or provide an explicit amount.",
      },
    });
  }

  const { rows } = await pool.query(
    `
      INSERT INTO chapter_bonus_deductions (month, amount, violation_type, comments, photo_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [payload.month, computed, payload.violation_type, payload.comments ?? null, photoUrl]
  );

  return res.status(201).json({ id: rows[0].id });
}

async function deleteBonusDeduction(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const result = await pool.query("DELETE FROM chapter_bonus_deductions WHERE id = $1", [id]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: { message: "Deduction not found" } });
  }
  return res.status(204).send();
}

module.exports = { listBonusDeductions, bonusMonthSummary, createBonusDeduction, deleteBonusDeduction };


