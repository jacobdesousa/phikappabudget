const { z } = require("zod");

const voteCreateSchema = z.object({
  question: z.string().min(1).max(500),
  options: z.array(z.string().min(1).max(200)).min(2, "At least 2 options required"),
  allow_multiple: z.boolean().default(false),
  is_anonymous: z.boolean().default(false),
});

const voteRespondSchema = z.object({
  option_ids: z.array(z.coerce.number().int().positive()).min(1, "Select at least one option"),
});

module.exports = { voteCreateSchema, voteRespondSchema };
