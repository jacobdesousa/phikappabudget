const { z } = require("zod");

const emptyToUndefined = (v) => (v === "" ? undefined : v);

// Notes:
// - The DB schema allows nulls for most of these TEXT fields.
// - The UI can submit empty strings while a user is filling in the form.
// - We keep first/last name required, and relax the rest to avoid hard 400s.
const brotherSchema = z.object({
  last_name: z.string().min(1),
  first_name: z.string().min(1),
  email: z.preprocess(emptyToUndefined, z.string().email()).optional().nullable(),
  phone: z.preprocess(emptyToUndefined, z.string()).optional().nullable(),
  pledge_class: z.preprocess(emptyToUndefined, z.string()).optional().nullable(),
  graduation: z
    .preprocess(emptyToUndefined, z.coerce.number())
    .optional()
    .nullable(),
  status: z.preprocess(emptyToUndefined, z.string()).optional().nullable(),
});

module.exports = { brotherSchema };



