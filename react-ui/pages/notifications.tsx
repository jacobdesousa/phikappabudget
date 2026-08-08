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
import { getNotifications, type UpcomingShift } from "../services/notificationsService";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function shiftLabel(t: UpcomingShift["shift_type"]) {
  return t === "setup" ? "Setup" : t === "cleanup" ? "Cleanup" : "Party";
}

function shiftColor(t: UpcomingShift["shift_type"]): "info" | "warning" | "success" {
  return t === "setup" ? "info" : t === "cleanup" ? "warning" : "success";
}

export default function NotificationsPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [shifts, setShifts] = React.useState<UpcomingShift[]>([]);

  React.useEffect(() => {
    setLoading(true);
    getNotifications()
      .then((d) => setShifts(d.upcoming_shifts ?? []))
      .catch((e) => setError(e?.message ?? "Failed to load notifications."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="h5">Notifications</Typography>
        <Typography variant="body2" color="text.secondary">
          Your upcoming assigned shifts.
        </Typography>
      </Paper>

      {loading && (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      )}
      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && (
        <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Upcoming Shifts</Typography>
          {shifts.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No upcoming shifts assigned.</Typography>
          ) : (
            <Stack spacing={0} divider={<Divider />}>
              {shifts.map((s) => (
                <Stack key={s.id} direction="row" spacing={1.5} alignItems="center" sx={{ py: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, minWidth: 80 }}>
                    {fmtDate(s.event_date)}
                  </Typography>
                  <Chip label={shiftLabel(s.shift_type)} size="small" color={shiftColor(s.shift_type)} />
                  <Typography variant="body2">
                    <Link href={`/shifts/${s.id}`} style={{ textDecoration: "underline" }}>
                      {s.title ?? `${shiftLabel(s.shift_type)} Shift`}
                    </Link>
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </Paper>
      )}
    </Stack>
  );
}
