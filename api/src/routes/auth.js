const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { auditWrites } = require("../middleware/audit");
const {
  login,
  refresh,
  logout,
  me,
  inviteUser,
  acceptInvite,
  devPasswordResetRequest,
  listInvites,
  revokeInvite,
  reissueInvite,
} = require("../controllers/authController");
const { listSessions, revokeSession, revokeAllSessions } = require("../controllers/sessionsController");
const {
  listUsers,
  listOverrides,
  upsertOverride,
  deleteOverride,
  updateUserStatus,
} = require("../controllers/permissionOverridesController");
const { listRolePermissions, updateRolePermissions } = require("../controllers/rolePermissionsController");
const { listOffices, createOffice, deleteOffice } = require("../controllers/officesController");

const router = express.Router();

router.post("/login", asyncHandler(login));
router.post("/refresh", asyncHandler(refresh));
router.post("/logout", asyncHandler(logout));

router.get("/me", requireAuth, asyncHandler(me));

// Invite-only onboarding (admin)
router.post("/invite", requireAuth, auditWrites(), requirePermission("admin.users"), asyncHandler(inviteUser));
router.get("/invites", requireAuth, requirePermission("admin.users"), asyncHandler(listInvites));
router.post("/invites/:id/revoke", requireAuth, auditWrites(), requirePermission("admin.users"), asyncHandler(revokeInvite));
router.post("/invites/:id/reissue", requireAuth, auditWrites(), requirePermission("admin.users"), asyncHandler(reissueInvite));
router.post("/accept-invite", asyncHandler(acceptInvite));

// Dev-only helper (Phase 1 placeholder)
router.post("/forgot-password", asyncHandler(devPasswordResetRequest));

// Sessions (refresh token sessions)
router.get("/sessions", requireAuth, asyncHandler(listSessions));
router.post("/sessions/:id/revoke", requireAuth, auditWrites(), asyncHandler(revokeSession));
router.post("/sessions/revoke-all", requireAuth, auditWrites(), asyncHandler(revokeAllSessions));

// Admin: permission overrides
router.get("/admin/users", requireAuth, requirePermission("admin.users"), asyncHandler(listUsers));
router.put("/admin/users/:userId", requireAuth, auditWrites(), requirePermission("admin.users"), asyncHandler(updateUserStatus));
router.get("/admin/users/:userId/overrides", requireAuth, requirePermission("admin.users"), asyncHandler(listOverrides));
router.put("/admin/users/:userId/overrides", requireAuth, auditWrites(), requirePermission("admin.users"), asyncHandler(upsertOverride));
router.delete(
  "/admin/users/:userId/overrides/:permissionKey",
  requireAuth,
  auditWrites(),
  requirePermission("admin.users"),
  asyncHandler(deleteOverride)
);

// Admin: role permissions (global)
router.get("/admin/roles", requireAuth, requirePermission("admin.users"), asyncHandler(listRolePermissions));
router.put("/admin/roles/:roleKey", requireAuth, auditWrites(), requirePermission("admin.users"), asyncHandler(updateRolePermissions));

// Admin: offices (dynamic list)
router.get("/admin/offices", requireAuth, requirePermission("admin.users"), asyncHandler(listOffices));
router.post("/admin/offices", requireAuth, auditWrites(), requirePermission("admin.users"), asyncHandler(createOffice));
router.delete("/admin/offices/:officeKey", requireAuth, auditWrites(), requirePermission("admin.users"), asyncHandler(deleteOffice));

module.exports = { authRouter: router };


