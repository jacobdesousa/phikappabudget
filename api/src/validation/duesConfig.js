const { z } = require("zod");

const instalmentSchema = z.object({
  label: z.string().max(100).optional().nullable(),
  due_date: z.union([z.string(), z.date()]),
  amount: z.coerce.number(),
});

const planSchema = z.object({
  total_amount: z.coerce.number(),
  instalments: z.array(instalmentSchema).min(1),
});

// Legacy shape (single plan) -> treated as the "regular" plan.
const legacyDuesPlanUpsertSchema = z.object({
  year: z.coerce.number().int().min(2000).max(3000),
  total_amount: z.coerce.number(),
  instalments: z.array(instalmentSchema).min(1),
});

// New shape: regular + neophyte plans per school-year
const duesPlanUpsertSchema = z.object({
  year: z.coerce.number().int().min(2000).max(3000),
  regular: planSchema,
  neophyte: planSchema,
});

const duesPlanUpsertSchemaCompat = z.union([
  duesPlanUpsertSchema,
  legacyDuesPlanUpsertSchema,
]);

module.exports = { duesPlanUpsertSchema, duesPlanUpsertSchemaCompat };


