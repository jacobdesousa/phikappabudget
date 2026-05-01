const { z } = require("zod");

const dateLike = z.union([z.string(), z.date()]);

const attendanceRowSchema = z
  .object({
    brother_id: z.coerce.number().int().positive().optional().nullable(),
    member_name: z.string().min(1).max(200).optional().nullable(),
    status: z.string().min(1).max(50),
    late_arrival_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "late_arrival_time must be HH:MM")
      .optional()
      .nullable(),
    excused_reason: z.string().max(500).optional().nullable(),
  })
  .refine((v) => Boolean(v.brother_id) || Boolean(v.member_name?.trim()), {
    message: "Either brother_id or member_name is required",
    path: ["brother_id"],
  })
  .refine((v) => (v.status === "Late" ? Boolean(v.late_arrival_time) : true), {
    message: "late_arrival_time is required when status is Late",
    path: ["late_arrival_time"],
  });

const officerNoteSchema = z.object({
  officer_key: z.string().min(1).max(50),
  notes: z.string().optional().nullable(),
});

const meetingUpsertSchema = z.object({
  meeting_date: dateLike,
  title: z.string().max(200).optional().nullable(),
  attendance: z.array(attendanceRowSchema).optional().default([]),
  officer_notes: z.array(officerNoteSchema).optional().default([]),
  communications: z.string().optional().nullable(),
  old_business: z.string().optional().nullable(),
  new_business: z.string().optional().nullable(),
  betterment: z.string().optional().nullable(),
  motion_accept_moved_by_brother_id: z.coerce.number().int().positive().optional().nullable(),
  motion_accept_seconded_by_brother_id: z.coerce.number().int().positive().optional().nullable(),
  motion_end_moved_by_brother_id: z.coerce.number().int().positive().optional().nullable(),
  motion_end_seconded_by_brother_id: z.coerce.number().int().positive().optional().nullable(),
});

module.exports = { meetingUpsertSchema };


