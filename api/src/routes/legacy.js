const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  listBrothers,
  createBrother,
  updateBrother,
  deleteBrother,
  brotherStatement,
} = require("../controllers/brothersController");
const {
  listDues,
  updateDues,
  updateDuesById,
} = require("../controllers/duesController");
const {
  listRevenueCategories,
  createRevenueCategory,
  updateRevenueCategory,
  deleteRevenueCategory,
  listRevenue,
  createRevenue,
  updateRevenue,
  deleteRevenue,
  revenueSummary,
} = require("../controllers/revenueController");
const {
  listDuesPayments,
  duesPaymentsSummary,
  createDuesPayment,
  deleteDuesPayment,
  updateDuesPayment,
} = require("../controllers/duesPaymentsController");
const {
  getDuesConfig,
  upsertDuesConfig,
} = require("../controllers/duesConfigController");
const {
  listExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  listExpenses,
  createExpense,
  createExpenseWithReceipt,
  updateExpense,
  deleteExpense,
  submitExpense,
  approveExpense,
  rejectExpense,
  getOutstandingDisbursements,
  disburseExpenses,
  attachExpenseReceipt,
} = require("../controllers/expensesController");
const {
  listBrotherOffices,
  assignBrotherOffice,
  updateBrotherOffice,
  deleteBrotherOffice,
} = require("../controllers/brotherOfficesController");
const {
  listMeetings,
  getMeeting,
  createMeeting,
  updateMeeting,
  deleteMeeting,
} = require("../controllers/meetingsController");
const {
  createVote,
  listVotesForMeeting,
  getVote,
  getResults,
  submitResponse,
  closeVote,
  deleteVote,
  setResultsVisible,
} = require("../controllers/votesController");
const {
  listWorkdays,
  getWorkday,
  createWorkday,
  updateWorkday,
  deleteWorkday,
} = require("../controllers/workdaysController");
const { uploadReceipt, uploadBonusPhoto } = require("../middleware/upload");
const {
  listBonusDeductions,
  bonusMonthSummary,
  createBonusDeduction,
  deleteBonusDeduction,
} = require("../controllers/chapterBonusController");
const {
  listBonusRules,
  upsertBonusRule,
  deleteBonusRule,
  previewBonusPenalty,
} = require("../controllers/chapterBonusRulesController");
const {
  getWorkdayRates,
  upsertWorkdayRates,
} = require("../controllers/chapterBonusWorkdayRatesController");
const {
  listShifts,
  getShift,
  createShift,
  updateShift,
  deleteShift,
  getBrotherCounts,
  listPartyDuties,
  createPartyDuty,
  updatePartyDuty,
  deletePartyDuty,
} = require("../controllers/shiftsController");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { auditWrites } = require("../middleware/audit");
const { pool } = require("../db/pool");

const router = express.Router();

// Public submission endpoint (multipart/form-data with `receipt`)
router.post("/expenses/submit", uploadReceipt.single("receipt"), asyncHandler(submitExpense));

// Everything else requires auth
router.use(requireAuth);
router.use(auditWrites());

// Offices (read-only for UI dropdowns)
router.get(
  "/offices",
  requirePermission("brothers.read"),
  asyncHandler(async (req, res) => {
    const result = await pool.query(`SELECT office_key, display_name FROM offices ORDER BY display_name ASC`);
    return res.status(200).json(result.rows ?? []);
  })
);

// Brothers
router.get("/brothers", requirePermission("brothers.read"), asyncHandler(listBrothers));
router.post("/brothers", requirePermission("brothers.write"), asyncHandler(createBrother));
router.put("/brothers/:id", requirePermission("brothers.write"), asyncHandler(updateBrother));
router.delete("/brothers/:id", requirePermission("brothers.write"), asyncHandler(deleteBrother));
router.get("/brothers/:id/statement", requirePermission("brothers.read"), asyncHandler(brotherStatement));
// Brother office tenures — specific sub-routes before /:id wildcards
router.get("/brothers/:id/offices", requirePermission("brothers.read"), asyncHandler(listBrotherOffices));
router.post("/brothers/:id/offices", requirePermission("brothers.write"), asyncHandler(assignBrotherOffice));
router.put("/brother-offices/:tenureId", requirePermission("brothers.write"), asyncHandler(updateBrotherOffice));
router.delete("/brother-offices/:tenureId", requirePermission("brothers.write"), asyncHandler(deleteBrotherOffice));

