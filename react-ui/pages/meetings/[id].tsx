import * as React from "react";
import { useRouter } from "next/router";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import type { IBrother, IMeetingMinutes, IVote } from "../../interfaces/api.interface";
import { FormattedTextField } from "../../components/minutes/FormattedTextField";
import { getAllBrothers } from "../../services/brotherService";
import { getMeeting, updateMeeting } from "../../services/meetingsService";
import { listVotesForMeeting } from "../../services/votesService";
import { schoolYearLabel, schoolYearStartForDate } from "../../utils/schoolYear";
import { parseMinutesText } from "../../utils/minutesText";
import { useAuth } from "../../context/authContext";
import CreateVoteDialog from "../../components/createVote/createVote";
import VoteResultsCard from "../../components/voteResultsCard/voteResultsCard";

function renderMinutesBlocks(text?: string | null) {
  const blocks = parseMinutesText(text);
  return blocks.map((b, idx) => {
    if (b.type === "empty") return <span key={`empty-${idx}`}>—</span>;
    if (b.type === "ul") {
      return (
        <ul key={`ul-${idx}`} style={{ marginTop: 4, marginBottom: 8, paddingLeft: 20 }}>
          {b.items.map((it, j) => (
            <li key={j} style={{ whiteSpace: "pre-wrap" }}>
              {it}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={`p-${idx}`} style={{ marginTop: 4, marginBottom: 8, whiteSpace: "pre-wrap" }}>
        {b.text}
      </p>
    );
  });
}

const ATTENDANCE_STATUSES = ["Present", "Late", "Excused", "Missing"];

function formatArrivalTime(hhmm: string): string {
  const d = dayjs(`1970-01-01 ${hhmm}`);
  if (!d.isValid()) return hhmm;
  return d.format("h:mm A");
}

const OFFICER_KEYS: Array<{ key: string; label: string }> = [
  { key: "Alpha", label: "Alpha" },
  { key: "Beta", label: "Beta" },
  { key: "Pi", label: "Pi" },
  { key: "Sigma", label: "Sigma" },
  { key: "Tau", label: "Tau" },
  { key: "Chi", label: "Chi" },
  { key: "Gamma", label: "Gamma" },
  { key: "Psi", label: "Psi" },
  { key: "Theta", label: "Theta" },
  { key: "Iota", label: "Iota" },
  { key: "Upsilon", label: "Upsilon" },
  { key: "Phi", label: "Phi" },
  { key: "Omega", label: "Omega" },
  { key: "Rho", label: "Rho" },
  { key: "Omicron", label: "Omicron" },
  { key: "Zeta", label: "Zeta" },
  { key: "ChapterAdvisor", label: "Chapter Advisor" },
  { key: "AlumniPresident", label: "Alumni President"},
];

type AttendanceDetails = {
  status: string;
  late_arrival_time?: string; // HH:MM
  excused_reason?: string;
};

type ExtraAttendanceRow = {
  member_name: string;
  status: string;
  late_arrival_time?: string; // HH:MM
  excused_reason?: string;
};

export default function MeetingMinutesEditor() {
  const router = useRouter();
  const { can } = useAuth();
  const canWrite = can("meetings.write");
  const id = Number(router.query.id);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [autosaveReady, setAutosaveReady] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);

  const [meeting, setMeeting] = React.useState<IMeetingMinutes | null>(null);
  const [brothers, setBrothers] = React.useState<IBrother[]>([]);
  const [votes, setVotes] = React.useState<IVote[]>([]);
  const [createVoteOpen, setCreateVoteOpen] = React.useState(false);

  const [title, setTitle] = React.useState<string>("");
  const [meetingDate, setMeetingDate] = React.useState<string>(dayjs().format("YYYY-MM-DD"));

  const [attendanceByBrotherId, setAttendanceByBrotherId] = React.useState<Record<number, AttendanceDetails>>({});
  const [extraAttendance, setExtraAttendance] = React.useState<ExtraAttendanceRow[]>([]);
  const [officerNotes, setOfficerNotes] = React.useState<Record<string, string>>({});
  const [communications, setCommunications] = React.useState<string>("");
  const [oldBusiness, setOldBusiness] = React.useState<string>("");
  const [newBusiness, setNewBusiness] = React.useState<string>("");
  const [betterment, setBetterment] = React.useState<string>("");
  const [acceptMovedBy, setAcceptMovedBy] = React.useState<number | "">("");
  const [acceptSecondedBy, setAcceptSecondedBy] = React.useState<number | "">("");
  const [endMovedBy, setEndMovedBy] = React.useState<number | "">("");
  const [endSecondedBy, setEndSecondedBy] = React.useState<number | "">("");

  const activeBrothers = React.useMemo(() => brothers.filter((b) => (b.status ?? "").toLowerCase() === "active"), [brothers]);
  const sortedActiveBrothers = React.useMemo(() => {
    return activeBrothers
      .slice()
      .filter((b) => Boolean(b.id))
      .sort((a, b) => (a.last_name ?? "").localeCompare(b.last_name ?? "") || (a.first_name ?? "").localeCompare(b.first_name ?? ""));
  }, [activeBrothers]);

  const brotherLabelById = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const b of brothers) {
      if (!b.id) continue;
      map.set(b.id, `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim());
    }
    return map;
  }, [brothers]);

  const resetFormFromMeeting = React.useCallback((m: IMeetingMinutes) => {
    setTitle(m.title?.toString() ?? "");
    setMeetingDate(m.meeting_date ? dayjs(m.meeting_date).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"));
    setCommunications(m.communications ?? "");
    setOldBusiness(m.old_business ?? "");
    setNewBusiness(m.new_business ?? "");
    setBetterment(m.betterment ?? "");
    setAcceptMovedBy(m.motion_accept_moved_by_brother_id ?? "");
    setAcceptSecondedBy(m.motion_accept_seconded_by_brother_id ?? "");
    setEndMovedBy(m.motion_end_moved_by_brother_id ?? "");
    setEndSecondedBy(m.motion_end_seconded_by_brother_id ?? "");

    const nextAttendance: Record<number, AttendanceDetails> = {};
    const extras: ExtraAttendanceRow[] = [];
    for (const row of m.attendance ?? []) {
      if (row.brother_id) {
        nextAttendance[row.brother_id] = {
          status: row.status,
          late_arrival_time: row.late_arrival_time ?? "",
          excused_reason: row.excused_reason ?? "",
        };
      } else if (row.member_name) {
        extras.push({
          member_name: row.member_name,
          status: row.status,
          late_arrival_time: row.late_arrival_time ?? "",
          excused_reason: row.excused_reason ?? "",
        });
      }
    }

    const notesMap: Record<string, string> = {};
    for (const note of m.officer_notes ?? []) {
      notesMap[note.officer_key] = note.notes ?? "";
    }

    setAttendanceByBrotherId(nextAttendance);
    setExtraAttendance(extras);
    setOfficerNotes(notesMap);
  }, []);

  const lastSavedHashRef = React.useRef<string | null>(null);
  const debounceTimerRef = React.useRef<any>(null);
  const saveSeqRef = React.useRef(0);

  const buildPayload = React.useCallback(() => {
    const attendancePayload = [
      ...activeBrothers
        .filter((b) => Boolean(b.id))
        .map((b) => {
          const details = attendanceByBrotherId[b.id!] ?? { status: "Missing" };
          return {
            brother_id: b.id!,
            member_name: null as string | null,
            status: details.status ?? "Missing",
            late_arrival_time:
              details.status === "Late" && details.late_arrival_time?.trim() ? details.late_arrival_time.trim() : null,
            excused_reason:
              details.status === "Excused" && details.excused_reason?.trim() ? details.excused_reason.trim() : null,
          };
        }),
      ...extraAttendance
        .filter((r) => r.member_name.trim())
        .map((r) => ({
          brother_id: null as number | null,
          member_name: r.member_name.trim(),
          status: r.status,
          late_arrival_time: r.status === "Late" && r.late_arrival_time?.trim() ? r.late_arrival_time.trim() : null,
          excused_reason: r.status === "Excused" && r.excused_reason?.trim() ? r.excused_reason.trim() : null,
        })),
    ];

    const officer_notes = Object.entries(officerNotes)
      .map(([officer_key, notes]) => ({ officer_key, notes: notes?.trim() ? notes.trim() : null }))
      .filter((n) => n.notes);

    return {
      meeting_date: dayjs(meetingDate).toDate(),
      title: title.trim() ? title.trim() : null,
      communications: communications.trim() ? communications.trim() : null,
      old_business: oldBusiness.trim() ? oldBusiness.trim() : null,
      new_business: newBusiness.trim() ? newBusiness.trim() : null,
      betterment: betterment.trim() ? betterment.trim() : null,
      motion_accept_moved_by_brother_id: acceptMovedBy === "" ? null : Number(acceptMovedBy),
      motion_accept_seconded_by_brother_id: acceptSecondedBy === "" ? null : Number(acceptSecondedBy),
      motion_end_moved_by_brother_id: endMovedBy === "" ? null : Number(endMovedBy),
      motion_end_seconded_by_brother_id: endSecondedBy === "" ? null : Number(endSecondedBy),
      attendance: attendancePayload,
      officer_notes,
    };
  }, [
    activeBrothers,
    attendanceByBrotherId,
    extraAttendance,
    officerNotes,
    meetingDate,
    title,
    communications,
    oldBusiness,
    newBusiness,
    betterment,
    acceptMovedBy,
    acceptSecondedBy,
    endMovedBy,
    endSecondedBy,
  ]);

  const exportPdf = React.useCallback(async () => {
    if (!meeting) return;
    setExporting(true);
    try {
      // Use the browser’s native “Print → Save as PDF” for perfect page sizing.
      window.open(`/meetings/${meeting.id}/print?autoprint=1`, "_blank", "noopener,noreferrer");
    } finally {
      // We can't know when the print dialog completes; just reset quickly.
      setTimeout(() => setExporting(false), 300);
    }
  }, [meeting]);

  React.useEffect(() => {
    if (!router.isReady) return;
    if (!Number.isFinite(id) || id <= 0) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setAutosaveReady(false);
      try {
        const [m, b, v] = await Promise.all([getMeeting(id), getAllBrothers(), listVotesForMeeting(id)]);
        if (cancelled) return;
        setMeeting(m);
        setBrothers(b);
        setVotes(v);
        resetFormFromMeeting(m);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load meeting minutes");
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router.isReady, id]);

  // Ensure every active brother has a status (default Missing)
  React.useEffect(() => {
    if (activeBrothers.length === 0) return;
    setAttendanceByBrotherId((prev) => {
      const next = { ...prev };
      for (const b of activeBrothers) {
        if (!b.id) continue;
        if (!next[b.id]) {
          next[b.id] = { status: "Missing", late_arrival_time: "", excused_reason: "" };
        } else {
          next[b.id] = {
            status: next[b.id].status ?? "Missing",
            late_arrival_time: next[b.id].late_arrival_time ?? "",
            excused_reason: next[b.id].excused_reason ?? "",
          };
        }
      }
      return next;
    });
  }, [activeBrothers]);

  // Mark initial state as saved (prevents immediate autosave right after loading).
  React.useEffect(() => {
    if (!isEditing) return;
    if (!meeting) return;
    if (loading) return;
    if (autosaveReady) return;
    const hash = JSON.stringify(buildPayload());
    lastSavedHashRef.current = hash;
    setAutosaveReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, meeting, loading, autosaveReady]);

  // Debounced autosave on any change.
  React.useEffect(() => {
    if (!isEditing) return;
    if (!autosaveReady) return;
    if (!meeting) return;

    const payload = buildPayload();
    const hash = JSON.stringify(payload);
    if (hash === lastSavedHashRef.current) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      const seq = ++saveSeqRef.current;
      setSaving(true);
      setError(null);
      setSuccess(null);

      const result = await updateMeeting(meeting.id, payload);
      // Only update UI state for the latest save attempt.
      if (seq !== saveSeqRef.current) return;

      setSaving(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      lastSavedHashRef.current = hash;
      setSuccess("Saved");
      setTimeout(() => setSuccess(null), 900);

      // Keep view-mode data in sync with the latest autosaved changes.
      setMeeting((prev) => {
        if (!prev) return prev;
        const attendance = payload.attendance.map((a) => {
          if (a.brother_id) {
            const bro = brothers.find((b) => b.id === a.brother_id);
            return {
              brother_id: a.brother_id,
              member_name: null,
              status: a.status,
              late_arrival_time: a.late_arrival_time ?? null,
              excused_reason: a.excused_reason ?? null,
              first_name: bro?.first_name ?? null,
              last_name: bro?.last_name ?? null,
            } as any;
          }
          return {
            brother_id: null,
            member_name: a.member_name ?? null,
            status: a.status,
            late_arrival_time: a.late_arrival_time ?? null,
            excused_reason: a.excused_reason ?? null,
            first_name: null,
            last_name: null,
          } as any;
        });

        const officer_notes = (payload.officer_notes ?? [])
          .filter((n) => (n.notes ?? "").trim())
          .map((n) => ({ officer_key: n.officer_key, notes: n.notes ?? null } as any));

        return {
          ...prev,
          meeting_date: payload.meeting_date as any,
          title: payload.title ?? null,
          communications: payload.communications ?? null,
          old_business: payload.old_business ?? null,
          new_business: payload.new_business ?? null,
          betterment: payload.betterment ?? null,
          motion_accept_moved_by_brother_id: payload.motion_accept_moved_by_brother_id ?? null,
          motion_accept_seconded_by_brother_id: payload.motion_accept_seconded_by_brother_id ?? null,
          motion_end_moved_by_brother_id: payload.motion_end_moved_by_brother_id ?? null,
          motion_end_seconded_by_brother_id: payload.motion_end_seconded_by_brother_id ?? null,
          attendance,
          officer_notes,
        } as any;
      });
    }, 800);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [isEditing, autosaveReady, meeting, buildPayload, brothers]);

  // Poll for vote status changes every 5s while any vote is open.
  // Results are polled independently inside each VoteResultsCard.
  React.useEffect(() => {
    if (!Number.isFinite(id) || id <= 0) return;
    if (!votes.some((v) => v.status === "open")) return;
    const interval = setInterval(async () => {
      try {
        const updated = await listVotesForMeeting(id);
        setVotes(updated);
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [id, votes]);

  const schoolYear = React.useMemo(() => {
    const d = dayjs(meetingDate).toDate();
    return schoolYearStartForDate(d);
  }, [meetingDate]);

  if (!router.isReady || loading) {
    return <CircularProgress />;
  }

  if (!meeting) {
    return <Alert severity="error">Meeting not found.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
          <Box>
            <Typography variant="h5">Meeting Minutes</Typography>
            <Typography variant="body2" color="text.secondary">
              {dayjs(meetingDate).format("MMM D, YYYY")} • {schoolYearLabel(schoolYear)}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button variant="outlined" onClick={() => router.push("/meetings")}>
              Back
            </Button>
            <Button variant="outlined" startIcon={<PictureAsPdfOutlinedIcon />} disabled={exporting} onClick={exportPdf}>
              {exporting ? "Exporting…" : "Export PDF"}
            </Button>
            {!isEditing ? (
              canWrite ? (
                <Button
                  variant="contained"
                  onClick={() => {
                    setIsEditing(true);
                    setAutosaveReady(false);
                  }}
                >
                  Edit
                </Button>
              ) : null
            ) : (
              <>
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={() => {
                    if (meeting) resetFormFromMeeting(meeting);
                    setIsEditing(false);
                    setAutosaveReady(false);
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    setIsEditing(false);
                    setAutosaveReady(false);
                  }}
                >
                  Done
                </Button>
              </>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              {isEditing ? (saving ? "Saving…" : autosaveReady ? "Autosave on" : "") : ""}
            </Typography>
          </Stack>
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}
      <Snackbar
        open={Boolean(success)}
        onClose={() => setSuccess(null)}
        autoHideDuration={900}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert severity="success" variant="filled" sx={{ boxShadow: 6 }}>
          {success}
        </Alert>
      </Snackbar>

      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack spacing={2}>
          <Typography variant="h6">Meeting info</Typography>
          {!isEditing ? (
            <Stack spacing={0.5}>
              <Typography variant="body1">
                <b>Date:</b> {dayjs(meeting.meeting_date).format("MMMM D, YYYY")}
              </Typography>
              <Typography variant="body1">
                <b>Title:</b> {meeting.title?.trim() ? meeting.title : "—"}
              </Typography>
            </Stack>
          ) : (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Meeting date"
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ maxWidth: 240 }}
              />
              <TextField label="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6">Attendance</Typography>
              <Typography variant="body2" color="text.secondary">
                {isEditing ? "Active brothers only. Mark each brother’s attendance status for this meeting." : "Attendance for this meeting."}
              </Typography>
            </Box>
          </Stack>

          {!isEditing ? (
            <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
              <Box component="thead">
                <Box component="tr">
                  <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1 }}>
                    Member
                  </Box>
                  <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1, width: 180 }}>
                    Status
                  </Box>
                  <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1 }}>
                    Details
                  </Box>
                </Box>
              </Box>
              <Box component="tbody">
                {(meeting.attendance ?? []).map((r) => (
                  <Box component="tr" key={r.id ?? `${r.brother_id ?? "x"}-${r.member_name ?? "y"}-${r.status}`}>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1 }}>
                      {r.brother_id ? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() : r.member_name}
                    </Box>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1 }}>
                      {r.status}
                    </Box>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1 }}>
                      {r.status === "Late" && r.late_arrival_time ? `Arrived ${formatArrivalTime(r.late_arrival_time)}` : null}
                      {r.status === "Excused" && r.excused_reason ? r.excused_reason : null}
                      {r.status !== "Late" && r.status !== "Excused" ? "—" : null}
                      {(r.status === "Late" && !r.late_arrival_time) || (r.status === "Excused" && !r.excused_reason) ? "—" : null}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          ) : (
            <Stack spacing={1}>
              {sortedActiveBrothers.map((b) => {
                if (!b.id) return null;
                const details = attendanceByBrotherId[b.id] ?? { status: "Missing", late_arrival_time: "", excused_reason: "" };
                return (
                  <Stack
                    key={b.id}
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    alignItems={{ sm: "center" }}
                    sx={{ py: 0.5 }}
                  >
                    <Typography sx={{ minWidth: 240, fontWeight: 600 }}>
                      {b.first_name} {b.last_name}
                    </Typography>
                    <TextField
                      select
                      size="small"
                      label="Status"
                      value={details.status ?? "Missing"}
                      onChange={(e) =>
                        setAttendanceByBrotherId((prev) => {
                          const nextStatus = e.target.value;
                          const next = { ...(prev[b.id!] ?? { status: "Missing", late_arrival_time: "", excused_reason: "" }) };
                          next.status = nextStatus;
                          if (nextStatus === "Late" && !next.late_arrival_time) next.late_arrival_time = dayjs().format("HH:mm");
                          if (nextStatus !== "Late") next.late_arrival_time = "";
                          if (nextStatus !== "Excused") next.excused_reason = "";
                          return { ...prev, [b.id!]: next };
                        })
                      }
                      sx={{ minWidth: 200 }}
                    >
                      {ATTENDANCE_STATUSES.map((s) => (
                        <MenuItem key={s} value={s}>
                          {s}
                        </MenuItem>
                      ))}
                    </TextField>
                    {details.status === "Late" ? (
                      <TextField
                        label="Arrival"
                        type="time"
                        size="small"
                        value={details.late_arrival_time ?? ""}
                        onChange={(e) =>
                          setAttendanceByBrotherId((prev) => ({
                            ...prev,
                            [b.id!]: { ...(prev[b.id!] ?? { status: "Late" }), late_arrival_time: e.target.value },
                          }))
                        }
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: 150 }}
                      />
                    ) : null}
                    {details.status === "Excused" ? (
                      <TextField
                        label="Reason (optional)"
                        size="small"
                        value={details.excused_reason ?? ""}
                        onChange={(e) =>
                          setAttendanceByBrotherId((prev) => ({
                            ...prev,
                            [b.id!]: { ...(prev[b.id!] ?? { status: "Excused" }), excused_reason: e.target.value },
                          }))
                        }
                        sx={{ minWidth: 240, flex: 1 }}
                      />
                    ) : null}
                  </Stack>
                );
              })}
            </Stack>
          )}

          {isEditing ? (
            <>
              <Divider />
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Additional attendees (optional)
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => setExtraAttendance((p) => [...p, { member_name: "", status: "Present", late_arrival_time: "", excused_reason: "" }])}
                >
                  Add
                </Button>
              </Stack>

              <Stack spacing={1}>
                {extraAttendance.map((row, idx) => (
                  <Stack key={idx} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                    <TextField
                      label="Name"
                      value={row.member_name}
                      onChange={(e) =>
                        setExtraAttendance((prev) => prev.map((r, i) => (i === idx ? { ...r, member_name: e.target.value } : r)))
                      }
                      fullWidth
                    />
                    <TextField
                      select
                      size="small"
                      label="Status"
                      value={row.status}
                      onChange={(e) =>
                        setExtraAttendance((prev) =>
                          prev.map((r, i) => {
                            if (i !== idx) return r;
                            const nextStatus = e.target.value;
                            const next: ExtraAttendanceRow = { ...r, status: nextStatus };
                            if (nextStatus === "Late" && !next.late_arrival_time) next.late_arrival_time = dayjs().format("HH:mm");
                            if (nextStatus !== "Late") next.late_arrival_time = "";
                            if (nextStatus !== "Excused") next.excused_reason = "";
                            return next;
                          })
                        )
                      }
                      sx={{ minWidth: 200 }}
                    >
                      {ATTENDANCE_STATUSES.map((s) => (
                        <MenuItem key={s} value={s}>
                          {s}
                        </MenuItem>
                      ))}
                    </TextField>
                    {row.status === "Late" ? (
                      <TextField
                        label="Arrival"
                        type="time"
                        size="small"
                        value={row.late_arrival_time ?? ""}
                        onChange={(e) =>
                          setExtraAttendance((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, late_arrival_time: e.target.value } : r))
                          )
                        }
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: 150 }}
                      />
                    ) : null}
                    {row.status === "Excused" ? (
                      <TextField
                        label="Reason (optional)"
                        size="small"
                        value={row.excused_reason ?? ""}
                        onChange={(e) =>
                          setExtraAttendance((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, excused_reason: e.target.value } : r))
                          )
                        }
                        sx={{ minWidth: 240, flex: 1 }}
                      />
                    ) : null}
                    <IconButton aria-label="remove attendee" onClick={() => setExtraAttendance((prev) => prev.filter((_, i) => i !== idx))}>
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            </>
          ) : null}
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack spacing={2}>
          <Typography variant="h6">Opening</Typography>
          <Typography variant="body2" color="text.secondary">
            Motion to accept previous week&apos;s minutes.
          </Typography>
          {!isEditing ? (
            <Typography variant="body1">
              Motion to accept previous week&apos;s minutes by{" "}
              <b>
                {meeting.motion_accept_moved_by_brother_id
                  ? brotherLabelById.get(meeting.motion_accept_moved_by_brother_id) ?? "________"
                  : "________"}
              </b>
              , seconded by{" "}
              <b>
                {meeting.motion_accept_seconded_by_brother_id
                  ? brotherLabelById.get(meeting.motion_accept_seconded_by_brother_id) ?? "________"
                  : "________"}
              </b>
              .
            </Typography>
          ) : (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                select
                label="Motion by"
                value={acceptMovedBy}
                onChange={(e) => setAcceptMovedBy(e.target.value === "" ? "" : Number(e.target.value))}
                sx={{ minWidth: 260 }}
              >
                <MenuItem value="">—</MenuItem>
                {sortedActiveBrothers.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.first_name} {b.last_name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Seconded by"
                value={acceptSecondedBy}
                onChange={(e) => setAcceptSecondedBy(e.target.value === "" ? "" : Number(e.target.value))}
                sx={{ minWidth: 260 }}
              >
                <MenuItem value="">—</MenuItem>
                {sortedActiveBrothers.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.first_name} {b.last_name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack spacing={2}>
          <Typography variant="h6">Communications / Committees</Typography>
          {!isEditing ? (
            <Box sx={{ "& p": { margin: 0 } }}>{renderMinutesBlocks(meeting.communications)}</Box>
          ) : (
            <FormattedTextField
              label="Communications / Committees"
              value={communications}
              onChange={setCommunications}
              minRows={3}
              placeholder="Communications, committee updates, announcements..."
            />
          )}
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack spacing={2}>
          <Typography variant="h6">Officer reports</Typography>
          {isEditing ? (
            <Typography variant="body2" color="text.secondary">
              Add notes for each officer’s report during the meeting.
            </Typography>
          ) : null}

          {!isEditing ? (
            <Stack spacing={2}>
              {(meeting.officer_notes ?? []).filter((n) => (n.notes ?? "").trim()).length === 0 ? (
                <Typography variant="body1">—</Typography>
              ) : (
                (meeting.officer_notes ?? [])
                  .filter((n) => (n.notes ?? "").trim())
                  .map((n) => (
                    <Box key={n.id ?? n.officer_key}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {OFFICER_KEYS.find((o) => o.key === n.officer_key)?.label ?? n.officer_key}
                      </Typography>
                      <Box sx={{ "& p": { margin: 0 } }}>{renderMinutesBlocks(n.notes)}</Box>
                    </Box>
                  ))
              )}
            </Stack>
          ) : (
            <Stack spacing={2}>
              {OFFICER_KEYS.map((o) => (
                <FormattedTextField
                  key={o.key}
                  label={o.label}
                  value={officerNotes[o.key] ?? ""}
                  onChange={(value) => setOfficerNotes((prev) => ({ ...prev, [o.key]: value }))}
                  minRows={2}
                  placeholder="Notes..."
                />
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack spacing={2}>
          <Typography variant="h6">Old business</Typography>
          {!isEditing ? (
            <Box sx={{ "& p": { margin: 0 } }}>{renderMinutesBlocks(meeting.old_business)}</Box>
          ) : (
            <FormattedTextField label="Old business" value={oldBusiness} onChange={setOldBusiness} minRows={2} placeholder="Old business..." />
          )}

          <Typography variant="h6">New business</Typography>
          {!isEditing ? (
            <Box sx={{ "& p": { margin: 0 } }}>{renderMinutesBlocks(meeting.new_business)}</Box>
          ) : (
            <FormattedTextField label="New business" value={newBusiness} onChange={setNewBusiness} minRows={2} placeholder="New business..." />
          )}
        </Stack>
      </Paper>

      {/* Votes section — always visible, creation only in edit mode */}
      {(votes.length > 0 || isEditing) ? (
        <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="h6">Votes</Typography>
                <Typography variant="body2" color="text.secondary">
                  {isEditing ? "Create a live vote and share the link with attendees." : "Votes from this meeting."}
                </Typography>
              </Box>
              {isEditing && canWrite ? (
                <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setCreateVoteOpen(true)}>
                  Create Vote
                </Button>
              ) : null}
            </Stack>
            {votes.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No votes yet.</Typography>
            ) : (
              <Stack spacing={2}>
                {votes.map((v) => (
                  <VoteResultsCard
                    key={v.id}
                    vote={v}
                    canManage={canWrite}
                    onClosed={(voteId) => setVotes((prev) => prev.map((x) => x.id === voteId ? { ...x, status: "closed" } : x))}
                    onDeleted={(voteId) => setVotes((prev) => prev.filter((x) => x.id !== voteId))}
                    onUpdated={(updated) => setVotes((prev) => prev.map((x) => x.id === updated.id ? { ...x, ...updated } : x))}
                  />
                ))}
              </Stack>
            )}
          </Stack>
        </Paper>
      ) : null}

      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack spacing={2}>
          <Typography variant="h6">Closing</Typography>

          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            Betterment
          </Typography>
          {!isEditing ? (
            <Box sx={{ "& p": { margin: 0 } }}>{renderMinutesBlocks(meeting.betterment)}</Box>
          ) : (
            <FormattedTextField label="Betterment" value={betterment} onChange={setBetterment} minRows={2} placeholder="Betterment..." />
          )}

          <Typography variant="body2" color="text.secondary">
            Motion to end meeting.
          </Typography>

          {!isEditing ? (
            <Typography variant="body1">
              Motion to end meeting by{" "}
              <b>
                {meeting.motion_end_moved_by_brother_id
                  ? brotherLabelById.get(meeting.motion_end_moved_by_brother_id) ?? "________"
                  : "________"}
              </b>
              , seconded by{" "}
              <b>
                {meeting.motion_end_seconded_by_brother_id
                  ? brotherLabelById.get(meeting.motion_end_seconded_by_brother_id) ?? "________"
                  : "________"}
              </b>
              .
            </Typography>
          ) : (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                select
                label="Motion by"
                value={endMovedBy}
                onChange={(e) => setEndMovedBy(e.target.value === "" ? "" : Number(e.target.value))}
                sx={{ minWidth: 260 }}
              >
                <MenuItem value="">—</MenuItem>
                {sortedActiveBrothers.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.first_name} {b.last_name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Seconded by"
                value={endSecondedBy}
                onChange={(e) => setEndSecondedBy(e.target.value === "" ? "" : Number(e.target.value))}
                sx={{ minWidth: 260 }}
              >
                <MenuItem value="">—</MenuItem>
                {sortedActiveBrothers.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.first_name} {b.last_name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          )}
        </Stack>
      </Paper>

      {createVoteOpen && meeting ? (
        <CreateVoteDialog
          meetingId={meeting.id}
          onCreated={(newVote) => setVotes((prev) => [...prev, newVote])}
          onClose={() => setCreateVoteOpen(false)}
        />
      ) : null}
    </Stack>
  );
}


