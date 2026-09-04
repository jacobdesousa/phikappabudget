import * as React from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import dayjs from "dayjs";
import Link from "next/link";
import {
  getAllMakeups,
  updateMakeup,
  type IAllMakeups,
  type AllMakeupsWorkday,
  type AllMakeupsShift,
  type AllMakeupsParty,
  type MakeupKind,
} from "../services/notificationsService";
import { useAuth } from "../context/authContext";
import SaveIndicator from "../components/SaveIndicator";

// One flattened shape for every source, so a row renders and saves the same way
// whether it came from a workday, a setup/cleanup roster or a party duty slot.
interface MakeupRow {
  key: string;
  kind: MakeupKind;
  // Primary key of the underlying attendance/assignment/slot row.
  id: number;
  name: string;
  date: string;
  href: string;
  label: string;
  // Which of the three shift categories the row belongs to; absent on workdays.
  shiftType?: "setup" | "cleanup" | "party";
  // Party rows carry the duty and hour; nothing else has one.
  detail?: string | null;
  status: string;
  makeup_completed_at?: string | null;
  makeup_assignment?: string | null;
}

function fmtDate(d: string) {
  return dayjs(d).format("MMM D, YYYY");
}

function dateInputValue(d?: string | null) {
  return d ? dayjs(d).format("YYYY-MM-DD") : "";
}

function name(r: { first_name: string; last_name: string }) {
  return `${r.last_name}, ${r.first_name}`;
}

function workdayRow(r: AllMakeupsWorkday): MakeupRow {
  return {
    key: `wd-${r.id}`,
    kind: "workday",
    id: r.id,
    name: name(r),
    date: r.workday_date,
    href: `/workdays/${r.workday_id}`,
    label: r.title ?? "Workday",
    status: r.status,
    makeup_completed_at: r.makeup_completed_at,
    makeup_assignment: r.makeup_assignment,
  };
}

function shiftRow(r: AllMakeupsShift): MakeupRow {
  return {
    key: `sh-${r.id}`,
    kind: "shift",
    id: r.id,
    shiftType: r.shift_type,
    name: name(r),
    date: r.event_date,
    href: `/shifts/${r.shift_id}`,
    label: r.title ?? (r.shift_type === "setup" ? "Setup Shift" : "Cleanup Shift"),
    status: "Absent",
    makeup_completed_at: r.makeup_completed_at,
    makeup_assignment: r.makeup_assignment,
  };
}

function partyRow(r: AllMakeupsParty): MakeupRow {
  return {
    key: `pt-${r.id}`,
    kind: "party",
    id: r.id,
    shiftType: "party",
    name: name(r),
    date: r.event_date,
    href: `/shifts/${r.shift_id}`,
    label: r.title ?? "Party",
    detail: `${r.duty_name} · ${r.slot_start}`,
    status: "Absent",
    makeup_completed_at: r.makeup_completed_at,
    makeup_assignment: r.makeup_assignment,
  };
}

function matches(row: MakeupRow, q: string) {
  if (!q) return true;
  return (
    row.name.toLowerCase().includes(q) ||
    row.label.toLowerCase().includes(q) ||
    (row.makeup_assignment ?? "").toLowerCase().includes(q)
  );
}

interface RowProps {
  row: MakeupRow;
  canWrite: boolean;
  onPatch: (row: MakeupRow, patch: { makeup_completed_at?: string | null; makeup_assignment?: string | null }) => void;
}

// A single makeup, editable in place. The whole point of the page is to work
// through a list of these without opening the workday or shift each one came
// from, so both fields save from here.
function MakeupRowView({ row, canWrite, onPatch }: RowProps) {
  const [assignment, setAssignment] = React.useState(row.makeup_assignment ?? "");

  // Follow the server's value when the list reloads, but never while the field
  // is being typed into — that is what the dirty check is for.
  React.useEffect(() => {
    setAssignment(row.makeup_assignment ?? "");
  }, [row.makeup_assignment]);

  const dirty = assignment !== (row.makeup_assignment ?? "");

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={1}
      alignItems={{ md: "center" }}
      sx={{ py: 0.75 }}
    >
      <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 160 }}>
        {row.name}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110 }}>
        {fmtDate(row.date)}
      </Typography>
      <Box sx={{ minWidth: 180, flexGrow: 1 }}>
        <Typography variant="body2">
          <Link href={row.href} style={{ textDecoration: "underline" }}>
            {row.label}
          </Link>
        </Typography>
        {row.detail && (
          <Typography variant="caption" color="text.secondary">
            {row.detail}
          </Typography>
        )}
      </Box>
      <Chip
        label={row.status}
        size="small"
        color={row.makeup_completed_at ? "success" : "error"}
        sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
      />
      <TextField
        size="small"
        label="Assigned makeup"
        placeholder="e.g. kitchen deep clean"
        value={assignment}
        disabled={!canWrite}
        onChange={(e) => setAssignment(e.target.value)}
        // Saved on blur rather than per keystroke: a makeup description is
        // written once, and a request per character would be noise.
        onBlur={() => dirty && onPatch(row, { makeup_assignment: assignment })}
        sx={{ minWidth: 240, flexGrow: 1 }}
      />
      <TextField
        size="small"
        type="date"
        label="Completed"
        value={dateInputValue(row.makeup_completed_at)}
        disabled={!canWrite}
        onChange={(e) => onPatch(row, { makeup_completed_at: e.target.value || null })}
        InputLabelProps={{ shrink: true }}
        sx={{ width: 170 }}
      />
    </Stack>
  );
}

