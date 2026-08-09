const { z } = require("zod");
const { toE164 } = require("../utils/phone");

// Blanks are absences, not values: the UI submits empty strings for fields the
// user hasn't filled in, and the controllers turn undefined back into NULL.
//
// This has to run *inside* the preprocess, with `.optional()` on the inner
// schema. Written the other way round — `.preprocess(...).optional()` — the
// outer optional only short-circuits on undefined, so an empty string still
// reaches the inner validator and 400s with "Required".
const blankToUndefined = (v) => (v === "" || v === null || v === undefined ? undefined : v);

// The DB allows nulls for all of these; first/last name stay required and the
// rest are relaxed to avoid hard 400s mid-edit.
const brotherSchema = z.object({
  last_name: z.string().min(1),
  first_name: z.string().min(1),
  email: z.preprocess(blankToUndefined, z.string().email().optional()),
  // Normalised to E.164 so every write path — form, CSV import — stores one
  // canonical shape.
  phone: z.preprocess(
    (v) => (blankToUndefined(v) === undefined ? undefined : toE164(v)),
    z.string().optional()
  ),
  pledge_class: z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(/^(Fall|Spring) \d{4}$/, 'pledge_class must be "Fall YYYY" or "Spring YYYY"')
      .optional()
  ),
  graduation: z.preprocess(blankToUndefined, z.coerce.number().optional()),
  status: z.preprocess(blankToUndefined, z.string().optional()),
});

module.exports = { brotherSchema };
