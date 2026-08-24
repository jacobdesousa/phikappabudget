const { z } = require("zod");

const SESSION_TYPES = ["winter", "summer"];
// A buy-out ("full_room") is one resident paying for the whole room.
const OCCUPANCY_KINDS = ["standard", "full_room"];
// A deposit is owed, sitting in the account, or returned. Money kept back is a
// deduction against the refund, not a separate status — a total forfeit is just
// a refund of $0.
const DEPOSIT_STATUSES = ["outstanding", "received", "refunded"];

const emptyToUndefined = (v) => (v === "" ? undefined : v);

const yearSchema = z.coerce.number().int().min(2000).max(3000);
const sessionTypeSchema = z.enum(SESSION_TYPES);
const dateSchema = z.union([z.string(), z.date()]);
const optionalDate = z.preprocess(emptyToUndefined, dateSchema).optional().nullable();
const optionalMoney = z.preprocess(emptyToUndefined, z.coerce.number()).optional().nullable();

const yearSessionQuerySchema = z.object({
  year: yearSchema.optional(),
  session: sessionTypeSchema.optional(),
});

// ── Config ──────────────────────────────────────────────────────────────────

const sessionConfigSchema = z.object({
  session_type: sessionTypeSchema,
  // 4-month terms in the session: winter is 2, summer 1.
  terms: z.coerce.number().int().min(1).max(4).default(1),
  start_date: optionalDate,
  end_date: optionalDate,
  member_rebate: z.coerce.number().min(0).default(0),
  prepay_discount_pct: z.coerce.number().min(0).max(100).default(0),
  prepay_deadline: optionalDate,
  security_deposit_amount: z.coerce.number().min(0).default(0),
  instalments: z
    .array(
      z.object({
        seq: z.coerce.number().int().min(1),
        due_date: optionalDate,
        weight_pct: z.coerce.number().min(0).max(100),
      })
    )
    .default([]),
});

const roomRateSchema = z.object({
  room_id: z.coerce.number().int().positive(),
  capacity: z.coerce.number().int().min(1).max(2),
  rate_per_person: optionalMoney,
});

const payeeSchema = z.object({
  payee: z.string().min(1).max(50),
  pct: z.coerce.number().min(0).max(100),
  is_internal: z.coerce.boolean().default(false),
  sort_order: z.coerce.number().int().optional().nullable(),
});

const houseConfigUpsertSchema = z.object({
  year: yearSchema,
  sessions: z.array(sessionConfigSchema).default([]),
  rates: z
    .array(roomRateSchema.extend({ session_type: sessionTypeSchema }))
    .default([]),
  payees: z.array(payeeSchema).optional(),
});

const seedConfigSchema = z.object({
  year: yearSchema,
  from: yearSchema.optional(),
});

// ── Assignments ─────────────────────────────────────────────────────────────

const assignmentCreateSchema = z.object({
  school_year: yearSchema,
  session_type: sessionTypeSchema,
  room_id: z.coerce.number().int().positive(),
  bed: z.coerce.number().int().min(1).max(2).default(1),
  brother_id: z.coerce.number().int().positive(),
  occupancy: z.enum(OCCUPANCY_KINDS).default("standard"),
  start_date: optionalDate,
  end_date: optionalDate,
  base_amount: optionalMoney,
  amount_override: optionalMoney,
  override_note: z.string().max(500).optional().nullable(),
  member_discount: z.coerce.boolean().optional(),
  double_rebate: z.coerce.boolean().optional(),
  prepay_discount: z.coerce.boolean().optional(),
  notes: z.string().max(500).optional().nullable(),
});

const assignmentUpdateSchema = assignmentCreateSchema.partial();

// ── Payments & deposits ─────────────────────────────────────────────────────

const paymentCreateSchema = z.object({
  brother_id: z.coerce.number().int().positive(),
  school_year: yearSchema.optional(),
  session_type: sessionTypeSchema,
  assignment_id: z.coerce.number().int().positive().optional().nullable(),
  paid_at: dateSchema,
  amount: z.coerce.number(),
  memo: z.string().max(500).optional().nullable(),
});

const paymentUpdateSchema = paymentCreateSchema.partial();

const depositDeductionSchema = z.object({
  description: z.string().max(200).optional().nullable(),
  amount: z.coerce.number().min(0),
});

const depositCreateSchema = z.object({
  brother_id: z.coerce.number().int().positive(),
  amount: z.coerce.number(),
  received_at: optionalDate,
  status: z.enum(DEPOSIT_STATUSES).default("outstanding"),
  released_at: optionalDate,
  refund_cheque_number: z
    .preprocess(emptyToUndefined, z.string().max(50))
    .optional()
    .nullable(),
  note: z.string().max(500).optional().nullable(),
  deductions: z.array(depositDeductionSchema).optional(),
});

const depositUpdateSchema = depositCreateSchema.partial();

// ── Disbursements & account adjustments ─────────────────────────────────────

// The client never sends the split: shares are computed server-side from
// house_disbursement_payees so the percentages can't drift from config.
//
// A disbursement record is only created once the money has actually moved, so
// there is no draft/estimated state to track.
// The date identifies the disbursement: it orders the ledger and derives
// school_year and session_type, so it is required rather than optional.
const disbursementCreateSchema = z.object({
  school_year: yearSchema.optional(),
  session_type: sessionTypeSchema.optional(),
  disbursed_on: dateSchema,
  bank_balance: z.coerce.number(),
  security_to_refund: z.coerce.number().default(0),
  security_on_account: z.coerce.number().default(0),
  notes: z.string().max(1000).optional().nullable(),
  // Cheque numbers are the only share field the client sets — the amounts are
  // computed from the payee config. Keyed by payee, since each is paid
  // separately. Omit to leave the existing numbers alone.
  cheques: z
    .array(
      z.object({
        payee: z.string().min(1).max(50),
        cheque_number: z.preprocess(emptyToUndefined, z.string().max(50)).optional().nullable(),
      })
    )
    .optional(),
});

const disbursementUpdateSchema = disbursementCreateSchema.partial();

// Amount is signed: a bank fee is negative, the PM revenue bonus positive.
const adjustmentCreateSchema = z.object({
  occurred_on: dateSchema,
  amount: z.coerce.number(),
  description: z.string().max(500).optional().nullable(),
  school_year: yearSchema.optional(),
});

const adjustmentUpdateSchema = adjustmentCreateSchema.partial();

// The derived transaction list is long enough to need paging, unlike the
// disbursements themselves.
const transactionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// Everything optional — the controller defaults the payee to the year's
// internal one and the date to the disbursement's own.
const postRevenueSchema = z.object({
  payee: z.string().max(50).optional(),
  date: optionalDate,
  // Which school year the revenue counts toward. Defaults to the year derived
  // from the posting date, but the treasurer can override it — a disbursement
  // paid out in the summer often belongs to the year that just ended.
  school_year: z.coerce.number().int().min(1900).max(2200).optional(),
  description: z.string().max(500).optional(),
});

module.exports = {
  SESSION_TYPES,
  OCCUPANCY_KINDS,
  DEPOSIT_STATUSES,
  yearSessionQuerySchema,
  houseConfigUpsertSchema,
  seedConfigSchema,
  assignmentCreateSchema,
  assignmentUpdateSchema,
  paymentCreateSchema,
  paymentUpdateSchema,
  depositCreateSchema,
  depositUpdateSchema,
  disbursementCreateSchema,
  disbursementUpdateSchema,
  adjustmentCreateSchema,
  adjustmentUpdateSchema,
  transactionQuerySchema,
  postRevenueSchema,
};
