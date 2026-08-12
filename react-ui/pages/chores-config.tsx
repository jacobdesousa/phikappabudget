import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
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
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { SxProps, Theme } from "@mui/material/styles";
import { useAuth } from "../context/authContext";
import { getChoreConfig, saveChoreConfig, seedChoreConfig } from "../services/choresService";
import { getAllBrothers } from "../services/brotherService";
import {
  IBrother,
  IChoreBed,
  IChoreCaptain,
  IChoreConfig,
  IChoreDuty,
  IChoreSettings,
} from "../interfaces/api.interface";

const CELL_SX = { py: 0.5 };
const HEAD_SX = { py: 1, fontWeight: 700, whiteSpace: "nowrap" as const };
// Tables scroll inside their own box; the page itself never scrolls sideways.
const SCROLL_BOX_SX = { overflowX: "auto" as const, maxWidth: "100%" };
const PANEL_SX = {
  border: "1px solid",
  borderColor: "divider",
  overflow: "hidden",
  minWidth: 0,
};
const STICKY_SX = {
  position: "sticky" as const,
  left: 0,
  zIndex: 2,
  bgcolor: "background.paper",
  borderRight: "1px solid",
  borderColor: "divider",
};

// The grid's 24 columns run September → August, two per month, like the sheet.
const GRID_MONTHS = [
  "Sept", "Oct", "Nov", "Dec", "Jan", "Feb",
  "Mar", "Apr", "May", "Jun", "Jul", "Aug",
];

