import * as React from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Link from "next/link";
import {
  getAllMakeups,
  type IAllMakeups,
  type AllMakeupsShift,
} from "../services/notificationsService";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function shiftLabel(t: AllMakeupsShift["shift_type"]) {
  return t === "setup" ? "Setup" : t === "cleanup" ? "Cleanup" : "Party";
}
function shiftColor(t: AllMakeupsShift["shift_type"]): "info" | "warning" | "success" {
  return t === "setup" ? "info" : t === "cleanup" ? "warning" : "success";
}

export default function MakeupsPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<IAllMakeups | null>(null);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    setLoading(true);
    getAllMakeups()
      .then((d) => setData(d))
      .catch((e) => setError(e?.message ?? "Failed to load makeups."))
      .finally(() => setLoading(false));
  }, []);

  const q = search.trim().toLowerCase();

  const workdayRows = React.useMemo(() => {
    if (!data) return [];
    if (!q) return data.workday_makeups;
    return data.workday_makeups.filter(
      (r) =>
        `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
        (r.title ?? "").toLowerCase().includes(q)
    );
  }, [data, q]);

  const shiftRows = React.useMemo(() => {
    if (!data) return [];
    if (!q) return data.shift_makeups;
    return data.shift_makeups.filter(
      (r) =>
        `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
        (r.title ?? "").toLowerCase().includes(q)
    );
  }, [data, q]);

  const total = (data?.workday_makeups?.length ?? 0) + (data?.shift_makeups?.length ?? 0);

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1}>
          <Box>
            <Typography variant="h5">Outstanding Makeups</Typography>
            <Typography variant="body2" color="text.secondary">
              All unresolved absences requiring makeup — workdays and shifts.
            </Typography>
          </Box>
          <TextField
            size="small"
            label="Search"
            placeholder="name or event"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 220 }}
          />
        </Stack>
      </Paper>

      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && data && total === 0 && (
        <Alert severity="success">No outstanding makeups.</Alert>
      )}

      {!loading && !error && workdayRows.length > 0 && (
        <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Workday Makeups ({data?.workday_makeups.length ?? 0})
          </Typography>
          <Stack spacing={0} divider={<Divider />}>
            {workdayRows.map((r, i) => (
              <Stack key={`wd-${r.workday_id}-${r.brother_id}-${i}`} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} sx={{ py: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 160 }}>
                  {r.last_name}, {r.first_name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110 }}>
                  {fmtDate(r.workday_date)}
                </Typography>
                <Typography variant="body2">
                  <Link href={`/workdays/${r.workday_id}`} style={{ textDecoration: "underline" }}>
                    {r.title ?? "Workday"}
                  </Link>
                </Typography>
                <Chip label={r.status} size="small" color="error" />
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}

      {!loading && !error && shiftRows.length > 0 && (
        <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Shift Makeups ({data?.shift_makeups.length ?? 0})
          </Typography>
          <Stack spacing={0} divider={<Divider />}>
            {shiftRows.map((r, i) => (
              <Stack key={`sh-${r.shift_id}-${r.brother_id}-${i}`} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} sx={{ py: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 160 }}>
                  {r.last_name}, {r.first_name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110 }}>
                  {fmtDate(r.event_date)}
                </Typography>
                <Chip label={shiftLabel(r.shift_type)} size="small" color={shiftColor(r.shift_type)} />
                <Typography variant="body2">
                  <Link href={`/shifts/${r.shift_id}`} style={{ textDecoration: "underline" }}>
                    {r.title ?? `${shiftLabel(r.shift_type)} Shift`}
                  </Link>
                </Typography>
                <Chip label="Absent" size="small" color="error" />
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
