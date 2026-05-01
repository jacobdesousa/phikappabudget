const { z } = require("zod");

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM");

const bonusDeductionCreateSchema = z.object({
  month: monthSchema,
  // If omitted, backend can compute from configured rule tiers.
  amount: z.coerce.number().positive().optional(),
  violation_type: z.string().min(1).max(200),
  comments: z.string().max(2000).optional().nullable(),
});

const bonusRuleTierSchema = z.object({
  tier_number: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive(),
});

const bonusRuleUpsertSchema = z.object({
  violation_type: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  tiers: z.array(bonusRuleTierSchema).min(1),
});

module.exports = { monthSchema, bonusDeductionCreateSchema, bonusRuleUpsertSchema };


