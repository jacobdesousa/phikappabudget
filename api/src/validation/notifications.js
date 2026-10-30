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

// Each switch is optional, so the UI can send just the one that changed.
const prefsUpdateSchema = z
  .object({
    all: z.boolean().optional(),
    weekly_digest: z.boolean().optional(),
    dues_due: z.boolean().optional(),
    house_fee_due: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

const jobRunSchema = z.object({
  // Pretending it is another day is how T-14 and T-7 get tested without waiting.
  as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dry_run: z.boolean().optional(),
  brother_id: z.coerce.number().int().positive().optional(),
  // Overrides the configured set, so dues can be rehearsed while still off.
  kinds: z.array(z.enum(["dues_due", "house_fee_due"])).optional(),
});

module.exports = { markReadSchema, previewQuerySchema, prefsUpdateSchema, jobRunSchema };
