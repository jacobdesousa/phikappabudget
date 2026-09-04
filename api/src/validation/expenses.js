const { z } = require("zod");

const expenseCategorySchema = z.object({
  name: z.string().min(1),
});

// "recorded" is a terminal state alongside "paid": the money left the account
// but no cheque is coming — a direct debit, a card charge, a correction, a
// reimbursement a brother waived. Without it the only way to settle an expense
// was to cut a cheque, so anything paid another way sat in the disbursement
// queue forever.
const expenseStatusSchema = z.enum(["submitted", "approved", "paid", "rejected", "recorded"]);

// The statuses that mean real money against the budget. Kept here so the
// budget queries and the expenses page cannot drift apart.
const SETTLED_EXPENSE_STATUSES = ["approved", "paid", "recorded"];

const expenseCreateSchema = z.object({
  date: z.union([z.string(), z.date()]),
  description: z.string().min(1),
  category_id: z.coerce.number().int().positive(),
  amount: z.coerce.number(),
  // Brother to reimburse (optional, but supported).
  reimburse_brother_id: z.coerce.number().int().positive().optional().nullable(),
  cheque_number: z.string().max(50).optional().nullable(),
  // Which school year the expense counts toward. Normally derived from the
  // date; sent explicitly to file it against a different year, the way revenue
  // already allows.
  school_year: z.coerce.number().int().min(1900).max(2200).optional(),
  // Create the entry already settled, with nobody to reimburse.
  status: expenseStatusSchema.optional(),
});

const expenseUpdateSchema = z
  .object({
    date: z.union([z.string(), z.date()]).optional(),
    description: z.string().min(1).optional(),
    category_id: z.coerce.number().int().positive().optional(),
    amount: z.coerce.number().optional(),
    reimburse_brother_id: z.coerce.number().int().positive().optional().nullable(),
    cheque_number: z.string().max(50).optional().nullable(),
    school_year: z.coerce.number().int().min(1900).max(2200).optional(),
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
  SETTLED_EXPENSE_STATUSES,
  expenseCreateSchema,
  expenseUpdateSchema,
  expenseSubmissionSchema,
  expenseDisbursementSchema,
};


