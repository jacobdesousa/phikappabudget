import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SettingsIcon from "@mui/icons-material/Settings";
import { useAuth } from "../context/authContext";
import { getChoreSchedule, getCurrentChores } from "../services/choresService";
import {
  IChoreCaptain,
  IChoreEntry,
  IChorePeriod,
  IChoreSchedule,
  IChoreSettings,
} from "../interfaces/api.interface";
import { schoolYearLabel } from "../utils/schoolYear";

const CELL_SX = { py: 0.75 };
const HEAD_SX = { py: 1, fontWeight: 700, whiteSpace: "nowrap" as const };
// Tables scroll inside their own box; the page itself never scrolls sideways.
const SCROLL_BOX_SX = { overflowX: "auto" as const, maxWidth: "100%" };
const PANEL_SX = {
  border: "1px solid",
  borderColor: "divider",
  overflow: "hidden",
  minWidth: 0,
};
const STICKY_CELL_SX = {
  position: "sticky" as const,
  left: 0,
  zIndex: 2,
  bgcolor: "background.paper",
  borderRight: "1px solid",
  borderColor: "divider",
};

function residentName(entry: IChoreEntry) {
  if (entry.is_vacant) return "Vacant";
  return `${entry.first_name ?? ""} ${entry.last_name ?? ""}`.trim() || "Vacant";
}

