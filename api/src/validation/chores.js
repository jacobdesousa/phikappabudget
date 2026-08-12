const { z } = require("zod");

const emptyToUndefined = (v) => (v === "" ? undefined : v);
const optionalText = z.preprocess(emptyToUndefined, z.string()).optional().nullable();
const optionalInt = z.preprocess(emptyToUndefined, z.coerce.number().int()).optional().nullable();
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");
const yearSchema = z.coerce.number().int().min(2000).max(3000);

const scheduleQuerySchema = z.object({
  from: z.preprocess(emptyToUndefined, dateString).optional(),
  to: z.preprocess(emptyToUndefined, dateString).optional(),
  year: yearSchema.optional(),
});

const currentQuerySchema = z.object({
  date: z.preprocess(emptyToUndefined, dateString).optional(),
});

const dutySchema = z.object({
  duty_no: z.coerce.number().int().min(1).max(99),
  name: z.string().min(1).max(120),
  description: optionalText,
});

const settingsSchema = z.object({
  // First day of the second period of each month.
  split_day: z.coerce.number().int().min(2).max(28),
  manager_notes: optionalText,
});

const captainSchema = z.object({
  captain_key: z.string().min(1).max(50),
  name: z.string().min(1).max(120),
  description: optionalText,
  brother_id: optionalInt,
  sort_order: optionalInt,
});

// One filled cell of the schedule grid. Cleared cells are simply absent. The
// bed is identified by bedroom, not by a row number: bedrooms live in House
// Config, so the schedule points at them rather than listing its own.
const gridCellSchema = z.object({
  room_id: z.coerce.number().int().positive(),
  bed: z.coerce.number().int().min(1).max(4),
  // 0-23: September 1st-half through August 2nd-half.
  period_index: z.coerce.number().int().min(0).max(23),
  duty_no: z.coerce.number().int().min(1).max(99),
});

const configUpsertSchema = z
  .object({
    settings: settingsSchema,
    duties: z.array(dutySchema).min(1),
    grid: z.array(gridCellSchema).default([]),
    captains: z.array(captainSchema).default([]),
  })
  .superRefine((val, ctx) => {
    const dutyNos = new Set();
    for (const d of val.duties) {
      if (dutyNos.has(d.duty_no)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate duty number ${d.duty_no}` });
      }
      dutyNos.add(d.duty_no);
    }

    const cells = new Set();
    for (const cell of val.grid) {
      const key = `${cell.room_id}|${cell.bed}|${cell.period_index}`;
      if (cells.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Two duties for the same bedroom and period",
        });
      }
      cells.add(key);
      if (!dutyNos.has(cell.duty_no)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `The schedule uses duty ${cell.duty_no}, which doesn't exist`,
        });
      }
    }
  });

const seedSchema = z.object({
  reset: z.coerce.boolean().default(false),
});

module.exports = {
  scheduleQuerySchema,
  currentQuerySchema,
  configUpsertSchema,
  seedSchema,
};
