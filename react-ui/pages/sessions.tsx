import * as React from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { getSessions, revokeAllSessions, revokeSession, type SessionRow } from "../services/authService";

function fmtDate(value?: string | Date | null) {
  if (!value) return "—";
  try {
    return new Date(value as any).toLocaleString();
  } catch {
    return "—";
  }
}

export default function SessionsPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sessions, setSessions] = React.useState<SessionRow[]>([]);
  const [revokingAll, setRevokingAll] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSessions();
      setSessions(res.sessions ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load sessions.");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
          <Box>
            <Typography variant="h5">Sessions</Typography>
            <Typography variant="body2" color="text.secondary">
              Manage devices where you&apos;re signed in (refresh-token sessions).
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => refresh()} disabled={loading}>
              Refresh
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteOutlineIcon />}
              disabled={loading || revokingAll || sessions.length === 0}
              onClick={async () => {
                setRevokingAll(true);
                setError(null);
                const res = await revokeAllSessions({ keep_current: true });
                setRevokingAll(false);
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                void refresh();
              }}
            >
              Revoke others
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {loading ? (
        <CircularProgress />
      ) : sessions.length === 0 ? (
        <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <Typography variant="body2" color="text.secondary">
            No sessions found.
          </Typography>
        </Paper>
      ) : (
        <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <Typography variant="h6">Active sessions</Typography>
          <Typography variant="body2" color="text.secondary">
            The current session is marked. Revoking it will sign you out on this device.
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
            <Box component="thead">
              <Box component="tr">
                <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2 }}>
                  Device
                </Box>
                <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2 }}>
                  Created
                </Box>
                <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2 }}>
                  Expires
                </Box>
                <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2 }}>
                  Status
                </Box>
                <Box component="th" sx={{ textAlign: "right", borderBottom: "1px solid", borderColor: "divider", py: 1 }}>
                  Actions
                </Box>
              </Box>
            </Box>
            <Box component="tbody">
              {sessions.map((s) => {
                const status = s.revoked_at ? "Revoked" : s.is_current ? "Current" : "Active";
                return (
                  <Box component="tr" key={s.id}>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2 }}>
                      <Typography sx={{ fontWeight: 700 }}>{s.ip ?? "—"}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520 }}>
                        {s.user_agent ?? "—"}
                      </Typography>
                    </Box>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2 }}>
                      {fmtDate(s.created_at)}
                    </Box>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2 }}>
                      {fmtDate(s.expires_at)}
                    </Box>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, pr: 2 }}>
                      {status}
                    </Box>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, textAlign: "right" }}>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        disabled={Boolean(s.revoked_at)}
                        onClick={async () => {
                          setError(null);
                          const res = await revokeSession(s.id);
                          if (!res.ok) {
                            setError(res.error);
                            return;
                          }
                          void refresh();
                        }}
                      >
                        Revoke
                      </Button>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Paper>
      )}
    </Stack>
  );
}


