const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  listBrothers,
  createBrother,
  updateBrother,
  deleteBrother,
  brotherStatement,
  importBrothers,
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
  emailMeetingMinutes,
  downloadMeetingPdf,
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
const { getNotifications, getAllMakeups } = require("../controllers/notificationsController");
const { getStandings, getLegacyAdjustments, addLegacyAdjustment, deleteLegacyAdjustment } = require("../controllers/roomDrawController");
const {
  getBudgetSummary,
  batchUpsertExpenseAllocations,
  batchUpsertRevenueAllocations,
  upsertReconciliation,
  upsertBudgetDuesConfig,
} = require("../controllers/budgetController");
const {
  listAssignments,
  getRoster,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  houseSummary,
} = require("../controllers/houseController");
const { getHouseAgreement } = require("../controllers/houseAgreementController");
const {
  listRooms,
  getHouseConfig,
  upsertHouseConfig,
  seedHouseConfig,
} = require("../controllers/houseConfigController");
const {
  listHousePayments,
  createHousePayment,
  updateHousePayment,
  deleteHousePayment,
  listHouseDeposits,
  createHouseDeposit,
  updateHouseDeposit,
  deleteHouseDeposit,
} = require("../controllers/housePaymentsController");
const {
  getHouseAccount,
  listDisbursements,
  createDisbursement,
  updateDisbursement,
  deleteDisbursement,
  postDisbursementRevenue,
  listTransactions,
  listAdjustments,
  createAdjustment,
  updateAdjustment,
  deleteAdjustment,
} = require("../controllers/houseAccountController");
const {
  getSchedule,
  getCurrent,
  getChoreConfig,
  saveChoreConfig,
  seedChoreConfig,
} = require("../controllers/choresController");
const {
  listDonations,
  getDonationSummary,
  getBrotherBondState,
  createDonation,
  updateDonation,
  deleteDonation,
  updateBond,
  getDonationConfig,
  saveDonationConfig,
} = require("../controllers/donationsController");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { auditWrites } = require("../middleware/audit");
const { pool } = require("../db/pool");
const { streamFromS3 } = require("../utils/s3");
const { env } = require("../config/env");

const router = express.Router();

// Public submission endpoint (multipart/form-data with `receipt`)
router.post("/expenses/submit", uploadReceipt.single("receipt"), asyncHandler(submitExpense));

router.get("/health", (req, res) => res.json({ ok: true }));

// Everything else requires auth
router.use(requireAuth);
router.use(auditWrites());

// Authenticated S3 file proxy (production only; dev uses express.static in app.js)
if (env.aws.s3Bucket) {
  router.get("/uploads/*", asyncHandler(async (req, res) => {
    const key = req.params[0]; // everything after /uploads/
    try {
      await streamFromS3(key, res);
    } catch (e) {
      if (e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404) {
        return res.status(404).json({ error: { message: "File not found." } });
      }
      throw e;
    }
  }));
}

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
router.post("/brothers/import", requirePermission("admin.users"), asyncHandler(importBrothers));
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
router.post("/meetings/:id/email-minutes", requirePermission("meetings.write"), asyncHandler(emailMeetingMinutes));
router.get("/meetings/:id/pdf", requirePermission("meetings.read"), asyncHandler(downloadMeetingPdf));

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

router.get("/notifications", asyncHandler(getNotifications));
router.get("/makeups", asyncHandler(getAllMakeups));

router.get("/room-draw/standings",     requirePermission("roomDraw.read"),  asyncHandler(getStandings));
router.get("/room-draw/legacy",        requirePermission("roomDraw.read"),  asyncHandler(getLegacyAdjustments));
router.post("/room-draw/legacy",       requirePermission("roomDraw.write"), asyncHandler(addLegacyAdjustment));
router.delete("/room-draw/legacy/:id", requirePermission("roomDraw.write"), asyncHandler(deleteLegacyAdjustment));

// Budget
router.get("/budget/summary",              requirePermission("budget.read"),  asyncHandler(getBudgetSummary));
router.put("/budget/expense-allocations",  requirePermission("budget.write"), asyncHandler(batchUpsertExpenseAllocations));
router.put("/budget/revenue-allocations",  requirePermission("budget.write"), asyncHandler(batchUpsertRevenueAllocations));
router.put("/budget/reconciliation",       requirePermission("budget.write"), asyncHandler(upsertReconciliation));
router.put("/budget/dues-config",          requirePermission("budget.write"), asyncHandler(upsertBudgetDuesConfig));