interface SectionProps {
  title: string;
  rows: MakeupRow[];
  canWrite: boolean;
  onPatch: RowProps["onPatch"];
}

function Section({ title, rows, canWrite, onPatch }: SectionProps) {
  return (
    <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        {title} ({rows.length})
      </Typography>
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Nothing outstanding.
        </Typography>
      ) : (
        <Stack spacing={0} divider={<Divider />}>
          {rows.map((r) => (
            <MakeupRowView key={r.key} row={r} canWrite={canWrite} onPatch={onPatch} />
          ))}
        </Stack>
      )}
    </Paper>
  );
}

export default function MakeupsPage() {
  const { can } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<IAllMakeups | null>(null);
  const [search, setSearch] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);

  // Writing any one kind is enough to show the fields; the server still checks
  // each row against the permission for its own workday or shift type.
  const canWrite =
    can("workdays.write") ||
    can("shifts.setup.write") ||
    can("shifts.cleanup.write") ||
    can("shifts.party.write");

  const load = React.useCallback(async () => {
    try {
      const d = await getAllMakeups();
      setData(d);
      setError(null);
    } catch (e) {
      setError((e as Error)?.message ?? "Failed to load makeups.");
    }
  }, []);

  React.useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onPatch = React.useCallback<RowProps["onPatch"]>(
    async (row, patch) => {
      setSaving(true);
      setError(null);
      // Optimistic, so a row that just got a completion date moves down to the
      // completed section immediately instead of after the round trip.
      setData((prev) => {
        if (!prev) return prev;
        const apply = <T extends { id: number }>(rows: T[], kind: MakeupKind) =>
          row.kind === kind ? rows.map((r) => (r.id === row.id ? { ...r, ...patch } : r)) : rows;
        return {
          workday_makeups: apply(prev.workday_makeups, "workday"),
          shift_makeups: apply(prev.shift_makeups, "shift"),
          party_makeups: apply(prev.party_makeups, "party"),
        };
      });
      try {
        await updateMakeup(row.kind, row.id, patch);
        setSavedAt(new Date());
      } catch (e) {
        setError((e as Error)?.message ?? "Could not save that change.");
        // Put the server's version back rather than leaving the optimistic one.
        await load();
      } finally {
        setSaving(false);
      }
    },
    [load]
  );

  const q = search.trim().toLowerCase();

  const { workdays, parties, setups, cleanups, completed } = React.useMemo(() => {
    const all: MakeupRow[] = [
      ...(data?.workday_makeups ?? []).map(workdayRow),
      ...(data?.shift_makeups ?? []).map(shiftRow),
      ...(data?.party_makeups ?? []).map(partyRow),
    ].filter((r) => matches(r, q));

    const outstanding = all.filter((r) => !r.makeup_completed_at);

    return {
      workdays: outstanding.filter((r) => r.kind === "workday"),
      parties: outstanding.filter((r) => r.kind === "party"),
      setups: outstanding.filter((r) => r.shiftType === "setup"),
      cleanups: outstanding.filter((r) => r.shiftType === "cleanup"),
      completed: all
        .filter((r) => r.makeup_completed_at)
        .sort((a, b) => (a.makeup_completed_at! < b.makeup_completed_at! ? 1 : -1)),
    };
  }, [data, q]);

  const totalOutstanding = workdays.length + parties.length + setups.length + cleanups.length;

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
          <Stack direction="row" alignItems="center" spacing={1}>
            <SaveIndicator saving={saving} savedAt={savedAt} />
            <TextField
              size="small"
              label="Search"
              placeholder="name, event or makeup"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: 220 }}
            />
          </Stack>
        </Stack>
      </Paper>

      {loading && (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      )}
      {error && <Alert severity="error">{error}</Alert>}

      {!loading && data && totalOutstanding === 0 && (
        <Alert severity="success">No outstanding makeups.</Alert>
      )}

      {!loading && data && (
        <>
          {/* Workdays are their own thing — a whole missed day rather than a
              shift at an event — so they lead, separate from the three shift
              categories. */}
          <Section title="Workday Makeups" rows={workdays} canWrite={canWrite} onPatch={onPatch} />
          <Section title="Party Makeups" rows={parties} canWrite={canWrite} onPatch={onPatch} />
          <Section title="Setup Makeups" rows={setups} canWrite={canWrite} onPatch={onPatch} />
          <Section title="Cleanup Makeups" rows={cleanups} canWrite={canWrite} onPatch={onPatch} />

          {/* Collapsed by default: finished makeups are for looking things up,
              not for working through. Clearing the date here sends one back to
              its outstanding section. */}
          <Accordion elevation={0} sx={{ border: "1px solid", borderColor: "divider" }} disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Completed Makeups ({completed.length})</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {completed.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No completed makeups yet.
                </Typography>
              ) : (
                <Stack spacing={0} divider={<Divider />}>
                  {completed.map((r) => (
                    <MakeupRowView key={r.key} row={r} canWrite={canWrite} onPatch={onPatch} />
                  ))}
                </Stack>
              )}
            </AccordionDetails>
          </Accordion>
        </>
      )}
    </Stack>
  );
}
