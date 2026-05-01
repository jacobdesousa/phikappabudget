const { z } = require("zod");

const dateLike = z.union([z.string(), z.date()]).nullable().optional();

const duesUpdateSchema = z.object({
  id: z.coerce.number().int().positive(),
  first_instalment_date: dateLike,
  first_instalment_amount: z.coerce.number().optional(),
  second_instalment_date: dateLike,
  second_instalment_amount: z.coerce.number().optional(),
  third_instalment_date: dateLike,
  third_instalment_amount: z.coerce.number().optional(),
  fourth_instalment_date: dateLike,
  fourth_instalment_amount: z.coerce.number().optional(),
});

module.exports = { duesUpdateSchema };



