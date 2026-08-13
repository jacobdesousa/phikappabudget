const { z } = require("zod");

// The UI clears a field by sending "" or null, and both mean "absent". The
// `.optional()` has to sit *inside* the preprocess: written the other way round
// the outer optional only short-circuits on undefined, so a blank still reaches
// the inner validator and 400s with "Required". Same trap as
// validation/brothers.js.
const emptyToUndefined = (v) => (v === "" || v === null ? undefined : v);

const optionalText = z.preprocess(emptyToUndefined, z.string().optional());
const optionalInt = z.preprocess(emptyToUndefined, z.coerce.number().int().optional());
const optionalMoney = z.preprocess(emptyToUndefined, z.coerce.number().optional());
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");
const optionalDate = z.preprocess(emptyToUndefined, dateString.optional());
const yearSchema = z.coerce.number().int().min(2000).max(3000);

const KINDS = ["bond", "general"];

const listQuerySchema = z.object({
  brother_id: optionalInt,
  campaign_id: optionalInt,
  year: yearSchema.optional(),
  kind: z.enum(KINDS).optional(),
  // Donations pinned to no campaign, for the catch-all row.
  no_campaign: z.preprocess((v) => (v === "true" || v === true ? true : undefined), z.boolean().optional()),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const brotherParamSchema = z.object({
  brotherId: z.coerce.number().int().positive(),
});

// What the entry form posts: one gift, which the server splits between the
// brother's outstanding bond and a general donation. `bond_amount` is the
// override for the proposed split; absent means "use the whole outstanding
// bond balance". `apply_to_bond: false` is the exception case — a gift the
// house has decided not to count against the bond at all.
const donationEntrySchema = z.object({
  brother_id: z.coerce.number().int().positive(),
  donated_on: dateString,
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  campaign_id: optionalInt,
  note: optionalText,
  apply_to_bond: z.coerce.boolean().default(true),
  bond_amount: optionalMoney,
  school_year: yearSchema.optional(),
});

// Editing touches one stored row, not the original gift, so the split is not
// recomputed here — `kind` is set explicitly.
const donationUpdateSchema = z
  .object({
    donated_on: dateString.optional(),
    amount: z.coerce.number().positive().optional(),
    kind: z.enum(KINDS).optional(),
    campaign_id: optionalInt,
    note: optionalText,
    school_year: z.preprocess(emptyToUndefined, yearSchema.optional()),
  })
  .strip();

const bondUpdateSchema = z.object({
  bond_price: z.coerce.number().min(0),
  opened_on: optionalDate,
  // The certificate number, usually not known until the bond is paid off.
  bond_number: z.preprocess(emptyToUndefined, z.string().max(50).optional()),
  notes: optionalText,
});

const campaignSchema = z
  .object({
    // Absent on a campaign the config page just added.
    id: optionalInt,
    name: z.string().min(1).max(120),
    description: optionalText,
    starts_on: optionalDate,
    ends_on: optionalDate,
    goal_amount: optionalMoney,
    is_active: z.coerce.boolean().default(true),
    sort_order: optionalInt,
  })
  .superRefine((val, ctx) => {
    if (val.starts_on && val.ends_on && val.ends_on < val.starts_on) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ends_on"],
        message: "End date is before the start date",
      });
    }
  });

// The whole config in one payload, saved in one transaction.
const donationConfigUpsertSchema = z.object({
  bond_price: z.coerce.number().min(0),
  campaigns: z.array(campaignSchema).default([]),
});

module.exports = {
  KINDS,
  listQuerySchema,
  brotherParamSchema,
  donationEntrySchema,
  donationUpdateSchema,
  bondUpdateSchema,
  donationConfigUpsertSchema,
};
