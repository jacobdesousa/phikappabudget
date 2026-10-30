const { z } = require("zod");

// Keys come straight back from the feed, so they are opaque here — validating
// their grammar would mean two places to change every time a kind is added.
const markReadSchema = z.object({
  keys: z.array(z.string().min(1).max(200)).min(1).max(500),
  // Absent means "mark read"; false is how a row is put back to unread.
  read: z.boolean().optional(),
});

const previewQuerySchema = z.object({
  brother_id: z.coerce.number().int().positive(),
  as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

module.exports = { markReadSchema, previewQuerySchema };
