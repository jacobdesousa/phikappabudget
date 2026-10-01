const { z } = require("zod");

// Kinds are open-ended on write (an un-tagged sender lands as "other"), so the
// filter does not constrain them to a list that would go stale.
const emailLogQuerySchema = z.object({
  kind: z.string().trim().min(1).max(60).optional(),
  status: z.enum(["pending", "sent", "failed", "dev"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

module.exports = { emailLogQuerySchema };
