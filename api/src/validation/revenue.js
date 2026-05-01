const { z } = require("zod");

const revenueCategorySchema = z.object({
  name: z.string().min(1),
});

const revenueCreateSchema = z
  .object({
  date: z.union([z.string(), z.date()]),
  description: z.string().min(1),
  category_id: z.coerce.number().int().positive(),
  cash_amount: z.coerce.number().optional().default(0),
  square_amount: z.coerce.number().optional().default(0),
  etransfer_amount: z.coerce.number().optional().default(0),
  // Backwards-compat: if old clients send `amount`, treat it as cash.
  amount: z.coerce.number().optional(),
})
  .transform((v) => {
  const cash = v.cash_amount ?? 0;
  const square = v.square_amount ?? 0;
  const etransfer = v.etransfer_amount ?? 0;
  const legacy = v.amount ?? 0;

  const hasBreakdown =
    v.cash_amount !== undefined ||
    v.square_amount !== undefined ||
    v.etransfer_amount !== undefined;

  const nextCash = hasBreakdown ? cash : legacy;
  const total = Number(nextCash) + Number(square) + Number(etransfer);

  return {
    date: v.date,
    description: v.description,
    category_id: v.category_id,
    cash_amount: Number(nextCash),
    square_amount: Number(square),
    etransfer_amount: Number(etransfer),
    amount: Number(total),
  };
});

const revenueUpdateSchema = z
  .object({
    date: z.union([z.string(), z.date()]).optional(),
    description: z.string().min(1).optional(),
    category_id: z.coerce.number().int().positive().optional(),
    cash_amount: z.coerce.number().optional(),
    square_amount: z.coerce.number().optional(),
    etransfer_amount: z.coerce.number().optional(),
    // Backwards-compat: allow updating via `amount` (treated as cash if no breakdown fields provided).
    amount: z.coerce.number().optional(),
  })
  .strict();

module.exports = { revenueCategorySchema, revenueCreateSchema, revenueUpdateSchema };



