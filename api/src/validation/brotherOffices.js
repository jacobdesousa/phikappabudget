const { z } = require("zod");

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const officeAssignSchema = z.object({
  office_key: z.string().min(1).max(100),
  start_date: z.string().regex(dateRegex, "must be YYYY-MM-DD"),
  end_date: z.string().regex(dateRegex, "must be YYYY-MM-DD").nullable().optional(),
});

const officeUpdateSchema = z.object({
  start_date: z.string().regex(dateRegex, "must be YYYY-MM-DD").optional(),
  end_date: z.string().regex(dateRegex, "must be YYYY-MM-DD").nullable().optional(),
});

module.exports = { officeAssignSchema, officeUpdateSchema };
