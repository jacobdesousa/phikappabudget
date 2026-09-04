const { z } = require("zod");

const emptyToNull = (v) => (v === "" ? null : v);

// A partial patch: an absent key is left alone, an explicit null clears the
// column. Cleared dates are how a makeup gets moved back to outstanding.
const makeupUpdateSchema = z.object({
  makeup_completed_at: z
    .preprocess(emptyToNull, z.union([z.string(), z.date()]).nullable())
    .optional(),
  makeup_assignment: z.string().max(2000).nullable().optional(),
});

module.exports = { makeupUpdateSchema };