function brotherName(b: Pick<IBrother, "first_name" | "last_name">) {
  return `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim();
}

// Reads as plain text until clicked, like the budget table: 500 permanently
// rendered inputs is both slow and hard to read.
function EditableCell(props: {
  value: string;
  display?: React.ReactNode;
  onCommit: (raw: string) => void;
  canWrite: boolean;
  align?: "left" | "center" | "right";
  multiline?: boolean;
  numeric?: boolean;
  error?: boolean;
  placeholder?: string;
  sx?: SxProps<Theme>;
  inputWidth?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const align = props.align ?? "left";

  if (!props.canWrite || !editing) {
    return (
      <TableCell
        align={align}
        sx={{
          ...CELL_SX,
          cursor: props.canWrite ? "pointer" : "default",
          color: props.error ? "error.main" : undefined,
          "&:hover": props.canWrite
            ? { bgcolor: "action.hover", textDecoration: "underline dotted" }
            : {},
          ...props.sx,
        }}
        onClick={
          props.canWrite
            ? () => {
                setDraft(props.value);
                setEditing(true);
              }
            : undefined
        }
      >
        {props.display ?? (props.value || (
          <Typography component="span" variant="body2" color="text.disabled">
            {props.placeholder ?? "—"}
          </Typography>
        ))}
      </TableCell>
    );
  }

  const commit = () => {
    props.onCommit(draft);
    setEditing(false);
  };

  return (
    <TableCell align={align} sx={{ py: "1px", px: "2px", ...props.sx }}>
      <TextField
        autoFocus
        size="small"
        fullWidth={!props.inputWidth}
        multiline={props.multiline}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          // Enter commits, except in a multiline field where it's a newline.
          if (e.key === "Enter" && !props.multiline) (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        inputProps={{
          inputMode: props.numeric ? "numeric" : undefined,
          style: {
            padding: "3px 6px",
            textAlign: align,
            width: props.inputWidth,
          },
        }}
      />
    </TableCell>
  );
}

// Same idea for the one cell that picks a person rather than typing text.
function EditableBrotherCell(props: {
  value: number | null;
  brothers: IBrother[];
  onCommit: (id: number | null) => void;
  canWrite: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const current = props.brothers.find((b) => b.id === props.value);

  if (!props.canWrite || !editing) {
    return (
      <TableCell
        sx={{
          ...CELL_SX,
          cursor: props.canWrite ? "pointer" : "default",
          "&:hover": props.canWrite
            ? { bgcolor: "action.hover", textDecoration: "underline dotted" }
            : {},
        }}
        onClick={props.canWrite ? () => setEditing(true) : undefined}
      >
        {current ? (
          brotherName(current)
        ) : (
          <Typography component="span" variant="body2" color="text.disabled">
            Unassigned
          </Typography>
        )}
      </TableCell>
    );
  }

  return (
    <TableCell sx={{ py: "1px", px: "2px" }}>
      <TextField
        select
        autoFocus
        size="small"
        fullWidth
        value={props.value ?? ""}
        SelectProps={{ defaultOpen: true, onClose: () => setEditing(false) }}
        onChange={(e) => {
          props.onCommit(e.target.value === "" ? null : Number(e.target.value));
          setEditing(false);
        }}
      >
        <MenuItem value="">Unassigned</MenuItem>
        {props.brothers.map((b) => (
          <MenuItem key={b.id} value={b.id}>
            {brotherName(b)}
          </MenuItem>
        ))}
      </TextField>
    </TableCell>
  );
}

export default function ChoresConfigPage() {
  const { can } = useAuth();
  const canWrite = can("chores.config");

  const [config, setConfig] = useState<IChoreConfig | null>(null);
  const [brothers, setBrothers] = useState<IBrother[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Drafts: the whole config is edited locally and saved in one go, like the
  // house config page.
  const [settings, setSettings] = useState<IChoreSettings | null>(null);
  const [duties, setDuties] = useState<IChoreDuty[]>([]);
  const [captains, setCaptains] = useState<IChoreCaptain[]>([]);
  // Grid held as `${room_id}|${bed}|${period_index}` -> duty number, which is
  // what the cell inputs read and write.
  const [grid, setGrid] = useState<Record<string, number>>({});

  const applyConfig = useCallback((cfg: IChoreConfig) => {
    setConfig(cfg);
    setSettings(cfg.settings);
    setDuties(cfg.duties);
    setCaptains(cfg.captains);
    setGrid(
      Object.fromEntries(
        cfg.grid.map((c) => [`${c.room_id}|${c.bed}|${c.period_index}`, c.duty_no])
      )
    );
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      applyConfig(await getChoreConfig());
    } catch (e: any) {
      setConfig(null);
      setError(e?.message ?? "Could not load the chore configuration.");
    } finally {
      setLoading(false);
    }
  }, [applyConfig]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getAllBrothers()
      .then(setBrothers)
      .catch(() => {});
  }, []);

  const beds = useMemo<IChoreBed[]>(() => config?.beds ?? [], [config]);
  const cellKey = (bed: IChoreBed, period: number) => `${bed.room_id}|${bed.bed}|${period}`;

  const dutyNos = useMemo(() => new Set(duties.map((d) => d.duty_no)), [duties]);

  // Each column should hold every duty at most once — two beds on the same duty
  // in the same half-month is almost always a typo.
  const columnIssues = useMemo(() => {
    const issues = new Map<number, string>();
    for (let period = 0; period < 24; period++) {
      const seen = new Map<number, number>();
      for (const bed of beds) {
        const duty = grid[cellKey(bed, period)];
        if (duty == null) continue;
        seen.set(duty, (seen.get(duty) ?? 0) + 1);
      }
      const dupes = Array.from(seen.entries()).filter(([, n]) => n > 1).map(([d]) => d);
      if (dupes.length) issues.set(period, `Duty ${dupes.join(", ")} assigned twice`);
    }
    return issues;
  }, [grid, beds]);

  const unknownDuties = useMemo(
    () => Object.values(grid).filter((d) => !dutyNos.has(d)).length,
    [grid, dutyNos]
  );

  function setCell(key: string, raw: string) {
    setGrid((prev) => {
      const next = { ...prev };
      const value = Number(raw);
      if (raw.trim() === "" || !Number.isFinite(value) || value <= 0) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  function patchDuty(index: number, patch: Partial<IChoreDuty>) {
    setDuties((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function patchCaptain(index: number, patch: Partial<IChoreCaptain>) {
    setCaptains((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const cells = Object.entries(grid).map(([key, duty_no]) => {
        const [room_id, bed, period_index] = key.split("|").map(Number);
        return { room_id, bed, period_index, duty_no };
      });
      applyConfig(
        await saveChoreConfig({
          settings,
          duties,
          grid: cells,
          captains: captains.map((c, i) => ({ ...c, sort_order: (i + 1) * 10 })),
        })
      );
      setNotice("Saved.");
    } catch (e: any) {
      setError(e?.message ?? "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSeed(reset: boolean) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      applyConfig(await seedChoreConfig(reset));
      setNotice(reset ? "Reset to the printed schedule." : "Loaded the printed schedule.");
    } catch (e: any) {
      setError(e?.message ?? "Could not load the defaults.");
    } finally {
      setSaving(false);
    }
  }

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
            <Typography variant="h5">Chores Config</Typography>
            <Typography variant="body2" color="text.secondary">
              The duty list and the schedule itself: one duty per bedroom per
              half-month, exactly as the printed sheet lays it out.
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
      {!canWrite && <Alert severity="info">You have read-only access to this page.</Alert>}

      {loading || !settings ? (
        <CircularProgress />
      ) : (
        <>
          {config && !config.is_configured && (
            <Alert
              severity="info"
              action={
                canWrite && (
                  <Button size="small" onClick={() => handleSeed(false)} disabled={saving}>
                    Load printed schedule
                  </Button>
                )
              }
            >
              No schedule set up yet.
            </Alert>
          )}

          {/* ── Duties ────────────────────────────────────────────────────── */}
          <Paper elevation={0} sx={PANEL_SX}>
            <Box sx={{ p: 2, pb: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Duties
              </Typography>
              <Typography variant="body2" color="text.secondary">
                The numbers used in the schedule below. Click any value to edit it.
              </Typography>
            </Box>
            <TableContainer sx={SCROLL_BOX_SX}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...HEAD_SX, width: 70 }}>#</TableCell>
                    <TableCell sx={{ ...HEAD_SX, width: 240 }}>Name</TableCell>
                    <TableCell sx={HEAD_SX}>Description</TableCell>
                    <TableCell sx={{ ...HEAD_SX, width: 60 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {duties.map((duty, idx) => (
                    <TableRow key={idx} hover>
                      <EditableCell
                        canWrite={canWrite}
                        value={String(duty.duty_no)}
                        display={<strong>{duty.duty_no}</strong>}
                        numeric
                        inputWidth={40}
                        sx={{ width: 70 }}
                        onCommit={(raw) => {
                          const next = Number(raw);
                          if (Number.isFinite(next) && next > 0) patchDuty(idx, { duty_no: next });
                        }}
                      />
                      <EditableCell
                        canWrite={canWrite}
                        value={duty.name}
                        placeholder="Untitled duty"
                        sx={{ width: 240 }}
                        onCommit={(raw) => patchDuty(idx, { name: raw })}
                      />
                      <EditableCell
                        canWrite={canWrite}
                        value={duty.description ?? ""}
                        placeholder="No description"
                        multiline
                        onCommit={(raw) => patchDuty(idx, { description: raw })}
                      />
                      <TableCell sx={{ ...CELL_SX, width: 60 }} align="right">
                        {canWrite && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDuties((prev) => prev.filter((_x, i) => i !== idx))}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {canWrite && (
              <Box sx={{ p: 2, pt: 1 }}>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() =>
                    setDuties((prev) => [
                      ...prev,
                      {
                        duty_no: prev.reduce((m, d) => Math.max(m, d.duty_no), 0) + 1,
                        name: "",
                        description: "",
                      },
                    ])
                  }
                >
                  Add duty
                </Button>
              </Box>
            )}
          </Paper>

          {/* ── The schedule grid ─────────────────────────────────────────── */}
          <Paper elevation={0} sx={PANEL_SX}>
            <Box sx={{ p: 2, pb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Schedule
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Duty number for each bedroom in each half-month; blank means off
                duty. <strong>Click a cell to change the assignment</strong> —
                Enter or click away to keep it, Esc to cancel. The rows are the
                beds set up in House Config. One schedule runs every year, so an
                edit here changes past periods too.
              </Typography>
              {(columnIssues.size > 0 || unknownDuties > 0) && (
                <Alert severity="warning" sx={{ mt: 1.5 }}>
                  {columnIssues.size > 0 &&
                    `${columnIssues.size} half-month${columnIssues.size === 1 ? " has" : "s have"} the same duty on two bedrooms. `}
                  {unknownDuties > 0 && `${unknownDuties} cell(s) use a duty number that doesn't exist.`}
                </Alert>
              )}
            </Box>

            <TableContainer sx={SCROLL_BOX_SX}>
              <Table size="small" sx={{ "& td, & th": { whiteSpace: "nowrap" } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...HEAD_SX, ...STICKY_SX, zIndex: 3 }}>Bedroom</TableCell>
                    {GRID_MONTHS.map((m) => (
                      <TableCell key={m} colSpan={2} align="center" sx={HEAD_SX}>
                        {m}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ ...HEAD_SX, ...STICKY_SX, zIndex: 3 }} />
                    {GRID_MONTHS.flatMap((m, monthIdx) =>
                      [0, 1].map((half) => {
                        const period = monthIdx * 2 + half;
                        const issue = columnIssues.get(period);
                        return (
                          <Tooltip key={period} title={issue ?? ""}>
                            <TableCell
                              align="center"
                              sx={{
                                ...HEAD_SX,
                                fontWeight: 500,
                                color: issue ? "warning.main" : "text.secondary",
                              }}
                            >
                              {half === 0 ? "1st" : "2nd"}
                            </TableCell>
                          </Tooltip>
                        );
                      })
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {beds.map((bed) => (
                    <TableRow key={`${bed.room_id}-${bed.bed}`} hover>
                      <TableCell sx={{ ...CELL_SX, ...STICKY_SX, fontWeight: 600 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {bed.bed_label}
                        </Typography>
                      </TableCell>

                      {Array.from({ length: 24 }, (_v, period) => {
                        const key = cellKey(bed, period);
                        const value = grid[key];
                        const bad = value != null && !dutyNos.has(value);
                        return (
                          <EditableCell
                            key={period}
                            canWrite={canWrite}
                            align="center"
                            numeric
                            error={bad}
                            inputWidth={28}
                            sx={{ width: 46, px: 0.25 }}
                            value={value == null ? "" : String(value)}
                            display={
                              value == null ? (
                                <Typography component="span" variant="body2" color="text.disabled">
                                  ·
                                </Typography>
                              ) : (
                                value
                              )
                            }
                            onCommit={(raw) => setCell(key, raw)}
                          />
                        );
                      })}
                    </TableRow>
                  ))}
                  {beds.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={25}>
                        <Typography variant="body2" color="text.secondary">
                          No bedrooms yet — add them in House Config.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* ── Calendar & manager notes ──────────────────────────────────── */}
          <Paper elevation={0} sx={{ ...PANEL_SX, p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
              Calendar &amp; House Manager
            </Typography>
            <TextField
              label="Second half starts on"
              type="number"
              value={settings.split_day}
              onChange={(e) => setSettings({ ...settings, split_day: Number(e.target.value) })}
              inputProps={{ min: 2, max: 28 }}
              disabled={!canWrite}
              helperText={`Months split 1–${settings.split_day - 1} and ${settings.split_day}–end`}
              sx={{ maxWidth: 260 }}
            />
            <TextField
              label="House Manager notes"
              value={settings.manager_notes ?? ""}
              onChange={(e) => setSettings({ ...settings, manager_notes: e.target.value })}
              disabled={!canWrite}
              fullWidth
              multiline
              minRows={3}
              sx={{ mt: 2 }}
              helperText="Shown on the chores page above the captains"
            />
          </Paper>

          {/* ── Captains ──────────────────────────────────────────────────── */}
          <Paper elevation={0} sx={PANEL_SX}>
            <Box sx={{ p: 2, pb: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Captains
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Standing appointments the Gamma recruits. Not part of the
                schedule. Click any value to edit it.
              </Typography>
            </Box>
            <TableContainer sx={SCROLL_BOX_SX}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...HEAD_SX, width: 220 }}>Captaincy</TableCell>
                    <TableCell sx={{ ...HEAD_SX, width: 220 }}>Assigned to</TableCell>
                    <TableCell sx={HEAD_SX}>Description</TableCell>
                    <TableCell sx={{ ...HEAD_SX, width: 60 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {captains.map((captain, idx) => (
                    <TableRow key={captain.captain_key} hover>
                      <EditableCell
                        canWrite={canWrite}
                        value={captain.name}
                        placeholder="Untitled captaincy"
                        sx={{ width: 220 }}
                        onCommit={(raw) => patchCaptain(idx, { name: raw })}
                      />
                      <EditableBrotherCell
                        canWrite={canWrite}
                        value={captain.brother_id ?? null}
                        brothers={brothers}
                        onCommit={(id) => patchCaptain(idx, { brother_id: id })}
                      />
                      <EditableCell
                        canWrite={canWrite}
                        value={captain.description ?? ""}
                        placeholder="No description"
                        multiline
                        onCommit={(raw) => patchCaptain(idx, { description: raw })}
                      />
                      <TableCell sx={{ ...CELL_SX, width: 60 }} align="right">
                        {canWrite && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setCaptains((prev) => prev.filter((_x, i) => i !== idx))}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {canWrite && (
              <Box sx={{ p: 2, pt: 1 }}>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() =>
                    setCaptains((prev) => [
                      ...prev,
                      {
                        captain_key: `captain_${Date.now()}`,
                        name: "",
                        description: "",
                        brother_id: null,
                        sort_order: (prev.length + 1) * 10,
                      },
                    ])
                  }
                >
                  Add captaincy
                </Button>
              </Box>
            )}
          </Paper>

          {canWrite && (
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Tooltip title="Replace the duties, bedroom order, schedule, and captains with the printed sheet">
                <Button variant="outlined" color="warning" onClick={() => handleSeed(true)} disabled={saving}>
                  Reset to printed schedule
                </Button>
              </Tooltip>
              <Button variant="outlined" onClick={load} disabled={saving}>
                Discard changes
              </Button>
              <Button variant="contained" onClick={handleSave} disabled={saving}>
                Save
              </Button>
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
