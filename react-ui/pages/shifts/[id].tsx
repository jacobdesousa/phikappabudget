import * as React from "react";
import { useRouter } from "next/router";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import dayjs from "dayjs";
import type { IBrother, IShiftEvent, IShiftAssignment, IShiftPartySlot, IShiftPartyDuty } from "../../interfaces/api.interface";
import {
  getShift,
  updateShift,
  createPartyDuty,
  updatePartyDuty,
  deletePartyDuty,
  getBrotherCounts,
} from "../../services/shiftsService";
import { getAllBrothers } from "../../services/brotherService";
import type { IShiftBrotherCount } from "../../interfaces/api.interface";
import SaveIndicator from "../../components/SaveIndicator";
import { useAuth } from "../../context/authContext";
import { endsNextDay, formatSlotRange, generateSlotStarts, toClockTime } from "../../utils/partyTime";
import PartyTimetableShare from "../../components/shifts/PartyTimetableShare";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import PageLoader from "../../components/PageLoader";

type AttendanceStatus = "assigned" | "present" | "absent";
const STATUS_CYCLE: AttendanceStatus[] = ["assigned", "present", "absent"];
const STATUS_COLOR: Record<AttendanceStatus, "default" | "success" | "error"> = {
  assigned: "default",
  present: "success",
  absent: "error",
};

function nextStatus(s: AttendanceStatus): AttendanceStatus {
  const i = STATUS_CYCLE.indexOf(s);
  return STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length];
}

