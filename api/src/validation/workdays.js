const { z } = require("zod");

const dateLike = z.union([z.string(), z.date()]);

const emptyToNull = (v) => (v === "" ? null : v);
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, "bonus_month must be YYYY-MM");

const workdayAttendanceRowSchema = z.object({
  brother_id: z.coerce.number().int().positive(),
  status: z.enum(["Present", "Late", "Excused", "Missing"]),
  coveralls: z.coerce.boolean().optional().nullable(),
  nametag: z.coerce.boolean().optional().nullable(),
  makeup_completed_at: z.preprocess(emptyToNull, dateLike).optional().nullable(),
});

const workdayUpsertSchema = z.object({
  workday_date: dateLike,
  title: z.string().max(200).optional().nullable(),
  bonus_month: monthSchema.optional().nullable(),
  attendance: z.array(workdayAttendanceRowSchema).optional().default([]),
});

module.exports = { workdayUpsertSchema };


