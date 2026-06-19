import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import StarIcon from "@mui/icons-material/Star";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useAuth } from "../context/authContext";
import { IRoomDrawLegacyAdjustment, IRoomDrawStanding } from "../interfaces/api.interface";
import {
    addLegacyAdjustment,
    deleteLegacyAdjustment,
    getLegacyAdjustments,
    getStandings,
} from "../services/roomDrawService";
import { getAllBrothers } from "../services/brotherService";
import { IBrother } from "../interfaces/api.interface";

function BreakdownRow({ label, value, color }: { label: string; value: number | string; color?: string }) {
    return (
        <Stack direction="row" justifyContent="space-between" sx={{ py: 0.25 }}>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Typography variant="body2" fontWeight={600} color={color}>{value}</Typography>
        </Stack>
    );
}

function StandingRow({
    standing,
    rank,
    canWrite,
    onManageLegacy,
}: {
    standing: IRoomDrawStanding;
    rank: number;
    canWrite: boolean;
    onManageLegacy: () => void;
}) {
    const [open, setOpen] = useState(false);
    const { breakdown } = standing;

    return (
        <>
            <TableRow
                sx={{
                    opacity: standing.points_stripped ? 0.45 : 1,
                    bgcolor: standing.bypasses_ranking ? "action.selected" : undefined,
                }}
            >
                <TableCell sx={{ width: 48, pr: 0 }}>
                    <IconButton size="small" onClick={() => setOpen((o) => !o)}>
                        {open ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                    </IconButton>
                </TableCell>
                <TableCell sx={{ width: 52, fontWeight: 700, color: "text.secondary" }}>
                    {standing.bypasses_ranking ? (
                        <Tooltip title="Chooses room first (executive office)">
                            <StarIcon fontSize="small" color="warning" />
                        </Tooltip>
                    ) : (
                        rank
                    )}
                </TableCell>
                <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Typography fontWeight={600}>
                            {standing.first_name} {standing.last_name}
                        </Typography>
                        {standing.over_graduation && (
                            <Tooltip title="Active past intended graduation — placed at bottom of rankings if rooms are full">
                                <WarningAmberIcon fontSize="small" color="warning" />
                            </Tooltip>
                        )}
                    </Stack>
                </TableCell>
                <TableCell align="right">
                    {standing.points_stripped ? (
                        <Chip label="Stripped" size="small" color="default" />
                    ) : (
                        <Typography fontWeight={700}>{standing.total.toFixed(2)}</Typography>
                    )}
                </TableCell>
                <TableCell align="right" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                    {standing.accumulation_end
                        ? new Date(standing.accumulation_end).toLocaleDateString("en-CA", { year: "numeric", month: "short" })
                        : "—"}
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell colSpan={5} sx={{ py: 0, borderBottom: open ? undefined : "none" }}>
                    <Collapse in={open} unmountOnExit>
                        <Box sx={{ py: 1.5, px: 2, maxWidth: 420 }}>
                            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
                                Point breakdown
                            </Typography>
                            <BreakdownRow label="Semesters as active brother" value={`+${breakdown.past_brother}`} />
                            <BreakdownRow label="Past office points" value={`+${breakdown.past_office}`} />
                            <BreakdownRow label="Incoming election points" value={`+${breakdown.incoming}`} />
                            <BreakdownRow label="Missed meetings" value={breakdown.meeting_deductions.toFixed(2)} color={breakdown.meeting_deductions < 0 ? "error.main" : undefined} />
                            <BreakdownRow label="Missed workdays" value={breakdown.workday_deductions.toFixed(2)} color={breakdown.workday_deductions < 0 ? "error.main" : undefined} />
                            <BreakdownRow label="Legacy adjustments" value={breakdown.legacy > 0 ? `+${breakdown.legacy}` : breakdown.legacy.toFixed(2)} color={breakdown.legacy < 0 ? "error.main" : breakdown.legacy > 0 ? "success.main" : undefined} />
                            {canWrite && (
                                <Button size="small" variant="text" sx={{ mt: 1, px: 0 }} onClick={onManageLegacy}>
                                    Manage legacy adjustments
                                </Button>
                            )}
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    );
}

export default function RoomDrawPage() {
    const { can } = useAuth();
    const canWrite = can("roomDraw.write");

    const [standings, setStandings] = useState<IRoomDrawStanding[]>([]);
    const [loading, setLoading] = useState(true);
    const [refresh, setRefresh] = useState(false);

    const [legacyDialogOpen, setLegacyDialogOpen] = useState(false);
    const [legacyFocusBrotherId, setLegacyFocusBrotherId] = useState<number | null>(null);

    useEffect(() => {
        setLoading(true);
        getStandings()
            .then(setStandings)
            .finally(() => setLoading(false));
    }, [refresh]);

    function openLegacyFor(brotherId: number) {
        setLegacyFocusBrotherId(brotherId);
        setLegacyDialogOpen(true);
    }

    function openLegacyGeneral() {
        setLegacyFocusBrotherId(null);
        setLegacyDialogOpen(true);
    }

    // Separate out bypasses from normal standings
    const bypasses = standings.filter((s) => s.bypasses_ranking);
    const normalStandings = standings.filter((s) => !s.bypasses_ranking);
    // non-over-grad first, then over-grad
    const regular = normalStandings.filter((s) => !s.over_graduation);
    const overGrad = normalStandings.filter((s) => s.over_graduation);

    let rankCounter = 0;
    function nextRank() {
        rankCounter++;
        return rankCounter;
    }

    return (
        <Stack spacing={2}>
            <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
                    <Box>
                        <Typography variant="h5">Room Draw Points</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Standings per Article XXII of the bylaws. Points accumulate over first 4 years in the fraternity.
                        </Typography>
                    </Box>
                    {canWrite && (
                        <Button variant="outlined" startIcon={<AddOutlinedIcon />} onClick={openLegacyGeneral}>
                            Legacy adjustments
                        </Button>
                    )}
                </Stack>
            </Paper>

            {bypasses.length > 0 && (
                <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "warning.main", bgcolor: "warning.50" }}>
                    <Typography variant="subtitle2" color="warning.dark" sx={{ mb: 0.5 }}>
                        First room selection — executive office (Alpha, Beta, Pi)
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {bypasses.map((s) => `${s.first_name} ${s.last_name}`).join(", ")} choose their rooms first, in order of Alpha → Beta → Pi, superseding the points system.
                    </Typography>
                </Paper>
            )}

            {loading ? (
                <CircularProgress />
            ) : standings.length === 0 ? (
                <Typography color="text.secondary">No brothers found.</Typography>
            ) : (
                <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: "action.hover" }}>
                                <TableCell sx={{ width: 48, pr: 0 }} />
                                <TableCell sx={{ width: 52, fontWeight: 700 }}>#</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Brother</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>Points</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>Active Until</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {[...bypasses, ...regular, ...overGrad].map((s) => (
                                <StandingRow
                                    key={s.brother_id}
                                    standing={s}
                                    rank={s.bypasses_ranking ? 0 : nextRank()}
                                    canWrite={canWrite}
                                    onManageLegacy={() => openLegacyFor(s.brother_id)}
                                />
                            ))}
                        </TableBody>
                    </Table>
                </Paper>
            )}

            {canWrite && legacyDialogOpen && (
                <LegacyDialog
                    open={legacyDialogOpen}
                    focusBrotherId={legacyFocusBrotherId}
                    onClose={() => setLegacyDialogOpen(false)}
                    onChanged={() => setRefresh((r) => !r)}
                />
            )}
        </Stack>
    );
}

