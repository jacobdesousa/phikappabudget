const { pool } = require("../db/pool");
const { idParamSchema } = require("../validation/common");
const { bonusRuleUpsertSchema, monthSchema } = require("../validation/chapterBonus");
const { roundMoney } = require("../utils/money");

async function listBonusRules(req, res) {
  const { rows } = await pool.query(
    `
      SELECT r.id, r.violation_type, r.description, r.created_at,
             t.id AS tier_id, t.tier_number, t.amount
      FROM chapter_bonus_violation_rules r
      LEFT JOIN chapter_bonus_violation_rule_tiers t ON t.rule_id = r.id
      ORDER BY r.violation_type ASC, t.tier_number ASC
    `
  );

  const byId = new Map();
  for (const row of rows) {
    if (!byId.has(row.id)) {
      byId.set(row.id, {
        id: row.id,
        violation_type: row.violation_type,
        description: row.description,
        created_at: row.created_at,
        tiers: [],
      });
    }
    if (row.tier_id) {
      byId.get(row.id).tiers.push({
        id: row.tier_id,
        tier_number: row.tier_number,
        amount: Number(row.amount),
      });
    }
  }

  return res.status(200).json(Array.from(byId.values()));
}

async function upsertBonusRule(req, res) {
  const payload = bonusRuleUpsertSchema.parse(req.body);
  const tiers = payload.tiers
    .map((t) => ({ tier_number: t.tier_number, amount: roundMoney(t.amount) }))
    .sort((a, b) => a.tier_number - b.tier_number);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ruleRes = await client.query(
      `
        INSERT INTO chapter_bonus_violation_rules (violation_type, description)
        VALUES ($1, $2)
        ON CONFLICT (violation_type) DO UPDATE
          SET description = EXCLUDED.description
        RETURNING id
      `,
      [payload.violation_type, payload.description ?? null]
    );
    const ruleId = ruleRes.rows[0].id;

    await client.query("DELETE FROM chapter_bonus_violation_rule_tiers WHERE rule_id = $1", [ruleId]);

    for (const t of tiers) {
      await client.query(
        `
          INSERT INTO chapter_bonus_violation_rule_tiers (rule_id, tier_number, amount)
          VALUES ($1, $2, $3)
        `,
        [ruleId, t.tier_number, t.amount]
      );
    }

    await client.query("COMMIT");
    return res.status(200).json({ ok: true, id: ruleId });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function deleteBonusRule(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const result = await pool.query("DELETE FROM chapter_bonus_violation_rules WHERE id = $1", [id]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: { message: "Rule not found" } });
  }
  return res.status(204).send();
}

async function previewBonusPenalty(req, res) {
  const month = monthSchema.parse(String(req.query.month));
  const violationTypeRaw = String(req.query.violation_type ?? "").trim();
  if (!violationTypeRaw) {
    return res.status(400).json({ error: { message: "violation_type is required" } });
  }

  // Count existing violations this month (same type)
  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS count FROM chapter_bonus_deductions WHERE month = $1 AND violation_type = $2`,
    [month, violationTypeRaw]
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
    [violationTypeRaw]
  );

  if (tiersRes.rows.length === 0) {
    return res.status(404).json({ error: { message: "No configured rule for this violation type." } });
  }

  const tiers = tiersRes.rows.map((r) => ({ tier_number: Number(r.tier_number), amount: Number(r.amount) }));
  const maxTier = Math.max(...tiers.map((t) => t.tier_number));
  const targetTier = Math.min(occurrenceNumber, maxTier);
  const tier = tiers.find((t) => t.tier_number === targetTier) ?? tiers[tiers.length - 1];

  return res.status(200).json({
    month,
    violation_type: violationTypeRaw,
    occurrence_number: occurrenceNumber,
    amount: roundMoney(Number(tier.amount)),
  });
}

module.exports = { listBonusRules, upsertBonusRule, deleteBonusRule, previewBonusPenalty };


