const { z } = require("zod");

const dateLike = z.union([z.string(), z.date()]);

const duesPaymentCreateSchema = z.object({
  brother_id: z.coerce.number().int().positive(),
  paid_at: dateLike,
  amount: z.coerce.number(),
  memo: z.string().max(500).optional().nullable(),
  dues_year: z.coerce.number().int().min(2000).max(3000).optional().nullable(),
});

const duesPaymentUpdateSchema = z
  .object({
    paid_at: dateLike.optional(),
    amount: z.coerce.number().optional(),
    memo: z.string().max(500).optional().nullable(),
  })
  .refine((v) => v.paid_at !== undefined || v.amount !== undefined || v.memo !== undefined, {
    message: "At least one field must be provided",
  });

module.exports = { duesPaymentCreateSchema, duesPaymentUpdateSchema };


