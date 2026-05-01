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
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Chip,
} from "@mui/material";

export default function UsersPage() {
  const { can } = useAuth();
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
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
          <Box>
            <Typography variant="h5">Users</Typography>
            <Typography variant="body2" color="text.secondary">
              Invite-only accounts. In dev mode, invites generate a link you can copy and send manually.
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {loading ? <CircularProgress /> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}

      {!isAdmin ? (
        <Alert severity="info">
          You don&apos;t have permission to manage users.
        </Alert>
      ) : null}

      {isAdmin ? (
        <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ sm: "center" }}>
            <Box>
              <Typography variant="h6">Users</Typography>
              <Typography variant="body2" color="text.secondary">
                View accounts, last login, effective permissions, and enable/disable access.
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <TextField
                size="small"
                label="Search"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="email, name, office"
                sx={{ minWidth: { xs: "100%", sm: 260 } }}
              />
              <Button variant="outlined" onClick={() => refreshAdminUsers()} disabled={adminUsersLoading}>
                Refresh
              </Button>
            </Stack>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {adminUsersLoading ? <CircularProgress /> : null}

          {filteredAdminUsers.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No users found.
            </Typography>
          ) : (
            <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
              <Box component="thead">
                <Box component="tr">
                  <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2 }}>
                    User
                  </Box>
                  <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2, width: 160 }}>
                    Status
                  </Box>
                  <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2, width: 220 }}>
                    Last login
                  </Box>
                  <Box component="th" sx={{ textAlign: "right", borderBottom: "1px solid", borderColor: "divider", py: 1, width: 320 }}>
                    Actions
                  </Box>
                </Box>
              </Box>
              <Box component="tbody">
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
                    <Box component="tr" key={u.id}>
                      <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2 }}>
                        <Typography sx={{ fontWeight: 800 }}>{u.email}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {linkedName} • Office: {u.brother_office ?? "—"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Permissions: {permsCount} • Overrides: {overridesCount}
                        </Typography>
                      </Box>
                      <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2 }}>
                        {disabled ? (
                          <Chip label="Disabled" color="error" size="small" />
                        ) : (
                          <Chip label="Active" color="success" size="small" />
                        )}
                      </Box>
                      <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2 }}>
                        {fmtDate(u.last_login_at)}
                      </Box>
                      <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, textAlign: "right" }}>
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
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
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}
        </Paper>
      ) : null}

      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="h6">Send invite</Typography>
        <Typography variant="body2" color="text.secondary">
          Select a brother to invite. Permissions are derived from that brother&apos;s <b>Office</b> (single source of truth).
        </Typography>

        <Divider sx={{ my: 2 }} />

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
                .sort((a, b) => String(a.last_name ?? "").localeCompare(String(b.last_name ?? "")))
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
                <b>{brothers.find((b) => b.id === Number(brotherId))?.office?.trim() || "— (none)"}</b>
              </Typography>
            </Paper>
          ) : null}

          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
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
                void refreshInvites();
              }}
            >
              Send invite
            </Button>
          </Box>

          {inviteUrl ? (
            <>
              <Alert severity="success">Invite created. Copy the link and send it to the user.</Alert>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                <TextField value={inviteUrl} fullWidth size="small" inputProps={{ readOnly: true }} />
                <Button
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
          ) : (
            <Typography variant="body2" color="text.secondary">
              Note: In production, the invite email would be delivered automatically (SES later). In dev mode you’ll see the link here and in API logs.
            </Typography>
          )}
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ sm: "center" }}>
          <Box>
            <Typography variant="h6">Invites</Typography>
            <Typography variant="body2" color="text.secondary">
              Manage outstanding invites (reissue generates a new link and revokes the old one).
            </Typography>
          </Box>
          <Button variant="outlined" onClick={() => refreshInvites()} disabled={invitesLoading}>
            Refresh
          </Button>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {invitesLoading ? <CircularProgress /> : null}

        {invites.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No invites yet.
          </Typography>
        ) : (
          <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
            <Box component="thead">
              <Box component="tr">
                <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2 }}>
                  Brother
                </Box>
                <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2 }}>
                  Email
                </Box>
                <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2, width: 220 }}>
                  Status
                </Box>
                <Box component="th" sx={{ textAlign: "right", borderBottom: "1px solid", borderColor: "divider", py: 1, width: 220 }}>
                  Actions
                </Box>
              </Box>
            </Box>
            <Box component="tbody">
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
                  <Box component="tr" key={i.id}>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2 }}>
                      <Typography sx={{ fontWeight: 700 }}>{brotherName}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Office: {i.brother_office ?? "—"}
                      </Typography>
                    </Box>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2 }}>
                      {i.email}
                    </Box>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2 }}>
                      {status}
                      {status === "Pending" && i.expires_at ? (
                        <Typography variant="body2" color="text.secondary">
                          Expires {new Date(i.expires_at as any).toLocaleString()}
                        </Typography>
                      ) : null}
                    </Box>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, textAlign: "right" }}>
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
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
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </Paper>

      {isAdmin ? (
        <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ sm: "center" }}>
            <Box>
              <Typography variant="h6">Permission overrides</Typography>
              <Typography variant="body2" color="text.secondary">
                Grant or deny specific permissions for a user (overrides role-based permissions from Office).
              </Typography>
            </Box>
            <Button variant="outlined" onClick={() => refreshAdminUsers()} disabled={adminUsersLoading}>
              Refresh users
            </Button>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {adminUsersLoading ? <CircularProgress /> : null}

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
                  <Typography variant="body2" color="text.secondary">
                    No overrides for this user.
                  </Typography>
                ) : (
                  <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
                    <Box component="thead">
                      <Box component="tr">
                        <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2 }}>
                          Permission
                        </Box>
                        <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2, width: 120 }}>
                          Effect
                        </Box>
                        <Box component="th" sx={{ textAlign: "right", borderBottom: "1px solid", borderColor: "divider", py: 1, width: 120 }}>
                          Actions
                        </Box>
                      </Box>
                    </Box>
                    <Box component="tbody">
                      {overrides.map((o) => (
                        <Box component="tr" key={`${o.user_id}:${o.permission_key}`}>
                          <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2 }}>
                            <Typography sx={{ fontWeight: 700 }}>{o.permission_key}</Typography>
                          </Box>
                          <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2 }}>
                            {o.effect}
                          </Box>
                          <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, textAlign: "right" }}>
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
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Select a user to manage overrides.
              </Typography>
            )}
          </Stack>
        </Paper>
      ) : null}

      {/* Permissions dialog */}
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
          <Button variant="outlined" onClick={() => setPermOpen(false)}>
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
          <Button variant="outlined" onClick={() => setConfirmDisableOpen(false)} disabled={updatingUserId === confirmDisableUser?.id}>
            Cancel
          </Button>
          <Button
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
    </Stack>
  );
}


