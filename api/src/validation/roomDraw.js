const { z } = require("zod");
const { idParamSchema } = require("./common");

const legacyAdjustmentSchema = z.object({
  brother_id: z.coerce.number().int().positive(),
  points: z.coerce.number(),
  reason: z.string().min(1, "Reason is required"),
});

module.exports = { legacyAdjustmentSchema, idParamSchema };