// One period's duty list: chore on the left, whoever lives in the bedroom the
// schedule assigns it to beside it.
function PeriodBoard(props: { period: IChorePeriod }) {
  const { period } = props;
  return (
    <TableContainer sx={SCROLL_BOX_SX}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...HEAD_SX, width: 40 }}>#</TableCell>
            <TableCell sx={HEAD_SX}>Duty</TableCell>
            <TableCell sx={HEAD_SX}>Resident</TableCell>
            <TableCell sx={{ ...HEAD_SX, width: 90 }}>Bedroom</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {period.entries.length === 0 && (
            <TableRow>
              <TableCell colSpan={4}>
                <Typography variant="body2" color="text.secondary">
                  Nobody is scheduled for this period.
                </Typography>
              </TableCell>
            </TableRow>
          )}
          {period.entries.map((entry) => (
            <TableRow key={`${entry.room_id}-${entry.bed}`} hover>
              <TableCell sx={{ ...CELL_SX, width: 40, color: "text.secondary" }}>
                {entry.duty_no}
              </TableCell>
              <TableCell sx={CELL_SX}>
                <Tooltip title={entry.duty_description ?? ""} placement="top-start">
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {entry.duty_name}
                  </Typography>
                </Tooltip>
              </TableCell>
              <TableCell sx={CELL_SX}>
                <Typography
                  variant="body2"
                  color={entry.is_vacant ? "text.secondary" : "text.primary"}
                >
                  {residentName(entry)}
                </Typography>
              </TableCell>
              <TableCell sx={{ ...CELL_SX, width: 90 }}>
                <Typography variant="body2" color="text.secondary">
                  {entry.bed_label}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function ChoresPage() {
  const { can } = useAuth();
  const canConfig = can("chores.config");

  // The school year is never picked directly — it follows the period being
  // viewed, and stepping off either end of one rolls into the next.
  const [year, setYear] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [todayStart, setTodayStart] = useState<string | null>(null);
  const [settings, setSettings] = useState<IChoreSettings | null>(null);
  const [captains, setCaptains] = useState<IChoreCaptain[]>([]);
  const [schedule, setSchedule] = useState<IChoreSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Which end of the incoming year to land on after stepping past a boundary.
  const landOn = useRef<"first" | "last" | null>(null);
  // Years already fetched. Stepping day to day is instant because the whole
  // year is in memory; without this, crossing Aug 31 -> Sep 1 would block on a
  // round trip, which is the one step that felt slow.
  const cache = useRef(new Map<number, IChoreSchedule>());

  // Open on the period containing today.
  useEffect(() => {
    let cancelled = false;
    getCurrentChores()
      .then((cur) => {
        if (cancelled) return;
        setTodayStart(cur.current.start_date);
        setSelected(cur.current.start_date);
        setSettings(cur.settings);
        setCaptains(cur.captains);
        setYear(cur.current.school_year);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message ?? "Could not load the chore schedule.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const show = useCallback((sched: IChoreSchedule) => {
    setSchedule(sched);
    if (landOn.current) {
      const edge =
        landOn.current === "first" ? sched.periods[0] : sched.periods[sched.periods.length - 1];
      if (edge) setSelected(edge.start_date);
      landOn.current = null;
    }
  }, []);

  // Warms the cache without touching the view.
  const prefetch = useCallback(async (schoolYear: number) => {
    if (cache.current.has(schoolYear)) return;
    try {
      const sched = await getChoreSchedule({ year: schoolYear });
      cache.current.set(schoolYear, sched);
    } catch {
      // A neighbouring year failing to prefetch is not worth surfacing; the
      // real fetch will report it if the user actually steps there.
    }
  }, []);

  const loadYear = useCallback(
    async (schoolYear: number) => {
      const cached = cache.current.get(schoolYear);
      if (cached) {
        show(cached);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const sched = await getChoreSchedule({ year: schoolYear });
        cache.current.set(schoolYear, sched);
        show(sched);
      } catch (e: any) {
        setError(e?.message ?? "Could not load the chore schedule.");
      } finally {
        setLoading(false);
      }
    },
    [show]
  );

  useEffect(() => {
    if (year != null) void loadYear(year);
  }, [year, loadYear]);

  // Once the current year is on screen, quietly fetch the years on either side
  // so stepping across a September boundary is as instant as any other step.
  useEffect(() => {
    if (year == null || loading) return;
    const timer = setTimeout(() => {
      void prefetch(year + 1);
      void prefetch(year - 1);
    }, 250);
    return () => clearTimeout(timer);
  }, [year, loading, prefetch]);

  const periods = schedule?.periods ?? [];
  const index = selected ? periods.findIndex((p) => p.start_date === selected) : -1;
  const period = index >= 0 ? periods[index] : null;

  function step(delta: number) {
    const next = index + delta;
    if (next >= 0 && next < periods.length) {
      setSelected(periods[next].start_date);
      return;
    }
    // Off the end of the school year: roll into the neighbouring one.
    if (year == null) return;
    landOn.current = delta > 0 ? "first" : "last";
    setYear(year + (delta > 0 ? 1 : -1));
  }

  // The year grid, shaped like the printed sheet: one row per bedroom, one
  // column per half-month, holding the duty number.
  const grid = useMemo(() => {
    if (!schedule) return null;
    // Rows keyed by bed, ordered the way House Config orders the bedrooms.
    const byBed = new Map<
      string,
      { bed_label: string; sort: number; bed: number; cells: Map<string, IChoreEntry> }
    >();

    for (const p of schedule.periods) {
      for (const entry of p.entries) {
        const key = `${entry.room_id}-${entry.bed}`;
        const row =
          byBed.get(key) ?? {
            bed_label: entry.bed_label,
            sort: entry.sort_order ?? Number.MAX_SAFE_INTEGER,
            bed: entry.bed,
            cells: new Map<string, IChoreEntry>(),
          };
        row.cells.set(p.start_date, entry);
        byBed.set(key, row);
      }
    }

    const months: { label: string; periods: IChorePeriod[] }[] = [];
    for (const p of schedule.periods) {
      const last = months[months.length - 1];
      if (last && last.label === p.month_label) last.periods.push(p);
      else months.push({ label: p.month_label, periods: [p] });
    }

    return {
      months,
      rows: Array.from(byBed.entries()).sort(
        (a, b) => a[1].sort - b[1].sort || a[1].bed - b[1].bed
      ),
    };
  }, [schedule]);

  // Where the period being viewed sits relative to today's, so the header can
  // say so rather than making you work it out from the dates.
  const todayIndex = todayStart ? periods.findIndex((p) => p.start_date === todayStart) : -1;
  const relative = todayIndex >= 0 && index >= 0 ? index - todayIndex : null;
  const relativeLabel =
    relative === 0
      ? "Current Rotation"
      : relative === 1
        ? "Next Rotation"
        : relative === -1
          ? "Previous Rotation"
          : null;
  const isToday = relative === 0;

  return (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <Paper elevation={0} sx={{ ...PANEL_SX, p: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ sm: "center" }}
          justifyContent="space-between"
        >
          <Box>
            <Typography variant="h5">Chores</Typography>
            <Typography variant="body2" color="text.secondary">
              Who is on duty for each stretch of the month.
            </Typography>
          </Box>
          {canConfig && (
            <Button
              size="small"
              startIcon={<SettingsIcon />}
              component={Link as any}
              href="/chores-config"
            >
              Configure
            </Button>
          )}
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {loading && !schedule ? (
        <CircularProgress />
      ) : (
        <>
          <Paper elevation={0} sx={PANEL_SX}>
            <Box sx={{ p: 2, pb: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <IconButton onClick={() => step(-1)} disabled={loading} aria-label="previous period">
                  <ChevronLeftIcon />
                </IconButton>

                <Stack alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }} noWrap>
                    {period ? `${period.label}, ${period.year}` : "—"}
                  </Typography>
                  {relativeLabel && (
                    <Chip
                      size="small"
                      variant="outlined"
                      color={relative === 0 ? "primary" : "default"}
                      label={relativeLabel}
                    />
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {period ? schoolYearLabel(period.school_year) : ""}
                  </Typography>
                </Stack>

                <IconButton onClick={() => step(1)} disabled={loading} aria-label="next period">
                  <ChevronRightIcon />
                </IconButton>
              </Stack>

              {!isToday && todayStart && (
                <Box sx={{ textAlign: "center", mt: 0.5 }}>
                  <Button
                    size="small"
                    onClick={() => {
                      const inThisYear = periods.some((p) => p.start_date === todayStart);
                      if (inThisYear) setSelected(todayStart);
                      else {
                        setSelected(todayStart);
                        setYear(Number(todayStart.slice(0, 4)) - (Number(todayStart.slice(5, 7)) >= 9 ? 0 : 1));
                      }
                    }}
                  >
                    Back to today
                  </Button>
                </Box>
              )}
            </Box>

            {period ? (
              <PeriodBoard period={period} />
            ) : (
              <Box sx={{ p: 2, pt: 0 }}>
                <Typography variant="body2" color="text.secondary">
                  No schedule stored for this period.
                </Typography>
              </Box>
            )}
          </Paper>

          {grid && (
            <Paper elevation={0} sx={PANEL_SX}>
              <Box sx={{ p: 2, pb: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Schedule — {schoolYearLabel(schedule!.year)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Duty number by bedroom and half-month; a blank cell means that
                  bedroom is off duty. The same schedule runs every year — click
                  a column to jump to it.
                </Typography>
              </Box>
              <TableContainer sx={SCROLL_BOX_SX}>
                <Table size="small" sx={{ "& td, & th": { whiteSpace: "nowrap" } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ ...HEAD_SX, ...STICKY_CELL_SX, zIndex: 3 }}>Bedroom</TableCell>
                      {grid.months.map((m) => (
                        <TableCell
                          key={m.label}
                          sx={{ ...HEAD_SX, textAlign: "center" }}
                          colSpan={m.periods.length}
                        >
                          {m.label.replace(/ \d{4}$/, "")}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ ...HEAD_SX, ...STICKY_CELL_SX, zIndex: 3 }} />
                      {grid.months.flatMap((m) =>
                        m.periods.map((p) => (
                          <TableCell
                            key={p.start_date}
                            align="center"
                            sx={{
                              ...HEAD_SX,
                              fontWeight: p.start_date === selected ? 700 : 500,
                              color: p.start_date === selected ? "primary.main" : "text.secondary",
                              cursor: "pointer",
                            }}
                            onClick={() => setSelected(p.start_date)}
                          >
                            {p.label.replace(/^\D+/, "")}
                          </TableCell>
                        ))
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {grid.rows.map(([bedKey, row]) => (
                      <TableRow key={bedKey} hover>
                        <TableCell sx={{ ...CELL_SX, ...STICKY_CELL_SX, fontWeight: 600 }}>
                          {row.bed_label}
                        </TableCell>
                        {grid.months.flatMap((m) =>
                          m.periods.map((p) => {
                            const entry = row.cells.get(p.start_date);
                            const isSelected = p.start_date === selected;
                            return (
                              <TableCell
                                key={p.start_date}
                                align="center"
                                sx={{
                                  ...CELL_SX,
                                  bgcolor: isSelected ? "action.hover" : undefined,
                                }}
                              >
                                {entry ? (
                                  <Tooltip title={`${entry.duty_name ?? ""} — ${residentName(entry)}`}>
                                    <Typography variant="body2">{entry.duty_no}</Typography>
                                  </Tooltip>
                                ) : null}
                              </TableCell>
                            );
                          })
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          <Paper elevation={0} sx={{ ...PANEL_SX, p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Duties
            </Typography>
            <Stack spacing={1.25}>
              {(schedule?.duties ?? []).map((duty) => (
                <Box key={duty.duty_no}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    ({duty.duty_no}) {duty.name}
                  </Typography>
                  {duty.description && (
                    <Typography variant="body2" color="text.secondary">
                      {duty.description}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          </Paper>

          {(captains.length > 0 || settings?.manager_notes) && (
            <Paper elevation={0} sx={{ ...PANEL_SX, p: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                House Manager &amp; Captains
              </Typography>
              {settings?.manager_notes && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ whiteSpace: "pre-line", mb: captains.length ? 2 : 0 }}
                >
                  {settings.manager_notes}
                </Typography>
              )}
              {captains.length > 0 && (
                <>
                  <Divider sx={{ mb: 1.5 }} />
                  <Stack spacing={1}>
                    {captains.map((c) => (
                      <Stack
                        key={c.captain_key}
                        direction={{ xs: "column", sm: "row" }}
                        spacing={{ xs: 0, sm: 1 }}
                        alignItems={{ sm: "baseline" }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 200 }}>
                          {c.name}
                        </Typography>
                        <Typography variant="body2">
                          {c.brother_id ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() : "Unassigned"}
                        </Typography>
                        {c.description && (
                          <Typography variant="body2" color="text.secondary">
                            {c.description}
                          </Typography>
                        )}
                      </Stack>
                    ))}
                  </Stack>
                </>
              )}
            </Paper>
          )}
        </>
      )}
    </Stack>
  );
}
