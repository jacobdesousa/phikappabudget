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
  // A second address, common on the alumni records.
  email_secondary: z.preprocess(blankToUndefined, z.string().email().optional()),
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
      // Historic records often name only the year — the semester was not kept.
      // Everything that reads a semester out of this treats a bare year as
      // "unknown semester" (see utils/pledgeClass.js parsePledgeClass).
      .regex(
        /^((Fall|Spring) \d{4}|\d{4})$/,
        'pledge_class must be "Fall YYYY", "Spring YYYY", or "YYYY"'
      )
      .optional()
  ),
  graduation: z.preprocess(blankToUndefined, z.coerce.number().optional()),
  status: z.preprocess(blankToUndefined, z.string().optional()),

  // Home address. Optional throughout — the roster mostly has none, and the
  // alumni import it came from has gaps. No shape is enforced: these are
  // international, and a rejected postal code would block a whole record.
  address_line1: z.preprocess(blankToUndefined, z.string().max(200).optional()),
  address_line2: z.preprocess(blankToUndefined, z.string().max(200).optional()),
  city: z.preprocess(blankToUndefined, z.string().max(120).optional()),
  province: z.preprocess(blankToUndefined, z.string().max(120).optional()),
  postal_code: z.preprocess(blankToUndefined, z.string().max(20).optional()),
  country: z.preprocess(blankToUndefined, z.string().max(120).optional()),
});

// The optional contact columns, in the order the INSERT and UPDATE list them.
const ADDRESS_FIELDS = [
  "email_secondary",
  "address_line1",
  "address_line2",
  "city",
  "province",
  "postal_code",
  "country",
];

module.exports = { brotherSchema, ADDRESS_FIELDS };