function LegacyDialog({
    open,
    focusBrotherId,
    onClose,
    onChanged,
}: {
    open: boolean;
    focusBrotherId: number | null;
    onClose: () => void;
    onChanged: () => void;
}) {
    const [adjustments, setAdjustments] = useState<IRoomDrawLegacyAdjustment[]>([]);
    const [brothers, setBrothers] = useState<IBrother[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | undefined>();

    const [newBrotherId, setNewBrotherId] = useState<number | "">(focusBrotherId ?? "");
    const [newPoints, setNewPoints] = useState<string>("");
    const [newReason, setNewReason] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        setLoading(true);
        Promise.all([getLegacyAdjustments(), getAllBrothers()])
            .then(([adjs, bros]) => {
                setAdjustments(adjs);
                setBrothers(bros.filter((b) => b.status === "Active" || b.status === "Alumnus").sort((a, b) => a.first_name.localeCompare(b.first_name)));
            })
            .finally(() => setLoading(false));
    }, []);

    async function handleAdd() {
        if (!newBrotherId || newPoints === "" || !newReason.trim()) {
            setError("Brother, points, and reason are all required.");
            return;
        }
        setSubmitting(true);
        setError(undefined);
        const res = await addLegacyAdjustment({
            brother_id: Number(newBrotherId),
            points: Number(newPoints),
            reason: newReason.trim(),
        });
        setSubmitting(false);
        if (!res.ok) {
            setError(res.error?.message ?? "Could not add adjustment.");
            return;
        }
        setAdjustments((prev) => [...prev, res.data!]);
        setNewBrotherId(focusBrotherId ?? "");
        setNewPoints("");
        setNewReason("");
        onChanged();
    }

    async function handleDelete(id: number) {
        const res = await deleteLegacyAdjustment(id);
        if (!res.ok) { setError("Could not delete adjustment."); return; }
        setAdjustments((prev) => prev.filter((a) => a.id !== id));
        onChanged();
    }

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>Legacy Point Adjustments</DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                {loading ? (
                    <CircularProgress />
                ) : (
                    <Stack spacing={3}>
                        <Box>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>Add adjustment</Typography>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="flex-start">
                                <FormControl size="small" sx={{ minWidth: 200 }} required>
                                    <InputLabel>Brother</InputLabel>
                                    <Select
                                        label="Brother"
                                        value={newBrotherId}
                                        onChange={(e) => setNewBrotherId(e.target.value as number)}
                                    >
                                        {brothers.map((b) => (
                                            <MenuItem key={b.id} value={b.id!}>
                                                {b.first_name} {b.last_name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <TextField
                                    size="small"
                                    label="Points"
                                    type="number"
                                    value={newPoints}
                                    onChange={(e) => setNewPoints(e.target.value)}
                                    sx={{ width: 120 }}
                                    inputProps={{ step: "0.25" }}
                                    InputProps={{ startAdornment: <InputAdornment position="start">±</InputAdornment> }}
                                    required
                                />
                                <TextField
                                    size="small"
                                    label="Reason"
                                    value={newReason}
                                    onChange={(e) => setNewReason(e.target.value)}
                                    sx={{ flex: 1, minWidth: 200 }}
                                    placeholder="e.g. 2 missed meetings from Fall 2021"
                                    required
                                />
                                <Button
                                    variant="contained"
                                    startIcon={<AddOutlinedIcon />}
                                    onClick={handleAdd}
                                    disabled={submitting}
                                    sx={{ whiteSpace: "nowrap" }}
                                >
                                    Add
                                </Button>
                            </Stack>
                        </Box>

                        {adjustments.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">No legacy adjustments yet.</Typography>
                        ) : (
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700 }}>Brother</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Points</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Reason</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Added</TableCell>
                                        <TableCell />
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {adjustments.map((a) => (
                                        <TableRow key={a.id}>
                                            <TableCell>{a.first_name} {a.last_name}</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: a.points < 0 ? "error.main" : "success.main" }}>
                                                {a.points > 0 ? `+${a.points}` : a.points}
                                            </TableCell>
                                            <TableCell>{a.reason}</TableCell>
                                            <TableCell sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                                                {a.created_at ? new Date(a.created_at).toLocaleDateString() : ""}
                                            </TableCell>
                                            <TableCell>
                                                <Tooltip title="Delete">
                                                    <IconButton size="small" color="error" onClick={() => handleDelete(a.id!)}>
                                                        <DeleteOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
