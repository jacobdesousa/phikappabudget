import * as React from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ReplayIcon from "@mui/icons-material/Replay";
import type { IBrother } from "../interfaces/api.interface";
import { getAllBrothers } from "../services/brotherService";
import {
  adminUpdateUserStatus,
  adminDeleteOverride,
  adminListOverrides,
  adminListUsers,
  adminUpsertOverride,
  getInvites,
  inviteUser,
  reissueInvite,
  revokeInvite,
  type AdminUserRow,
  type InviteListItem,
  type PermissionOverrideRow,
} from "../services/authService";
import { useAuth } from "../context/authContext";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { ConfigEmpty, ConfigPageLayout, ConfigSection } from "../components/config/configLayout";
import { CELL_SX, HEAD_SX, TABLE_CONTAINER_SX, TABLE_SX } from "../components/config/configTable";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Chip,
} from "@mui/material";

export default function UsersPage() {
  const { can, user, startViewAs } = useAuth();
  const canViewAs = can("admin.viewAs");
  const isAdmin = can("admin.users");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [brothers, setBrothers] = React.useState<IBrother[]>([]);
  const [invitesLoading, setInvitesLoading] = React.useState(false);
  const [invites, setInvites] = React.useState<InviteListItem[]>([]);
  const [adminUsersLoading, setAdminUsersLoading] = React.useState(false);
  const [adminUsers, setAdminUsers] = React.useState<AdminUserRow[]>([]);
  const [userSearch, setUserSearch] = React.useState("");
  const [updatingUserId, setUpdatingUserId] = React.useState<number | null>(null);
  const [permOpen, setPermOpen] = React.useState(false);
  // Confirmed rather than immediate: the session writes as this person, so the
  // click that starts it should be deliberate.
  const [viewAsTarget, setViewAsTarget] = React.useState<AdminUserRow | null>(null);
  const [viewAsBusy, setViewAsBusy] = React.useState(false);
  const [permUser, setPermUser] = React.useState<AdminUserRow | null>(null);
  const [confirmDisableOpen, setConfirmDisableOpen] = React.useState(false);
  const [confirmDisableUser, setConfirmDisableUser] = React.useState<AdminUserRow | null>(null);
  const [selectedUserId, setSelectedUserId] = React.useState<number | "">("");
  const [overridesLoading, setOverridesLoading] = React.useState(false);
  const [overrides, setOverrides] = React.useState<PermissionOverrideRow[]>([]);
  const [newOverrideKey, setNewOverrideKey] = React.useState("");
  const [newOverrideEffect, setNewOverrideEffect] = React.useState<"allow" | "deny">("allow");
  const [savingOverride, setSavingOverride] = React.useState(false);

  const [brotherId, setBrotherId] = React.useState<number | "">("");
  const [submitting, setSubmitting] = React.useState(false);

  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null);
  const [inviteSent, setInviteSent] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const refreshInvites = React.useCallback(async () => {
    setInvitesLoading(true);
    try {
      const rows = await getInvites();
      setInvites(rows ?? []);
    } finally {
      setInvitesLoading(false);
    }
  }, []);

  const refreshAdminUsers = React.useCallback(async () => {
    if (!isAdmin) return;
    setAdminUsersLoading(true);
    try {
      const rows = await adminListUsers();
      setAdminUsers(rows ?? []);
    } finally {
      setAdminUsersLoading(false);
    }
  }, [isAdmin]);

  const refreshOverrides = React.useCallback(async () => {
    if (!isAdmin) return;
    if (!selectedUserId) return;
    setOverridesLoading(true);
    try {
      const rows = await adminListOverrides(Number(selectedUserId));
      setOverrides(rows ?? []);
    } finally {
      setOverridesLoading(false);
    }
  }, [isAdmin, selectedUserId]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const b = await getAllBrothers();
        if (cancelled) return;
        setBrothers(b ?? []);
        await refreshInvites();
        await refreshAdminUsers();
      } catch (e: any) {
        setError(e?.message ?? "Failed to load brothers.");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    void refreshOverrides();
  }, [refreshOverrides]);

  const selectedUser = React.useMemo(() => {
    if (!selectedUserId) return null;
    return adminUsers.find((u) => u.id === Number(selectedUserId)) ?? null;
  }, [adminUsers, selectedUserId]);

  const filteredAdminUsers = React.useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return adminUsers;
    return adminUsers.filter((u) => {
      const email = String(u.email ?? "").toLowerCase();
      const name = `${u.brother_first_name ?? ""} ${u.brother_last_name ?? ""}`.trim().toLowerCase();
      const office = String(u.brother_office ?? "").toLowerCase();
      return email.includes(q) || name.includes(q) || office.includes(q);
    });
  }, [adminUsers, userSearch]);

  function fmtDate(value?: string | Date | null) {
    if (!value) return "—";
    try {
      return new Date(value as any).toLocaleString();
    } catch {
      return "—";
    }
  }

  return (
    <ConfigPageLayout
      title="User Settings"
      description="Invite-only accounts, their effective permissions, and access. In dev mode, invites generate a link you can copy and send manually."
      error={error}
    >
      {loading ? (
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress />
        </Stack>
      ) : null}

      {!isAdmin ? (
        <Alert severity="info">
          You don&apos;t have permission to manage users.
        </Alert>
      ) : null}

      {isAdmin ? (
        <ConfigSection
          title="Accounts"
          description="Last login, effective permissions, and whether the account can sign in."
          actions={
            <>
              <TextField
                size="small"
                label="Search"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="email, name, office"
                sx={{ minWidth: { xs: "100%", sm: 260 } }}
              />
              <Button size="small" variant="outlined" startIcon={<RefreshOutlinedIcon />} onClick={() => refreshAdminUsers()} disabled={adminUsersLoading}>
                Refresh
              </Button>
            </>
          }
        >
          {adminUsersLoading ? (
            <Stack alignItems="center" sx={{ py: 3 }}>
              <CircularProgress />
            </Stack>
          ) : null}

          {filteredAdminUsers.length === 0 ? (
            <ConfigEmpty>No users found.</ConfigEmpty>
          ) : (
            <TableContainer sx={TABLE_CONTAINER_SX}>
              <Table size="small" sx={{ ...TABLE_SX, minWidth: 780 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={HEAD_SX}>User</TableCell>
                    <TableCell sx={{ ...HEAD_SX, width: 110 }}>Status</TableCell>
                    <TableCell sx={{ ...HEAD_SX, width: 180 }}>Last login</TableCell>
                    <TableCell sx={{ ...HEAD_SX, width: 320 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                {filteredAdminUsers.map((u) => {
                  const linkedName = u.brother_last_name
                    ? `${u.brother_first_name ?? ""} ${u.brother_last_name}`.trim()
                    : u.brother_id
                      ? `Brother #${u.brother_id}`
                      : "—";
                  const status = String(u.status ?? "active").toLowerCase();
                  const disabled = status !== "active";
                  const permsCount = u.permissions?.length ?? 0;
                  const overridesCount = u.overrides_count ?? 0;
                  const busy = updatingUserId === u.id;
                  return (
                    <TableRow key={u.id} hover>
                      <TableCell sx={{ ...CELL_SX, whiteSpace: "normal", overflow: "hidden" }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{u.email}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {linkedName} • Office: {u.brother_office ?? "—"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Permissions: {permsCount} • Overrides: {overridesCount}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ ...CELL_SX, width: 110 }}>
                        {disabled ? (
                          <Chip label="Disabled" color="error" size="small" />
                        ) : (
                          <Chip label="Active" color="success" size="small" />
                        )}
                      </TableCell>
                      <TableCell sx={{ ...CELL_SX, width: 180, color: "text.secondary" }}>
                        {fmtDate(u.last_login_at)}
                      </TableCell>
                      <TableCell sx={{ ...CELL_SX, width: 320 }} align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          {/* Seeing the permission list answers what a role
                              grants; opening the app as them answers what it
                              actually looks like, which is usually the question. */}
                          {canViewAs && !disabled && u.id !== user?.id ? (
                            <Button
            size="small"
                              variant="outlined"
                              startIcon={<VisibilityOutlinedIcon />}
                              disabled={busy}
                              onClick={() => setViewAsTarget(u)}
                            >
                              View as
                            </Button>
                          ) : null}
                          <Button
            size="small"
                            variant="outlined"
                            disabled={busy}
                            onClick={() => {
                              setPermUser(u);
                              setPermOpen(true);
                            }}
                          >
                            View permissions
                          </Button>
                          {disabled ? (
                            <Button
            size="small"
                              variant="contained"
                              disabled={busy}
                              onClick={async () => {
                                setError(null);
                                setUpdatingUserId(u.id);
                                const res = await adminUpdateUserStatus(u.id, "active");
                                setUpdatingUserId(null);
                                if (!res.ok) {
                                  setError(res.error);
                                  return;
                                }
                                void refreshAdminUsers();
                              }}
                            >
                              Enable
                            </Button>
                          ) : (
                            <Button
            size="small"
                              variant="contained"
                              color="error"
                              disabled={busy}
                              onClick={() => {
                                setConfirmDisableUser(u);
                                setConfirmDisableOpen(true);
                              }}
                            >
                              Disable
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </ConfigSection>
      ) : null}

      <ConfigSection
        title="Send invite"
        description="Pick a brother to invite. Their permissions come from the Office on their brother record — there is nothing to set here."
      >
        <Stack spacing={2}>
          <FormControl fullWidth required>
            <InputLabel id="invite-brother-label">Brother</InputLabel>
            <Select
              labelId="invite-brother-label"
              label="Brother"
              value={brotherId}
              onChange={(e) => setBrotherId(e.target.value as any)}
            >
              {brothers
                .slice()
                .sort((a, b) => String(a.first_name ?? "").localeCompare(String(b.first_name ?? "")))
                .map((b) => (
                  <MenuItem key={b.id ?? `${b.first_name}-${b.last_name}`} value={b.id ?? ""}>
                    {b.first_name} {b.last_name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

          {brotherId ? (
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                Invite email:{" "}
                <b>{brothers.find((b) => b.id === Number(brotherId))?.email?.trim() || "— (missing)"}</b>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Role from office:{" "}
                <b>
                  {(() => {
                    const b = brothers.find((b) => b.id === Number(brotherId));
                    return (b?.current_offices ?? []).map((o) => o.display_name).join(", ") || b?.office?.trim() || "— (none)";
                  })()}
                </b>
              </Typography>
            </Paper>
          ) : null}

          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
            size="small"
              variant="contained"
              startIcon={<AddOutlinedIcon />}
              disabled={submitting}
              onClick={async () => {
                setError(null);
                setInviteUrl(null);
                setCopied(false);
                if (!brotherId) {
                  setError("Select a brother to invite.");
                  return;
                }
                setSubmitting(true);
                const res = await inviteUser({ brother_id: Number(brotherId) });
                setSubmitting(false);
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                setInviteUrl(res.invite_url ?? null);
                setInviteSent(true);
                void refreshInvites();
              }}
            >
              Send invite
            </Button>
          </Box>

          {inviteSent && !inviteUrl && (
            <Alert severity="success">Invite email sent successfully.</Alert>
          )}
          {inviteUrl && (
            <>
              <Alert severity="success">Invite created. Copy the link and send it to the user.</Alert>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                <TextField value={inviteUrl} fullWidth size="small" inputProps={{ readOnly: true }} />
                <Button
            size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inviteUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1200);
                    } catch {
                      setError("Could not copy automatically. Please copy it manually.");
                    }
                  }}
                >
                  {copied ? "Copied" : "Copy"}
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      </ConfigSection>

      <ConfigSection
        title="Invites"
        description="Outstanding invites. Reissuing generates a new link and revokes the old one."
        actions={
          <Button size="small" variant="outlined" startIcon={<RefreshOutlinedIcon />} onClick={() => refreshInvites()} disabled={invitesLoading}>
            Refresh
          </Button>
        }
      >
        {invitesLoading ? (
          <Stack alignItems="center" sx={{ py: 3 }}>
            <CircularProgress />
          </Stack>
        ) : null}

        {invites.length === 0 ? (
          <ConfigEmpty>No invites yet.</ConfigEmpty>
        ) : (
          <TableContainer sx={TABLE_CONTAINER_SX}>
            <Table size="small" sx={{ ...TABLE_SX, minWidth: 720 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={HEAD_SX}>Brother</TableCell>
                  <TableCell sx={{ ...HEAD_SX, width: 220 }}>Email</TableCell>
                  <TableCell sx={{ ...HEAD_SX, width: 190 }}>Status</TableCell>
                  <TableCell sx={{ ...HEAD_SX, width: 220 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
              {invites.map((i) => {
                const now = Date.now();
                const exp = i.expires_at ? new Date(i.expires_at as any).getTime() : 0;
                const expired = Boolean(exp && exp < now);
                const status = i.used_at ? "Used" : i.revoked_at ? "Revoked" : expired ? "Expired" : "Pending";
                const brotherName = i.brother_last_name
                  ? `${i.brother_first_name ?? ""} ${i.brother_last_name}`.trim()
                  : i.brother_id
                    ? `Brother #${i.brother_id}`
                    : "—";

                return (
                  <TableRow key={i.id} hover>
                    <TableCell sx={{ ...CELL_SX, overflow: "hidden", textOverflow: "ellipsis" }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{brotherName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Office: {i.brother_office ?? "—"}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ ...CELL_SX, width: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {i.email}
                    </TableCell>
                    <TableCell sx={{ ...CELL_SX, width: 190 }}>
                      {status}
                      {status === "Pending" && i.expires_at ? (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Expires {new Date(i.expires_at as any).toLocaleString()}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell sx={{ ...CELL_SX, width: 220 }} align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<ReplayIcon />}
                          disabled={Boolean(i.used_at)}
                          onClick={async () => {
                            setError(null);
                            setInviteUrl(null);
                            const res = await reissueInvite(i.id);
                            if (!res.ok) {
                              setError(res.error);
                              return;
                            }
                            setInviteUrl(res.invite_url ?? null);
                            void refreshInvites();
                          }}
                        >
                          Reissue
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<DeleteOutlineIcon />}
                          disabled={Boolean(i.used_at) || Boolean(i.revoked_at)}
                          onClick={async () => {
                            setError(null);
                            const res = await revokeInvite(i.id);
                            if (!res.ok) {
                              setError(res.error);
                              return;
                            }
                            void refreshInvites();
                          }}
                        >
                          Revoke
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </ConfigSection>

      {isAdmin ? (
        <ConfigSection
          title="Permission overrides"
          description="Grant or deny one permission for one user, on top of what their office already gives them."
          actions={
            <Button size="small" variant="outlined" startIcon={<RefreshOutlinedIcon />} onClick={() => refreshAdminUsers()} disabled={adminUsersLoading}>
              Refresh users
            </Button>
          }
        >
          {adminUsersLoading ? (
            <Stack alignItems="center" sx={{ py: 3 }}>
              <CircularProgress />
            </Stack>
          ) : null}

          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel id="override-user-label">User</InputLabel>
              <Select
                labelId="override-user-label"
                label="User"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value as any)}
              >
                <MenuItem value="">
                  <em>Select a user</em>
                </MenuItem>
                {adminUsers
                  .slice()
                  .sort((a, b) => String(a.email ?? "").localeCompare(String(b.email ?? "")))
                  .map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.email}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>

            {selectedUser ? (
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="body2" color="text.secondary">
                  Brother link:{" "}
                  <b>
                    {selectedUser.brother_last_name
                      ? `${selectedUser.brother_first_name ?? ""} ${selectedUser.brother_last_name}`.trim()
                      : selectedUser.brother_id
                        ? `Brother #${selectedUser.brother_id}`
                        : "—"}
                  </b>
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Office: <b>{selectedUser.brother_office ?? "—"}</b>
                </Typography>
              </Paper>
            ) : null}

            {selectedUserId ? (
              <>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                  <TextField
                    label="Permission key"
                    value={newOverrideKey}
                    onChange={(e) => setNewOverrideKey(e.target.value)}
                    placeholder="e.g., expenses.disburse"
                    fullWidth
                    size="small"
                  />
                  <FormControl sx={{ minWidth: 140 }} size="small">
                    <InputLabel id="override-effect-label">Effect</InputLabel>
                    <Select
                      labelId="override-effect-label"
                      label="Effect"
                      value={newOverrideEffect}
                      onChange={(e) => setNewOverrideEffect(e.target.value as any)}
                    >
                      <MenuItem value="allow">Allow</MenuItem>
                      <MenuItem value="deny">Deny</MenuItem>
                    </Select>
                  </FormControl>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={savingOverride || !newOverrideKey.trim()}
                    onClick={async () => {
                      if (!selectedUserId) return;
                      setError(null);
                      setSavingOverride(true);
                      const res = await adminUpsertOverride(Number(selectedUserId), {
                        permission_key: newOverrideKey.trim(),
                        effect: newOverrideEffect,
                      });
                      setSavingOverride(false);
                      if (!res.ok) {
                        setError(res.error);
                        return;
                      }
                      setNewOverrideKey("");
                      void refreshOverrides();
                    }}
                  >
                    Add / Update
                  </Button>
                </Stack>

                <Divider />

                {overridesLoading ? <CircularProgress /> : null}

                {overrides.length === 0 ? (
                  <ConfigEmpty>No overrides for this user.</ConfigEmpty>
                ) : (
                  <TableContainer sx={TABLE_CONTAINER_SX}>
                    <Table size="small" sx={TABLE_SX}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={HEAD_SX}>Permission</TableCell>
                          <TableCell sx={{ ...HEAD_SX, width: 110 }}>Effect</TableCell>
                          <TableCell sx={{ ...HEAD_SX, width: 130 }} align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                      {overrides.map((o) => (
                        <TableRow key={`${o.user_id}:${o.permission_key}`} hover>
                          <TableCell sx={{ ...CELL_SX, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {o.permission_key}
                          </TableCell>
                          <TableCell sx={{ ...CELL_SX, width: 110 }}>
                            <Chip
                              size="small"
                              label={o.effect}
                              color={o.effect === "deny" ? "error" : "success"}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell sx={{ ...CELL_SX, width: 130 }} align="right">
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<DeleteOutlineIcon />}
                              onClick={async () => {
                                if (!selectedUserId) return;
                                setError(null);
                                const res = await adminDeleteOverride(Number(selectedUserId), o.permission_key);
                                if (!res.ok) {
                                  setError(res.error);
                                  return;
                                }
                                void refreshOverrides();
                              }}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            ) : (
              <ConfigEmpty>Select a user to manage overrides.</ConfigEmpty>
            )}
          </Stack>
        </ConfigSection>
      ) : null}

      {/* Permissions dialog */}
      <Dialog open={Boolean(viewAsTarget)} onClose={() => setViewAsTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>View as {viewAsTarget?.email}?</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            The app will open exactly as this user sees it — their pages, their permissions, their
            data.
          </Typography>
          <Alert severity="warning">
            This is not a preview. Anything you do is real and takes effect on their behalf. Every
            action is recorded in the audit log against your account, noting it was taken while
            viewing as them.
          </Alert>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
            The session lasts 30 minutes, or until you leave it from the banner at the top.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            size="small" variant="outlined" onClick={() => setViewAsTarget(null)} disabled={viewAsBusy}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            color="warning"
            disabled={viewAsBusy}
            onClick={async () => {
              if (!viewAsTarget) return;
              setError(null);
              setViewAsBusy(true);
              const res = await startViewAs(viewAsTarget.id);
              setViewAsBusy(false);
              if (!res.ok) {
                setViewAsTarget(null);
                setError(res.error ?? "Could not start the session.");
              }
              // On success the page navigates; nothing to clean up here.
            }}
          >
            {viewAsBusy ? "Starting…" : "View as this user"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={permOpen} onClose={() => setPermOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Effective permissions</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary">
            {permUser?.email ?? "—"}
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Roles
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {(permUser?.roles ?? []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                None
              </Typography>
            ) : (
              (permUser?.roles ?? []).map((r) => <Chip key={r} label={r} size="small" />)
            )}
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Permissions ({permUser?.permissions?.length ?? 0})
          </Typography>
          <Stack spacing={0.5}>
            {(permUser?.permissions ?? []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                None
              </Typography>
            ) : (
              (permUser?.permissions ?? [])
                .slice()
                .sort((a, b) => a.localeCompare(b))
                .map((p) => (
                  <Typography key={p} variant="body2">
                    {p}
                  </Typography>
                ))
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            size="small" variant="outlined" onClick={() => setPermOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Disable confirm */}
      <Dialog open={confirmDisableOpen} onClose={() => setConfirmDisableOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Disable user</DialogTitle>
        <DialogContent dividers>
          <Typography>
            Disable <b>{confirmDisableUser?.email ?? "this user"}</b>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            They will be unable to access protected pages and API routes (even if they still have a token).
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            size="small" variant="outlined" onClick={() => setConfirmDisableOpen(false)} disabled={updatingUserId === confirmDisableUser?.id}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            color="error"
            disabled={!confirmDisableUser?.id || updatingUserId === confirmDisableUser?.id}
            onClick={async () => {
              if (!confirmDisableUser?.id) return;
              setError(null);
              setUpdatingUserId(confirmDisableUser.id);
              const res = await adminUpdateUserStatus(confirmDisableUser.id, "disabled");
              setUpdatingUserId(null);
              if (!res.ok) {
                setError(res.error);
                return;
              }
              setConfirmDisableOpen(false);
              setConfirmDisableUser(null);
              void refreshAdminUsers();
            }}
          >
            Disable
          </Button>
        </DialogActions>
      </Dialog>
    </ConfigPageLayout>
  );
}