export default function ShiftDetailPage() {
  const router = useRouter();
  const { can } = useAuth();
  const id = Number(router.query.id);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [shift, setShift] = React.useState<IShiftEvent | null>(null);
  const [brothers, setBrothers] = React.useState<IBrother[]>([]);
  const [counts, setCounts] = React.useState<IShiftBrotherCount[]>([]);

  // Drafts for header autosave
  const [draftDate, setDraftDate] = React.useState("");
  const [draftTitle, setDraftTitle] = React.useState("");
  const [draftNotes, setDraftNotes] = React.useState("");
  const [draftStartTime, setDraftStartTime] = React.useState("");
  const [draftEndTime, setDraftEndTime] = React.useState("");

  // Assignments draft (setup/cleanup)
  const [draftAssignments, setDraftAssignments] = React.useState<IShiftAssignment[]>([]);
  // Slots draft (party)
  const [draftSlots, setDraftSlots] = React.useState<IShiftPartySlot[]>([]);
  // Duties (party)
  const [duties, setDuties] = React.useState<IShiftPartyDuty[]>([]);
  // Which way round the timetable reads. Remembered per person, since it is a
  // preference rather than a property of the party.
  const [dutyRows, setDutyRows] = React.useState(true);
  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem("pks-party-duty-rows");
      if (saved !== null) setDutyRows(saved === "1");
    } catch {
      // ignore
    }
  }, []);
  React.useEffect(() => {
    try {
      window.localStorage.setItem("pks-party-duty-rows", dutyRows ? "1" : "0");
    } catch {
      // ignore
    }
  }, [dutyRows]);

  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  // Add duty dialog
  const [dutyDialogOpen, setDutyDialogOpen] = React.useState(false);
  const [newDutyName, setNewDutyName] = React.useState("");
  const [dutyError, setDutyError] = React.useState<string | null>(null);
  const [dutySubmitting, setDutySubmitting] = React.useState(false);

  // Rename duty
  const [renameDuty, setRenameDuty] = React.useState<IShiftPartyDuty | null>(null);
  const [renameName, setRenameName] = React.useState("");
  const [renameError, setRenameError] = React.useState<string | null>(null);
  const [renameSubmitting, setRenameSubmitting] = React.useState(false);

  // Delete duty confirm
  const [deleteDutyTarget, setDeleteDutyTarget] = React.useState<IShiftPartyDuty | null>(null);
  const [deleteDutyError, setDeleteDutyError] = React.useState<string | null>(null);
  const [deleteDutyBusy, setDeleteDutyBusy] = React.useState(false);

  const debounceTimerRef = React.useRef<any>(null);
  const lastHashRef = React.useRef<string | null>(null);
  const saveSeqRef = React.useRef(0);
  const [autosaveReady, setAutosaveReady] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);

  const canWritePerm = shift
    ? can(`shifts.${shift.shift_type}.write`)
    : false;

  const refresh = React.useCallback(async () => {
    if (!id || !Number.isFinite(id)) return;
    setLoading(true);
    setError(null);
    const data = await getShift(id);
    if (!data) {
      setError("Shift not found.");
      setLoading(false);
      return;
    }
    setShift(data);
    setDraftDate(dayjs(data.event_date).format("YYYY-MM-DD"));
    setDraftTitle(data.title ?? "");
    setDraftNotes(data.notes ?? "");
    setDraftStartTime(data.party_start_time ?? "");
    setDraftEndTime(data.party_end_time ?? "");
    setDraftAssignments((data.assignments ?? []).slice());
    setDraftSlots((data.slots ?? []).slice());
    setDuties((data.duties ?? []).slice().sort((a, b) => a.display_order - b.display_order));
    setAutosaveReady(false);
    lastHashRef.current = null;
    setLoading(false);
    // Fetch fairness counts for this shift type + school year
    if (data.shift_type && data.school_year) {
      getBrotherCounts(data.shift_type, data.school_year).then(setCounts);
    }
  }, [id]);

  React.useEffect(() => {
    void refresh();
    void getAllBrothers().then(setBrothers);
  }, [refresh]);

  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Narrowing the party window clears the slots past the new end, so the save
  // waits on a confirmation naming what would go. Keyed by the window itself,
  // so confirming once doesn't wave through a later change.
  const [shrinkConfirm, setShrinkConfirm] = React.useState<
    { start: string; end: string; dropped: IShiftPartySlot[] } | null
  >(null);
  const confirmedWindowRef = React.useRef<string | null>(null);
  const [confirmToken, setConfirmToken] = React.useState(0);

  // Mark initial state as saved after first load
  React.useEffect(() => {
    if (!shift || loading || autosaveReady) return;
    const hash = buildHash();
    lastHashRef.current = hash;
    setAutosaveReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift, loading, autosaveReady]);

  function buildHash() {
    return JSON.stringify({ draftDate, draftTitle, draftNotes, draftStartTime, draftEndTime, draftAssignments, draftSlots });
  }

  // Debounced autosave
  React.useEffect(() => {
    if (!autosaveReady || !shift || !Number.isFinite(id) || id <= 0) return;
    const hash = buildHash();
    if (hash === lastHashRef.current) return;

    // A party whose hours shrank loses the slots past the new end. Ask first,
    // and name the brothers who would come off the grid.
    if (shift.shift_type === "party" && draftStartTime && draftEndTime) {
      const windowKey = `${draftStartTime}|${draftEndTime}`;
      const kept = new Set(generateSlotStarts(draftStartTime, draftEndTime));
      const dropped = draftSlots.filter((sl) => !kept.has(sl.slot_start));
      const assignedDropped = dropped.filter((sl) => sl.brother_id);
      if (assignedDropped.length > 0 && confirmedWindowRef.current !== windowKey) {
        // Drop any save already queued from an earlier keystroke, or it would
        // fire behind the dialog.
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        setShrinkConfirm({ start: draftStartTime, end: draftEndTime, dropped: assignedDropped });
        return;
      }
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      const seq = ++saveSeqRef.current;
      setSaving(true);
      setSaveError(null);

      const payload: Parameters<typeof updateShift>[1] = {
        event_date: draftDate,
        title: draftTitle || null,
        notes: draftNotes || null,
      };
      if (shift.shift_type === "party") {
        payload.party_start_time = draftStartTime || null;
        payload.party_end_time = draftEndTime || null;
        payload.slots = draftSlots.map((sl) => ({
          duty_id: sl.duty_id,
          slot_start: sl.slot_start,
          brother_id: sl.brother_id ?? null,
          status: sl.status,
          makeup_completed_at: sl.makeup_completed_at ?? null,
        }));
      } else {
        payload.assignments = draftAssignments.map((a) => ({
          brother_id: a.brother_id,
          status: a.status,
          makeup_completed_at: a.makeup_completed_at ?? null,
        }));
      }

      const res = await updateShift(id, payload);
      if (seq !== saveSeqRef.current) return;
      setSaving(false);
      if (!res.ok) {
        setSaveError(res.error?.message ?? "Save failed.");
        return;
      }
      lastHashRef.current = hash;
      setSavedAt(new Date());
      setShift(res.data!);
      // Changing the party hours adds or removes slot rows server-side, so the
      // grid has to pick those up. Existing rows keep whatever is in the draft,
      // since the user may have kept editing while the save was in flight.
      if (res.data?.shift_type === "party") {
        const serverSlots = res.data.slots ?? [];
        setDraftSlots((prev) => {
          const keyOf = (sl: IShiftPartySlot) => `${sl.duty_id}|${sl.slot_start}`;
          const prevKeys = new Set(prev.map(keyOf));
          const sameShape =
            prev.length === serverSlots.length && serverSlots.every((sl) => prevKeys.has(keyOf(sl)));
          if (sameShape) return prev;
          const byKey = new Map(prev.map((sl) => [keyOf(sl), sl]));
          return serverSlots.map((sl) => byKey.get(keyOf(sl)) ?? sl);
        });
      }
      // Re-fetch server counts so optimistic deltas stay near zero
      if (res.data?.shift_type && res.data?.school_year) {
        getBrotherCounts(res.data.shift_type, res.data.school_year).then(setCounts);
      }
    }, 800);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveReady, draftDate, draftTitle, draftNotes, draftStartTime, draftEndTime, draftAssignments, draftSlots, confirmToken]);

  // --- Helpers ---
  const assignedBrotherIds = new Set(draftAssignments.map((a) => a.brother_id));
  const activeBrothers = brothers.filter((b) => b.status === "Active" || b.status === "Pledge");

  function addBrotherAssignment(b: IBrother) {
    if (!b.id || assignedBrotherIds.has(b.id)) return;
    setDraftAssignments((prev) => [
      ...prev,
      { brother_id: b.id!, first_name: b.first_name, last_name: b.last_name, status: "assigned" },
    ]);
  }

  function removeAssignment(brotherId: number) {
    setDraftAssignments((prev) => prev.filter((a) => a.brother_id !== brotherId));
  }

  function cycleAssignmentStatus(brotherId: number) {
    setDraftAssignments((prev) =>
      prev.map((a) => (a.brother_id === brotherId ? { ...a, status: nextStatus(a.status) } : a))
    );
  }

  function setAssignmentMakeup(brotherId: number, val: string) {
    setDraftAssignments((prev) =>
      prev.map((a) => (a.brother_id === brotherId ? { ...a, makeup_completed_at: val || null } : a))
    );
  }

  function cancelShrink() {
    // Put the hours back the way the server has them; nothing was saved.
    setDraftStartTime(shift?.party_start_time ?? "");
    setDraftEndTime(shift?.party_end_time ?? "");
    setShrinkConfirm(null);
  }

  function confirmShrink() {
    if (shrinkConfirm) {
      confirmedWindowRef.current = `${shrinkConfirm.start}|${shrinkConfirm.end}`;
    }
    setShrinkConfirm(null);
    // Re-run the autosave effect now that the window is approved.
    setConfirmToken((t) => t + 1);
  }

  // Party slot helpers
  function getSlot(dutyId: number, slotStart: string): IShiftPartySlot | undefined {
    return draftSlots.find((s) => s.duty_id === dutyId && s.slot_start === slotStart);
  }

  function assignSlotBrother(dutyId: number, slotStart: string, b: IBrother | null) {
    setDraftSlots((prev) =>
      prev.map((s) =>
        s.duty_id === dutyId && s.slot_start === slotStart
          ? { ...s, brother_id: b?.id ?? null, first_name: b?.first_name ?? null, last_name: b?.last_name ?? null, status: b ? "assigned" : "unassigned" }
          : s
      )
    );
  }

  function cycleSlotStatus(dutyId: number, slotStart: string) {
    setDraftSlots((prev) =>
      prev.map((s) =>
        s.duty_id === dutyId && s.slot_start === slotStart && s.brother_id
          ? { ...s, status: nextStatus(s.status as AttendanceStatus) }
          : s
      )
    );
  }

  function setSlotMakeup(dutyId: number, slotStart: string, val: string) {
    setDraftSlots((prev) =>
      prev.map((s) =>
        s.duty_id === dutyId && s.slot_start === slotStart
          ? { ...s, makeup_completed_at: val || null }
          : s
      )
    );
  }

  const uniqueSlotStarts = React.useMemo(() => {
    const set = new Set(draftSlots.map((s) => s.slot_start));
    return Array.from(set).sort((a, b) => {
      const ah = parseInt(a.split(":")[0], 10);
      const bh = parseInt(b.split(":")[0], 10);
      return ah - bh;
    });
  }, [draftSlots]);

  // Optimistic queue: adjust server counts by local draft changes
  const adjustedCounts = React.useMemo(() => {
    if (!shift || counts.length === 0) return counts;
    if (shift.shift_type === "party") {
      // For each brother, count assigned slots in draft
      const draftCountMap = new Map<number, number>();
      for (const s of draftSlots) {
        if (s.brother_id) draftCountMap.set(s.brother_id, (draftCountMap.get(s.brother_id) ?? 0) + 1);
      }
      // Server counts reflect the last-saved state; delta = draft - saved
      const savedCountMap = new Map<number, number>();
      for (const s of (shift.slots ?? [])) {
        if (s.brother_id) savedCountMap.set(s.brother_id, (savedCountMap.get(s.brother_id) ?? 0) + 1);
      }
      return counts
        .map((c) => {
          const delta = (draftCountMap.get(c.brother_id) ?? 0) - (savedCountMap.get(c.brother_id) ?? 0);
          return { ...c, count: Math.max(0, c.count + delta) };
        })
        .sort((a, b) => a.count - b.count || a.first_name.localeCompare(b.first_name));
    } else {
      // setup/cleanup: count assignments in draft vs saved
      const draftIds = new Set(draftAssignments.map((a) => a.brother_id));
      const savedIds = new Set((shift.assignments ?? []).map((a) => a.brother_id));
      return counts
        .map((c) => {
          const inDraft = draftIds.has(c.brother_id);
          const inSaved = savedIds.has(c.brother_id);
          const delta = (inDraft && !inSaved ? 1 : 0) - (!inDraft && inSaved ? 1 : 0);
          return { ...c, count: Math.max(0, c.count + delta) };
        })
        .sort((a, b) => a.count - b.count || a.first_name.localeCompare(b.first_name));
    }
  }, [counts, shift, draftAssignments, draftSlots]);

  const backHref = shift
    ? `/shifts/${shift.shift_type}`
    : "/shifts/setup";

  // --- Render ---
  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ sm: "center" }}>
          <Box>
            <Typography variant="h5">
              {shift ? (shift.shift_type.charAt(0).toUpperCase() + shift.shift_type.slice(1)) + " Shift" : "Shift"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {shift ? dayjs(shift.event_date).format("MMM D, YYYY") : "Loading…"}
              {shift?.title ? ` — ${shift.title}` : ""}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <SaveIndicator saving={saving} savedAt={savedAt} />
            <Button variant="outlined" onClick={() => void router.push(backHref)}>Back</Button>
          </Stack>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}
      {saveError && <Alert severity="error">{saveError}</Alert>}

      {loading ? (
        <PageLoader />
      ) : !shift ? null : (
        <>
          {/* Details — full width */}
          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Details</Typography>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Date"
                  type="date"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  disabled={!canWritePerm}
                />
                <TextField
                  label="Title"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  fullWidth
                  disabled={!canWritePerm}
                />
              </Stack>
              {shift.shift_type === "party" && (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    label="Start time"
                    type="time"
                    value={toClockTime(draftStartTime)}
                    onChange={(e) => setDraftStartTime(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ step: 1800 }}
                    disabled={!canWritePerm}
                  />
                  <TextField
                    label="End time"
                    type="time"
                    value={toClockTime(draftEndTime)}
                    onChange={(e) => setDraftEndTime(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ step: 1800 }}
                    helperText={
                      endsNextDay(draftStartTime, draftEndTime)
                        ? "Ends the next day"
                        : "Ends the same night"
                    }
                    disabled={!canWritePerm}
                  />
                </Stack>
              )}
              <TextField
                label="Notes"
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
                multiline
                minRows={2}
                fullWidth
                disabled={!canWritePerm}
              />
            </Stack>
          </Paper>

          {/* Two-column: main sections + fairness queue */}
          <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexDirection: { xs: "column", md: "row" } }}>
            <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
              {/* Setup / Cleanup sections */}
              {(shift.shift_type === "setup" || shift.shift_type === "cleanup") && (
                <>
                  {canWritePerm && (
                    <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
                      <Typography variant="h6" sx={{ mb: 2 }}>Assign Brothers</Typography>
                      <Autocomplete
                        options={activeBrothers.filter((b) => b.id && !assignedBrotherIds.has(b.id))}
                        getOptionLabel={(b) => `${b.first_name} ${b.last_name}`}
                        onChange={(_, val) => { if (val) addBrotherAssignment(val); }}
                        renderInput={(params) => <TextField {...params} label="Search brother to assign" size="small" />}
                        value={null}
                        clearOnBlur
                        sx={{ maxWidth: 400 }}
                      />
                    </Paper>
                  )}

                  <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>Attendance</Typography>
                    {draftAssignments.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">No brothers assigned yet.</Typography>
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Brother</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Makeup Completed</TableCell>
                            {canWritePerm && <TableCell />}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {draftAssignments.map((a) => (
                            <TableRow key={a.brother_id}>
                              <TableCell>{a.first_name} {a.last_name}</TableCell>
                              <TableCell>
                                {canWritePerm ? (
                                  <Chip
                                    label={a.status}
                                    color={STATUS_COLOR[a.status as AttendanceStatus] ?? "default"}
                                    size="small"
                                    onClick={() => cycleAssignmentStatus(a.brother_id)}
                                    sx={{ cursor: "pointer", textTransform: "capitalize" }}
                                  />
                                ) : (
                                  <Chip label={a.status} color={STATUS_COLOR[a.status as AttendanceStatus] ?? "default"} size="small" sx={{ textTransform: "capitalize" }} />
                                )}
                              </TableCell>
                              <TableCell>
                                {a.status === "absent" ? (
                                  <TextField
                                    type="date"
                                    size="small"
                                    value={a.makeup_completed_at ? dayjs(a.makeup_completed_at).format("YYYY-MM-DD") : ""}
                                    onChange={(e) => setAssignmentMakeup(a.brother_id, e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    label="Makeup Completed"
                                    disabled={!canWritePerm}
                                    sx={{ width: 160 }}
                                  />
                                ) : "—"}
                              </TableCell>
                              {canWritePerm && (
                                <TableCell>
                                  <IconButton size="small" color="error" onClick={() => removeAssignment(a.brother_id)}>
                                    <CloseIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </Paper>
                </>
              )}

              {/* Party sections */}
              {shift.shift_type === "party" && (
                <>
                  <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                      <Typography variant="h6">Duties</Typography>
                      {canWritePerm && (
                        <Button size="small" startIcon={<AddOutlinedIcon />} onClick={() => { setNewDutyName(""); setDutyError(null); setDutyDialogOpen(true); }}>
                          Add duty
                        </Button>
                      )}
                    </Stack>
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      {duties.map((d) => (
                        <Chip
                          key={d.id}
                          label={d.name}
                          onDelete={canWritePerm ? () => { setDeleteDutyError(null); setDeleteDutyTarget(d); } : undefined}
                          deleteIcon={<DeleteOutlineIcon />}
                          onClick={canWritePerm ? () => { setRenameName(d.name); setRenameError(null); setRenameDuty(d); } : undefined}
                          icon={canWritePerm ? <EditOutlinedIcon /> : undefined}
                        />
                      ))}
                      {duties.length === 0 && <Typography variant="body2" color="text.secondary">No duties.</Typography>}
                    </Stack>
                  </Paper>

              {/* Party timetable grid. Axes are swappable: time down the side
                  reads like a schedule, duties down the side reads like a
                  roster, and which one is easier depends on the party. */}
              <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ mb: 2 }}
                >
                  <Typography variant="h6">Party Timetable</Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Tooltip
                      title={dutyRows ? "Show time down the side" : "Show duties down the side"}
                    >
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<SwapHorizIcon />}
                        onClick={() => setDutyRows((p) => !p)}
                      >
                        Swap axes
                      </Button>
                    </Tooltip>
                    <PartyTimetableShare
                      shift={shift}
                      duties={duties}
                      slots={draftSlots}
                      slotStarts={uniqueSlotStarts}
                      dutyRows={dutyRows}
                    />
                  </Stack>
                </Stack>
                {uniqueSlotStarts.length === 0 || duties.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No time slots. Add duties and set start/end times.</Typography>
                ) : (
                  <TableContainer sx={{ overflowX: "auto" }}>
                    <Table size="small" sx={{ minWidth: 500 }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, minWidth: 80 }}>
                            {dutyRows ? "Duty" : "Time"}
                          </TableCell>
                          {(dutyRows ? uniqueSlotStarts : duties.map((d) => d.id)).map((col) => (
                            <TableCell
                              key={String(col)}
                              sx={{ fontWeight: 700, minWidth: 160, whiteSpace: "nowrap" }}
                            >
                              {dutyRows
                                ? formatSlotRange(String(col))
                                : duties.find((d) => d.id === col)?.name}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(dutyRows ? duties.map((d) => d.id) : uniqueSlotStarts).map((row) => (
                          <TableRow key={String(row)}>
                            <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                              {dutyRows
                                ? duties.find((d) => d.id === row)?.name
                                : formatSlotRange(String(row))}
                            </TableCell>
                            {(dutyRows ? uniqueSlotStarts : duties.map((d) => d.id)).map((col) => {
                              const dutyId = dutyRows ? (row as number) : (col as number);
                              const slotStart = dutyRows ? String(col) : String(row);
                              const slot = getSlot(dutyId, slotStart);
                              if (!slot) return <TableCell key={String(col)} />;
                              return (
                                <TableCell key={String(col)} sx={{ verticalAlign: "top", py: 1.5 }}>
                                  {slot.brother_id ? (
                                    <Stack spacing={1}>
                                      <Chip
                                        label={`${slot.first_name} ${slot.last_name}`}
                                        size="small"
                                        color={STATUS_COLOR[slot.status as AttendanceStatus] ?? "default"}
                                        onClick={canWritePerm ? () => cycleSlotStatus(dutyId, slotStart) : undefined}
                                        onDelete={canWritePerm ? () => assignSlotBrother(dutyId, slotStart, null) : undefined}
                                        sx={{ cursor: canWritePerm ? "pointer" : "default", textTransform: "capitalize", maxWidth: 160 }}
                                      />
                                      {slot.status === "absent" && canWritePerm && (
                                        <TextField
                                          type="date"
                                          size="small"
                                          value={slot.makeup_completed_at ? dayjs(slot.makeup_completed_at).format("YYYY-MM-DD") : ""}
                                          onChange={(e) => setSlotMakeup(dutyId, slotStart, e.target.value)}
                                          InputLabelProps={{ shrink: true }}
                                          label="Makeup Completed"
                                          sx={{ width: 170 }}
                                        />
                                      )}
                                    </Stack>
                                  ) : canWritePerm ? (
                                    <Autocomplete
                                      options={activeBrothers}
                                      getOptionLabel={(b) => `${b.first_name} ${b.last_name}`}
                                      onChange={(_, val) => { if (val) assignSlotBrother(dutyId, slotStart, val); }}
                                      renderInput={(params) => <TextField {...params} size="small" placeholder="Assign" sx={{ minWidth: 130 }} />}
                                      value={null}
                                      clearOnBlur
                                      size="small"
                                    />
                                  ) : (
                                    <Typography variant="body2" color="text.disabled">—</Typography>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Paper>
                </>
              )}
            </Stack>

            {/* Right column: fairness queue */}
            <Box sx={{ width: { xs: "100%", md: 300 }, flexShrink: 0 }}>
            <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", position: { md: "sticky" }, top: { md: 80 } }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                Fairness Queue
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                {shift.school_year}–{(shift.school_year ?? 0) + 1} · fewest shifts first
                {canWritePerm && shift.shift_type !== "party" ? " · click to assign" : ""}
              </Typography>
              {adjustedCounts.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No data.</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Brother</TableCell>
                      <TableCell align="right">Shifts</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {adjustedCounts.map((c) => {
                      const alreadyAssigned = assignedBrotherIds.has(c.brother_id);
                      const brother = brothers.find((b) => b.id === c.brother_id);
                      const clickable = canWritePerm && shift.shift_type !== "party" && !alreadyAssigned && !!brother;
                      return (
                        <TableRow
                          key={c.brother_id}
                          sx={{
                            opacity: alreadyAssigned ? 0.4 : 1,
                            cursor: clickable ? "pointer" : "default",
                            "&:hover": clickable ? { bgcolor: "action.hover" } : {},
                          }}
                          onClick={() => {
                            if (!clickable) return;
                            addBrotherAssignment(brother!);
                          }}
                        >
                          <TableCell>{c.first_name} {c.last_name}</TableCell>
                          <TableCell align="right">{c.count}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Paper>
            </Box>
          </Box>
        </>
      )}

      {/* Add duty dialog */}
      {/* Narrowing the hours clears the slots past the new end — say which. */}
      <Dialog open={Boolean(shrinkConfirm)} onClose={() => cancelShrink()} fullWidth maxWidth="xs">
        <DialogTitle>Shorten the party?</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Ending at {shrinkConfirm ? toClockTime(shrinkConfirm.end) : ""} removes the slots after
            that time. {shrinkConfirm?.dropped.length} assigned{" "}
            {shrinkConfirm?.dropped.length === 1 ? "slot" : "slots"} will be cleared:
          </Typography>
          <Stack spacing={0.5}>
            {(shrinkConfirm?.dropped ?? []).slice(0, 8).map((sl) => (
              <Typography key={`${sl.duty_id}-${sl.slot_start}`} variant="body2" color="text.secondary">
                {formatSlotRange(sl.slot_start)} · {sl.duty_name ?? "Duty"} ·{" "}
                {[sl.first_name, sl.last_name].filter(Boolean).join(" ") || "Assigned"}
              </Typography>
            ))}
            {(shrinkConfirm?.dropped.length ?? 0) > 8 ? (
              <Typography variant="body2" color="text.secondary">
                and {(shrinkConfirm?.dropped.length ?? 0) - 8} more
              </Typography>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => cancelShrink()}>Keep the old hours</Button>
          <Button color="error" variant="contained" onClick={() => confirmShrink()}>
            Clear and save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dutyDialogOpen} onClose={() => setDutyDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          Add duty
          <IconButton onClick={() => setDutyDialogOpen(false)} aria-label="close"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {dutyError && <Alert severity="error" sx={{ mb: 2 }}>{dutyError}</Alert>}
          <TextField
            label="Duty name"
            value={newDutyName}
            onChange={(e) => setNewDutyName(e.target.value)}
            fullWidth
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDutyDialogOpen(false)} disabled={dutySubmitting}>Cancel</Button>
          <Button
            variant="contained"
            disabled={dutySubmitting || !newDutyName.trim()}
            onClick={async () => {
              if (!shift) return;
              setDutySubmitting(true);
              setDutyError(null);
              const res = await createPartyDuty(shift.id, { name: newDutyName.trim(), display_order: duties.length });
              setDutySubmitting(false);
              if (!res.ok) {
                setDutyError(res.error?.message ?? "Failed to add duty.");
                return;
              }
              setDutyDialogOpen(false);
              await refresh();
            }}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename duty dialog */}
      <Dialog open={Boolean(renameDuty)} onClose={() => setRenameDuty(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          Rename duty
          <IconButton onClick={() => setRenameDuty(null)} aria-label="close"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {renameError && <Alert severity="error" sx={{ mb: 2 }}>{renameError}</Alert>}
          <TextField
            label="New name"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            fullWidth
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setRenameDuty(null)} disabled={renameSubmitting}>Cancel</Button>
          <Button
            variant="contained"
            disabled={renameSubmitting || !renameName.trim()}
            onClick={async () => {
              if (!renameDuty) return;
              setRenameSubmitting(true);
              setRenameError(null);
              const res = await updatePartyDuty(renameDuty.id, { name: renameName.trim() });
              setRenameSubmitting(false);
              if (!res.ok) {
                setRenameError(res.error?.message ?? "Failed to rename.");
                return;
              }
              setRenameDuty(null);
              await refresh();
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete duty confirm */}
      <Dialog open={Boolean(deleteDutyTarget)} onClose={() => setDeleteDutyTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          Delete duty
          <IconButton onClick={() => setDeleteDutyTarget(null)} aria-label="close"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {deleteDutyError && <Alert severity="error" sx={{ mb: 2 }}>{deleteDutyError}</Alert>}
          <Typography>
            Delete duty <b>{deleteDutyTarget?.name}</b>? All slots in this column will be removed.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDeleteDutyTarget(null)} disabled={deleteDutyBusy}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            disabled={deleteDutyBusy || !deleteDutyTarget}
            onClick={async () => {
              if (!deleteDutyTarget) return;
              setDeleteDutyBusy(true);
              setDeleteDutyError(null);
              const res = await deletePartyDuty(deleteDutyTarget.id);
              setDeleteDutyBusy(false);
              if (!res.ok) {
                setDeleteDutyError(res.error?.message ?? "Failed to delete duty.");
                return;
              }
              setDeleteDutyTarget(null);
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
