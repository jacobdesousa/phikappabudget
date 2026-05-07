import * as React from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import Link from "next/link";
import {
  getNotifications,
  type INotifications,
  type UpcomingShift,
} from "../services/notificationsService";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function shiftTypeLabel(t: UpcomingShift["shift_type"]) {
  return t === "setup" ? "Setup" : t === "cleanup" ? "Cleanup" : "Party";
}

function shiftTypeColor(t: UpcomingShift["shift_type"]): "info" | "warning" | "success" {
  return t === "setup" ? "info" : t === "cleanup" ? "warning" : "success";
}

type AnyEvent =
  | { kind: "workday"; id: number; date: string; label: string; href: string }
  | { kind: "shift"; id: number; date: string; label: string; href: string; shift_type: UpcomingShift["shift_type"] }
  | { kind: "meeting"; id: number; date: string; label: string; href: string };

export default function NotificationsPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<INotifications | null>(null);

  React.useEffect(() => {
    setLoading(true);
    getNotifications()
      .then((d) => setData(d))
      .catch((e) => setError(e?.message ?? "Failed to load notifications."))
      .finally(() => setLoading(false));
  }, []);

  const upcomingEvents = React.useMemo<AnyEvent[]>(() => {
    if (!data) return [];
    const events: AnyEvent[] = [
      ...(data.upcoming_workdays ?? []).map((w) => ({
        kind: "workday" as const,
        id: w.id,
        date: w.workday_date,
        label: w.title ?? "Workday",
        href: `/workdays/${w.id}`,
      })),
      ...(data.upcoming_shifts ?? []).map((s) => ({
        kind: "shift" as const,
        id: s.id,
        date: s.event_date,
        label: s.title ?? `${shiftTypeLabel(s.shift_type)} Shift`,
        href: `/shifts/${s.id}`,
        shift_type: s.shift_type,
      })),
      ...(data.upcoming_meetings ?? []).map((m) => ({
        kind: "meeting" as const,
        id: m.id,
        date: m.meeting_date,
        label: m.title ?? "Meeting",
        href: `/meetings/${m.id}`,
      })),
    ];
    return events.sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const hasMakeups =
    (data?.workday_makeups?.length ?? 0) > 0 ||
    (data?.shift_makeups?.length ?? 0) > 0;

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="h5">Notifications</Typography>
        <Typography variant="body2" color="text.secondary">
          Upcoming events and your outstanding makeups.
        </Typography>
      </Paper>

      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && data && (
        <>
          {hasMakeups && (
            <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "error.main" }}>
              <Typography variant="h6" color="error" sx={{ mb: 1 }}>
                Makeups Due
              </Typography>
              <Stack spacing={0.5}>
                {(data.workday_makeups ?? []).map((m) => (
                  <Stack key={`wd-${m.id}`} direction="row" spacing={1} alignItems="center">
                    <Chip label="Workday" size="small" />
                    <Typography variant="body2">
                      <Link href={`/workdays/${m.id}`} style={{ textDecoration: "underline" }}>
                        {m.title ?? "Workday"} — {fmtDate(m.workday_date)}
                      </Link>
                    </Typography>
                  </Stack>
                ))}
                {(data.shift_makeups ?? []).map((m) => (
                  <Stack key={`sh-${m.id}`} direction="row" spacing={1} alignItems="center">
                    <Chip label={shiftTypeLabel(m.shift_type)} size="small" color={shiftTypeColor(m.shift_type)} />
                    <Typography variant="body2">
                      <Link href={`/shifts/${m.id}`} style={{ textDecoration: "underline" }}>
                        {m.title ?? `${shiftTypeLabel(m.shift_type)} Shift`} — {fmtDate(m.event_date)}
                      </Link>
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          )}

          {!hasMakeups && (
            <Alert severity="success">No outstanding makeups.</Alert>
          )}

          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Upcoming (next 60 days)
            </Typography>
            {upcomingEvents.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Nothing scheduled.</Typography>
            ) : (
              <Stack spacing={0} divider={<Divider />}>
                {upcomingEvents.map((e, i) => (
                  <Stack key={`${e.kind}-${e.id}-${i}`} direction="row" spacing={1.5} alignItems="center" sx={{ py: 1 }}>
                    <Box sx={{ minWidth: 80 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        {fmtDate(e.date)}
                      </Typography>
                    </Box>
                    {e.kind === "shift" ? (
                      <Chip label={shiftTypeLabel(e.shift_type)} size="small" color={shiftTypeColor(e.shift_type)} />
                    ) : e.kind === "workday" ? (
                      <Chip label="Workday" size="small" />
                    ) : (
                      <Chip label="Meeting" size="small" variant="outlined" />
                    )}
                    <Typography variant="body2">
                      <Link href={e.href} style={{ textDecoration: "underline" }}>
                        {e.label}
                      </Link>
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </Paper>
        </>
      )}
    </Stack>
  );
}