// Dues
router.get("/dues", requirePermission("dues.read"), asyncHandler(listDues));
// Backwards-compatible: expects { id, ... } in body
router.put("/dues", requirePermission("dues.write"), asyncHandler(updateDues));
// New payments-based dues APIs (preferred)
// IMPORTANT: Define specific routes BEFORE `/dues/:id` so `/dues/config` doesn't get treated as `:id = "config"`.
router.get("/dues/config", requirePermission("dues.config"), asyncHandler(getDuesConfig));
router.put("/dues/config", requirePermission("dues.config"), asyncHandler(upsertDuesConfig));
router.get("/dues/summary", requirePermission("dues.read"), asyncHandler(duesPaymentsSummary));
router.get("/dues/payments", requirePermission("dues.read"), asyncHandler(listDuesPayments));
router.post("/dues/payments", requirePermission("dues.write"), asyncHandler(createDuesPayment));
router.delete("/dues/payments/:id", requirePermission("dues.write"), asyncHandler(deleteDuesPayment));
router.put("/dues/payments/:id", requirePermission("dues.write"), asyncHandler(updateDuesPayment));

// More RESTful option (legacy instalment table)
router.put("/dues/:id", requirePermission("dues.write"), asyncHandler(updateDuesById));

// Revenue categories
router.get("/revenue/category", requirePermission("revenue.read"), asyncHandler(listRevenueCategories));
router.post("/revenue/category", requirePermission("revenue.config"), asyncHandler(createRevenueCategory));
router.put("/revenue/category/:id", requirePermission("revenue.config"), asyncHandler(updateRevenueCategory));
router.delete("/revenue/category/:id", requirePermission("revenue.config"), asyncHandler(deleteRevenueCategory));

router.get("/revenue/summary", requirePermission("revenue.read"), asyncHandler(revenueSummary));
router.get("/revenue", requirePermission("revenue.read"), asyncHandler(listRevenue));
router.post("/revenue", requirePermission("revenue.write"), asyncHandler(createRevenue));
router.put("/revenue/:id", requirePermission("revenue.write"), asyncHandler(updateRevenue));
router.delete("/revenue/:id", requirePermission("revenue.write"), asyncHandler(deleteRevenue));

// Expenses categories
router.get("/expenses/category", requirePermission("expenses.read"), asyncHandler(listExpenseCategories));
router.post("/expenses/category", requirePermission("expenses.write"), asyncHandler(createExpenseCategory));
router.put("/expenses/category/:id", requirePermission("expenses.write"), asyncHandler(updateExpenseCategory));
router.delete("/expenses/category/:id", requirePermission("expenses.write"), asyncHandler(deleteExpenseCategory));

router.post("/expenses/:id/approve", requirePermission("expenses.review"), asyncHandler(approveExpense));
router.post("/expenses/:id/reject", requirePermission("expenses.review"), asyncHandler(rejectExpense));
router.get("/expenses/disbursements/outstanding", requirePermission("expenses.disburse"), asyncHandler(getOutstandingDisbursements));
router.post("/expenses/disbursements", requirePermission("expenses.disburse"), asyncHandler(disburseExpenses));

router.get("/expenses", requirePermission("expenses.read"), asyncHandler(listExpenses));
router.post("/expenses", requirePermission("expenses.write"), asyncHandler(createExpense));
router.post("/expenses/with-receipt", requirePermission("expenses.write"), uploadReceipt.single("receipt"), asyncHandler(createExpenseWithReceipt));
router.post("/expenses/:id/receipt", requirePermission("expenses.write"), uploadReceipt.single("receipt"), asyncHandler(attachExpenseReceipt));
router.put("/expenses/:id", requirePermission("expenses.write"), asyncHandler(updateExpense));
router.delete("/expenses/:id", requirePermission("expenses.write"), asyncHandler(deleteExpense));

