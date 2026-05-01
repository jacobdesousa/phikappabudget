const { z } = require("zod");

const dateLike = z.union([z.string(), z.date()]);
const emptyToNull = (v) => (v === "" ? null : v);

const shiftAssignmentSchema = z.object({
  brother_id: z.coerce.number().int().positive(),
  status: z.enum(["assigned", "present", "absent"]),
  makeup_completed_at: z.preprocess(emptyToNull, dateLike).optional().nullable(),
});

const shiftPartySlotSchema = z.object({
  duty_id: z.coerce.number().int().positive(),
  slot_start: z.string().min(1),
  brother_id: z.coerce.number().int().positive().optional().nullable(),
  status: z.enum(["unassigned", "assigned", "present", "absent"]),
  makeup_completed_at: z.preprocess(emptyToNull, dateLike).optional().nullable(),
});

const shiftCreateSchema = z.object({
  shift_type: z.enum(["setup", "cleanup", "party"]),
  event_date: dateLike,
  title: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  // Party only
  party_start_time: z.string().regex(/^\d{1,2}:\d{2}$/).optional().nullable(),
  party_end_time: z.string().regex(/^\d{1,2}:\d{2}$/).optional().nullable(),
  duties: z.array(z.string().min(1).max(100)).optional(),
});

const shiftUpdateSchema = z.object({
  event_date: dateLike.optional(),
  title: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  party_start_time: z.string().regex(/^\d{1,2}:\d{2}$/).optional().nullable(),
  party_end_time: z.string().regex(/^\d{1,2}:\d{2}$/).optional().nullable(),
  assignments: z.array(shiftAssignmentSchema).optional(),
  slots: z.array(shiftPartySlotSchema).optional(),
});

const partyDutySchema = z.object({
  name: z.string().min(1).max(100),
  display_order: z.coerce.number().int().optional(),
});

module.exports = { shiftCreateSchema, shiftUpdateSchema, shiftAssignmentSchema, shiftPartySlotSchema, partyDutySchema };
