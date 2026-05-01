const { z } = require("zod");

const expenseCategorySchema = z.object({
  name: z.string().min(1),
});

const expenseStatusSchema = z.enum(["submitted", "approved", "paid", "rejected"]);

const expenseCreateSchema = z.object({
  date: z.union([z.string(), z.date()]),
  description: z.string().min(1),
  category_id: z.coerce.number().int().positive(),
  amount: z.coerce.number(),
  // Brother to reimburse (optional, but supported).
  reimburse_brother_id: z.coerce.number().int().positive().optional().nullable(),
  cheque_number: z.string().max(50).optional().nullable(),
});

const expenseUpdateSchema = z
  .object({
    date: z.union([z.string(), z.date()]).optional(),
    description: z.string().min(1).optional(),
    category_id: z.coerce.number().int().positive().optional(),
    amount: z.coerce.number().optional(),
    reimburse_brother_id: z.coerce.number().int().positive().optional().nullable(),
    cheque_number: z.string().max(50).optional().nullable(),
    status: expenseStatusSchema.optional(),
  })
  .strict();

const expenseSubmissionSchema = z.object({
  // Public submission form: keep this simple and user-friendly.
  // Either provide a brother id (preferred) OR a freeform name.
  submitter_brother_id: z.coerce.number().int().positive().optional().nullable(),
  submitter_name: z.string().min(1).max(200).optional(),
  // Category is optional at submission time; treasurer can fill during review.
  category_id: z.coerce.number().int().positive().optional().nullable(),
  amount: z.coerce.number(),
  date: z.union([z.string(), z.date()]).optional(),
  description: z.string().min(1).max(500).optional(),
}).refine((v) => Boolean(v.submitter_brother_id) || Boolean(v.submitter_name?.trim()), {
  message: "Submitter is required",
  path: ["submitter_name"],
});

const expenseDisbursementSchema = z.object({
  cheque_number: z.string().min(1).max(50),
  expense_ids: z.array(z.coerce.number().int().positive()).min(1),
});

module.exports = {
  expenseCategorySchema,
  expenseStatusSchema,
  expenseCreateSchema,
  expenseUpdateSchema,
  expenseSubmissionSchema,
  expenseDisbursementSchema,
};