// Meeting minutes
router.get("/meetings", requirePermission("meetings.read"), asyncHandler(listMeetings));
router.post("/meetings", requirePermission("meetings.write"), asyncHandler(createMeeting));
// Meeting votes — specific nested routes before /:id to avoid param collision
router.get("/meetings/:id/votes", requirePermission("meetings.read"), asyncHandler(listVotesForMeeting));
router.post("/meetings/:id/votes", requirePermission("meetings.write"), asyncHandler(createVote));
router.get("/meetings/:id", requirePermission("meetings.read"), asyncHandler(getMeeting));
router.put("/meetings/:id", requirePermission("meetings.write"), asyncHandler(updateMeeting));
router.delete("/meetings/:id", requirePermission("meetings.write"), asyncHandler(deleteMeeting));

// Standalone vote routes (used by voting page)
router.get("/votes/:voteId", asyncHandler(getVote));
router.get("/votes/:voteId/results", asyncHandler(getResults));
router.post("/votes/:voteId/respond", asyncHandler(submitResponse));
router.put("/votes/:voteId/close", requirePermission("meetings.write"), asyncHandler(closeVote));
router.put("/votes/:voteId/results-visible", requirePermission("meetings.write"), asyncHandler(setResultsVisible));
router.delete("/votes/:voteId", requirePermission("meetings.write"), asyncHandler(deleteVote));

// Workdays
router.get("/workdays", requirePermission("workdays.read"), asyncHandler(listWorkdays));
router.post("/workdays", requirePermission("workdays.write"), asyncHandler(createWorkday));
router.get("/workdays/:id", requirePermission("workdays.read"), asyncHandler(getWorkday));
router.put("/workdays/:id", requirePermission("workdays.write"), asyncHandler(updateWorkday));
router.delete("/workdays/:id", requirePermission("workdays.write"), asyncHandler(deleteWorkday));

// Chapter Bonus deductions
router.get("/chapter-bonus/deductions", requirePermission("chapterBonus.read"), asyncHandler(listBonusDeductions));
router.get("/chapter-bonus/summary", requirePermission("chapterBonus.read"), asyncHandler(bonusMonthSummary));
router.get("/chapter-bonus/penalty", requirePermission("chapterBonus.read"), asyncHandler(previewBonusPenalty));
router.get("/chapter-bonus/workday-rates", requirePermission("chapterBonus.read"), asyncHandler(getWorkdayRates));
router.put("/chapter-bonus/workday-rates", requirePermission("chapterBonus.write"), asyncHandler(upsertWorkdayRates));
router.post("/chapter-bonus/deductions", requirePermission("chapterBonus.write"), uploadBonusPhoto.single("photo"), asyncHandler(createBonusDeduction));
router.delete("/chapter-bonus/deductions/:id", requirePermission("chapterBonus.write"), asyncHandler(deleteBonusDeduction));

// Chapter Bonus rules/config
router.get("/chapter-bonus/rules", requirePermission("chapterBonus.config"), asyncHandler(listBonusRules));
router.post("/chapter-bonus/rules", requirePermission("chapterBonus.config"), asyncHandler(upsertBonusRule));
router.delete("/chapter-bonus/rules/:id", requirePermission("chapterBonus.config"), asyncHandler(deleteBonusRule));

// Shifts — specific routes before /:id to avoid param collision
router.get("/shifts/counts", asyncHandler(getBrotherCounts));
router.get("/shifts", asyncHandler(listShifts));
router.post("/shifts", asyncHandler(createShift));
router.get("/shifts/:id/duties", asyncHandler(listPartyDuties));
router.post("/shifts/:id/duties", asyncHandler(createPartyDuty));
router.get("/shifts/:id", asyncHandler(getShift));
router.put("/shifts/:id", asyncHandler(updateShift));
router.delete("/shifts/:id", asyncHandler(deleteShift));
router.put("/shift-duties/:dutyId", asyncHandler(updatePartyDuty));
router.delete("/shift-duties/:dutyId", asyncHandler(deletePartyDuty));

module.exports = { legacyRouter: router };