// House chores. The schedule is a stored grid edited on the config page.
router.get("/chores/current",      requirePermission("chores.read"),   asyncHandler(getCurrent));
router.get("/chores/schedule",     requirePermission("chores.read"),   asyncHandler(getSchedule));
router.get("/chores/config",       requirePermission("chores.read"),   asyncHandler(getChoreConfig));
router.put("/chores/config",       requirePermission("chores.config"), asyncHandler(saveChoreConfig));
router.post("/chores/config/seed", requirePermission("chores.config"), asyncHandler(seedChoreConfig));

// Alumni donations and bonds. Literal paths first, before `/donations/:id`.
router.get   ("/donations/summary",           requirePermission("donations.read"),   asyncHandler(getDonationSummary));
router.get   ("/donations/config",            requirePermission("donations.read"),   asyncHandler(getDonationConfig));
router.put   ("/donations/config",            requirePermission("donations.config"), asyncHandler(saveDonationConfig));
router.get   ("/donations/bond/:brotherId",   requirePermission("donations.read"),   asyncHandler(getBrotherBondState));
router.put   ("/donations/bond/:brotherId",   requirePermission("donations.write"),  asyncHandler(updateBond));
router.get   ("/donations",                   requirePermission("donations.read"),   asyncHandler(listDonations));
router.post  ("/donations",                   requirePermission("donations.write"),  asyncHandler(createDonation));
router.put   ("/donations/:id",               requirePermission("donations.write"),  asyncHandler(updateDonation));
router.delete("/donations/:id",               requirePermission("donations.write"),  asyncHandler(deleteDonation));

// Chapter house. Literal paths are declared before any `/:id` route so they
// aren't swallowed by the wildcard.
router.get("/house/config",             requirePermission("house.config"), asyncHandler(getHouseConfig));
router.put("/house/config",             requirePermission("house.config"), asyncHandler(upsertHouseConfig));
router.post("/house/config/seed",       requirePermission("house.config"), asyncHandler(seedHouseConfig));
router.get("/house/agreement",          requirePermission("house.read"),   asyncHandler(getHouseAgreement));
router.get("/house/rooms",              requirePermission("house.read"),   asyncHandler(listRooms));
router.get("/house/roster",             requirePermission("house.read"),   asyncHandler(getRoster));
router.get("/house/summary",            requirePermission("house.read"),   asyncHandler(houseSummary));
router.get("/house/assignments",        requirePermission("house.read"),   asyncHandler(listAssignments));
router.post("/house/assignments",       requirePermission("house.write"),  asyncHandler(createAssignment));
router.put("/house/assignments/:id",    requirePermission("house.write"),  asyncHandler(updateAssignment));
router.delete("/house/assignments/:id", requirePermission("house.write"),  asyncHandler(deleteAssignment));
router.get("/house/payments",           requirePermission("house.read"),   asyncHandler(listHousePayments));
router.post("/house/payments",          requirePermission("house.write"),  asyncHandler(createHousePayment));
router.put("/house/payments/:id",       requirePermission("house.write"),  asyncHandler(updateHousePayment));
router.delete("/house/payments/:id",    requirePermission("house.write"),  asyncHandler(deleteHousePayment));
router.get("/house/deposits",           requirePermission("house.read"),   asyncHandler(listHouseDeposits));
router.post("/house/deposits",          requirePermission("house.write"),  asyncHandler(createHouseDeposit));
router.put("/house/deposits/:id",       requirePermission("house.write"),  asyncHandler(updateHouseDeposit));
router.delete("/house/deposits/:id",    requirePermission("house.write"),  asyncHandler(deleteHouseDeposit));
router.get("/house/account",                         requirePermission("house.read"),  asyncHandler(getHouseAccount));
router.get("/house/account/transactions",            requirePermission("house.read"),  asyncHandler(listTransactions));
router.get("/house/account/adjustments",             requirePermission("house.read"),  asyncHandler(listAdjustments));
router.post("/house/account/adjustments",            requirePermission("house.write"), asyncHandler(createAdjustment));
router.put("/house/account/adjustments/:id",         requirePermission("house.write"), asyncHandler(updateAdjustment));
router.delete("/house/account/adjustments/:id",      requirePermission("house.write"), asyncHandler(deleteAdjustment));
router.get("/house/disbursements",                   requirePermission("house.read"),  asyncHandler(listDisbursements));
router.post("/house/disbursements",                  requirePermission("house.write"), asyncHandler(createDisbursement));
router.post("/house/disbursements/:id/post-revenue", requirePermission("house.write"), asyncHandler(postDisbursementRevenue));
router.put("/house/disbursements/:id",               requirePermission("house.write"), asyncHandler(updateDisbursement));
router.delete("/house/disbursements/:id",            requirePermission("house.write"), asyncHandler(deleteDisbursement));

module.exports = { legacyRouter: router };



