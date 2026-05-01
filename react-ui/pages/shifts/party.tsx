import * as React from "react";
import { useRouter } from "next/router";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import dayjs from "dayjs";
import type { IShiftEvent, IShiftBrotherCount } from "../../interfaces/api.interface";
import { listShifts, createShift, deleteShift, getBrotherCounts } from "../../services/shiftsService";
import { useAuth } from "../../context/authContext";

const SHIFT_TYPE = "party";
const CURRENT_SCHOOL_YEAR = (() => {
  const now = dayjs();
  return now.month() >= 8 ? now.year() : now.year() - 1;
})();

function todayIso() {
  return dayjs().format("YYYY-MM-DD");
}

export default function PartyShiftsPage() {
  const router = useRouter();
  const { can } = useAuth();
  const canWrite = can("shifts.party.write");

  const [schoolYear, setSchoolYear] = React.useState(CURRENT_SCHOOL_YEAR);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [shifts, setShifts] = React.useState<IShiftEvent[]>([]);
  const [counts, setCounts] = React.useState<IShiftBrotherCount[]>([]);

  const [addOpen, setAddOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [newDate, setNewDate] = React.useState(todayIso());
  const [newTitle, setNewTitle] = React.useState("");
  const [newNotes, setNewNotes] = React.useState("");
  const [newStartTime, setNewStartTime] = React.useState("20:00");
  const [newEndTime, setNewEndTime] = React.useState("24:00");
  const [duties, setDuties] = React.useState<string[]>(["Door", "Bar", "Floor"]);
  const [addError, setAddError] = React.useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<IShiftEvent | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const [s, c] = await Promise.all([
      listShifts(SHIFT_TYPE, schoolYear),
      getBrotherCounts(SHIFT_TYPE, schoolYear),
    ]);
    setShifts(s);
    setCounts(c);
    setLoading(false);
  }, [schoolYear]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const yearOptions = React.useMemo(() => {
    const opts = [];
    for (let y = CURRENT_SCHOOL_YEAR; y >= CURRENT_SCHOOL_YEAR - 4; y--) opts.push(y);
    return opts;
  }, []);

  function updateDuty(i: number, val: string) {
    setDuties((prev) => prev.map((d, idx) => (idx === i ? val : d)));
  }

  function removeDuty(i: number) {
    setDuties((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addDuty() {
    setDuties((prev) => [...prev, ""]);
  }

  const validDuties = duties.filter((d) => d.trim().length > 0);

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ sm: "center" }}>
          <Box>
            <Typography variant="h5">Party Shifts</Typography>
            <Typography variant="body2" color="text.secondary">
              Schedule and track party shifts with duty assignments.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              select
              size="small"
              label="School year"
              value={schoolYear}
              onChange={(e) => setSchoolYear(Number(e.target.value))}
              SelectProps={{ native: true }}
              sx={{ minWidth: 120 }}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}–{y + 1}</option>
              ))}
            </TextField>
            {canWrite && (
              <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => { setAddError(null); setAddOpen(true); }}>
                New party
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <CircularProgress />
      ) : (
        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexDirection: { xs: "column", md: "row" } }}>
          <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
              {shifts.length === 0 && (
                <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
                  <Typography variant="body2" color="text.secondary">
                    No party shifts for {schoolYear}–{schoolYear + 1}.
                  </Typography>
                </Paper>
              )}
              {shifts.map((s) => (
                <Paper
                  key={s.id}
                  elevation={0}
                  sx={{ p: 2, border: "1px solid", borderColor: "divider", cursor: "pointer", "&:hover": { borderColor: "text.secondary" } }}
                  onClick={() => void router.push(`/shifts/${s.id}`)}
                >
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ sm: "center" }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {dayjs(s.event_date).format("MMM D, YYYY")}
                        {s.title ? ` — ${s.title}` : ""}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {s.party_start_time && s.party_end_time
                          ? `${s.party_start_time} – ${s.party_end_time}`
                          : "Time TBD"}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label="Party" size="small" color="primary" />
                      {canWrite && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteError(null);
                            setDeleteTarget(s);
                            setDeleteOpen(true);
                          }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Stack>
                  </Stack>
                </Paper>
              ))}
          </Stack>

          <Box sx={{ width: { xs: "100%", md: 300 }, flexShrink: 0 }}>
            <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Fairness Queue — {schoolYear}–{schoolYear + 1}
              </Typography>
              {counts.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No brothers found.</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Brother</TableCell>
                      <TableCell align="right">Parties</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {counts.map((c) => (
                      <TableRow key={c.brother_id}>
                        <TableCell>{c.first_name} {c.last_name}</TableCell>
                        <TableCell align="right">{c.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Paper>
          </Box>
        </Box>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          New party shift
          <IconButton onClick={() => setAddOpen(false)} aria-label="close"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {addError && <Alert severity="error" sx={{ mb: 2 }}>{addError}</Alert>}
          <Stack spacing={2}>
            <TextField label="Date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="Title (optional)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} fullWidth />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Start time"
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                placeholder="20:00"
                helperText="24h, e.g. 20:00"
                fullWidth
              />
              <TextField
                label="End time"
                value={newEndTime}
                onChange={(e) => setNewEndTime(e.target.value)}
                placeholder="24:00"
                helperText="Use 24+ for overnight, e.g. 26:00 = 2am"
                fullWidth
              />
            </Stack>
            <TextField label="Notes (optional)" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} fullWidth multiline minRows={2} />

            <Divider />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Duties</Typography>
              <Stack spacing={1}>
                {duties.map((d, i) => (
                  <Stack key={i} direction="row" spacing={1} alignItems="center">
                    <TextField
                      size="small"
                      value={d}
                      onChange={(e) => updateDuty(i, e.target.value)}
                      placeholder={`Duty ${i + 1}`}
                      fullWidth
                    />
                    <IconButton size="small" onClick={() => removeDuty(i)} disabled={duties.length <= 1}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
              <Button size="small" startIcon={<AddOutlinedIcon />} onClick={addDuty} sx={{ mt: 1 }}>
                Add duty
              </Button>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setAddOpen(false)} disabled={submitting}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            disabled={submitting || !newDate || validDuties.length === 0}
            onClick={async () => {
              setSubmitting(true);
              setAddError(null);
              const res = await createShift({
                shift_type: SHIFT_TYPE,
                event_date: newDate,
                title: newTitle || null,
                notes: newNotes || null,
                party_start_time: newStartTime || null,
                party_end_time: newEndTime || null,
                duties: validDuties,
              });
              setSubmitting(false);
              if (!res.ok) {
                setAddError(res.error?.message ?? "Failed to create shift.");
                return;
              }
              setAddOpen(false);
              setNewTitle("");
              setNewNotes("");
              await router.push(`/shifts/${res.data!.id}`);
            }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          Delete party shift
          <IconButton onClick={() => setDeleteOpen(false)} aria-label="close"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {deleteError && <Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert>}
          <Typography>
            Delete party shift on <b>{deleteTarget ? dayjs(deleteTarget.event_date).format("MMM D, YYYY") : "—"}</b>?
            This will remove all slots and assignments.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            disabled={deleting || !deleteTarget}
            onClick={async () => {
              if (!deleteTarget) return;
              setDeleting(true);
              setDeleteError(null);
              const res = await deleteShift(deleteTarget.id);
              setDeleting(false);
              if (!res.ok) {
                setDeleteError(res.error?.message ?? "Failed to delete.");
                return;
              }
              setDeleteOpen(false);
              setDeleteTarget(null);
              await refresh();
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
