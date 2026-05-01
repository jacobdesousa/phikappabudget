import { useEffect, useMemo, useState } from "react";
import { getRevenueCategories } from "../services/revenueCategoryService";
import { IRevenue, IRevenueCategory, IRevenueSummary } from "../interfaces/api.interface";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { addRevenue, getRevenue, getRevenueSummary } from "../services/revenueService";
import { schoolYearLabel, schoolYearStartForDate } from "../utils/schoolYear";
import { formatMoney, normalizeMoneyInput } from "../utils/money";
import IconButton from "@mui/material/IconButton";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditRevenueDialog from "../components/editRevenue/editRevenue";
import ConfirmDeleteRevenueDialog from "../components/confirmDeleteRevenue/confirmDeleteRevenue";
import { useAuth } from "../context/authContext";

export default function RevenuePage() {
    const { can } = useAuth();
    const canWrite = can("revenue.write");

    const [refresh, setRefresh] = useState(false);

    const [revenueCategories, setRevenueCategories] = useState(new Array<IRevenueCategory>);
    const [revenueCategoriesLoading, setRevenueCategoriesLoading] = useState(false);
    const [revenueLoading, setRevenueLoading] = useState(false);
    const [summaryLoading, setSummaryLoading] = useState(false);

    const [revenue, setRevenue] = useState<IRevenue[]>([]);
    const [summary, setSummary] = useState<IRevenueSummary | null>(null);

    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [editing, setEditing] = useState<IRevenue | null>(null);
    const [deleting, setDeleting] = useState<IRevenue | null>(null);

    const [newDescription, setNewDescription] = useState("");
    const [newCash, setNewCash] = useState<string>("0");
    const [newSquare, setNewSquare] = useState<string>("0");
    const [newEtransfer, setNewEtransfer] = useState<string>("0");
    const [newDate, setNewDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
    const [newCategoryId, setNewCategoryId] = useState<number | "">("");

    const [error, setError] = useState<string | undefined>(undefined);

    const currentYear = useMemo(() => schoolYearStartForDate(new Date()), []);
    const newTotal = useMemo(() => {
        const c = Number(newCash || 0);
        const s = Number(newSquare || 0);
        const e = Number(newEtransfer || 0);
        return (Number.isFinite(c) ? c : 0) + (Number.isFinite(s) ? s : 0) + (Number.isFinite(e) ? e : 0);
    }, [newCash, newSquare, newEtransfer]);

    useEffect(() => {
        setRevenueCategoriesLoading(true);
        getRevenueCategories()
            .then(response => {
                let temp: Array<IRevenueCategory> = [];
                response.forEach(row => temp.push(row));
                setRevenueCategories(temp);
            }).finally(() => setRevenueCategoriesLoading(false))
    }, [refresh]);

    useEffect(() => {
        setRevenueLoading(true);
        setSummaryLoading(true);
        setError(undefined);

        Promise.all([getRevenue(), getRevenueSummary()])
            .then(([rev, sum]) => {
                setRevenue(rev);
                setSummary(sum);
            })
            .catch(() => {
                setRevenue([]);
                setSummary(null);
            })
            .finally(() => {
                setRevenueLoading(false);
                setSummaryLoading(false);
            });
    }, [refresh]);

    async function handleCreateRevenue() {
        setError(undefined);
        const cash = Number(newCash);
        const square = Number(newSquare);
        const etransfer = Number(newEtransfer);
        if (!newDescription || !newDate || !newCategoryId || Number.isNaN(cash) || Number.isNaN(square) || Number.isNaN(etransfer)) {
            setError("Please fill out description, category, date, and valid amounts.");
            return;
        }

        const res = await addRevenue({
            date: newDate,
            description: newDescription,
            category_id: Number(newCategoryId),
            cash_amount: cash,
            square_amount: square,
            etransfer_amount: etransfer,
            amount: newTotal,
        });

        if (!res.ok) {
            setError(res.error?.message ?? "Could not add revenue entry.");
            return;
        }

        setAddDialogOpen(false);
        setNewDescription("");
        setNewCash("0");
        setNewSquare("0");
        setNewEtransfer("0");
        setNewDate(new Date().toISOString().slice(0, 10));
        setNewCategoryId("");
        setRefresh(r => !r);
    }

    return (
        <Stack spacing={2}>
            <Paper elevation={0} sx={{p: 2, border: "1px solid", borderColor: "divider"}}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
                    <Box>
                        <Typography variant="h5">Revenue</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Record revenue entries. Totals include dues payments.
                        </Typography>
                    </Box>

                    <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                            School year: <b>{schoolYearLabel(currentYear)}</b>
                        </Typography>
                        {canWrite ? (
                          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setAddDialogOpen(true)}>
                              Add revenue
                          </Button>
                        ) : null}
                    </Stack>
                </Stack>
            </Paper>

            {(revenueCategoriesLoading || revenueLoading || summaryLoading) ? (
                <CircularProgress />
            ) : (
                <>
                    {error && <Alert severity="error">{error}</Alert>}

                    <Box sx={{ width: "100%", maxWidth: 1200, mx: "auto" }}>
                    <Grid container spacing={2} alignItems="stretch">
                        <Grid item xs={12} md={3} sx={{ display: "flex" }}>
                            <Card variant="outlined" sx={{ height: "100%", width: "100%" }}>
                                <CardContent sx={{ height: "100%", minHeight: 104, display: "flex", flexDirection: "column" }}>
                                    <Typography variant="overline" color="text.secondary">Total revenue</Typography>
                                    <Typography variant="h5">
                                        ${formatMoney(summary?.total_revenue ?? 0)}
                                    </Typography>
                                    <Typography variant="caption" sx={{ visibility: "hidden" }}>
                                        spacer
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={3} sx={{ display: "flex" }}>
                            <Card variant="outlined" sx={{ height: "100%", width: "100%" }}>
                                <CardContent sx={{ height: "100%", minHeight: 104, display: "flex", flexDirection: "column" }}>
                                    <Typography variant="overline" color="text.secondary">Dues (total)</Typography>
                                    <Typography variant="h5">
                                        ${formatMoney(summary?.dues_total ?? 0)}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        noWrap
                                        title={`Active: $${formatMoney(summary?.dues_regular_total ?? 0)} • Neophyte: $${formatMoney(summary?.dues_neophyte_total ?? 0)}`}
                                    >
                                        Regular: ${formatMoney(summary?.dues_regular_total ?? 0)} • Neophyte: ${formatMoney(summary?.dues_neophyte_total ?? 0)}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={3} sx={{ display: "flex" }}>
                            <Card variant="outlined" sx={{ height: "100%", width: "100%" }}>
                                <CardContent sx={{ height: "100%", minHeight: 104, display: "flex", flexDirection: "column" }}>
                                    <Typography variant="overline" color="text.secondary">Manual revenue</Typography>
                                    <Typography variant="h5">
                                        ${formatMoney(summary?.manual_total ?? 0)}
                                    </Typography>
                                    <Typography variant="caption" sx={{ visibility: "hidden" }}>
                                        spacer
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={3} sx={{ display: "flex" }}>
                            <Card variant="outlined" sx={{ height: "100%", width: "100%" }}>
                                <CardContent sx={{ height: "100%", minHeight: 104, display: "flex", flexDirection: "column" }}>
                                    <Typography variant="overline" color="text.secondary">Entries</Typography>
                                    <Typography variant="h5">
                                        {revenue.length}
                                    </Typography>
                                    <Typography variant="caption" sx={{ visibility: "hidden" }}>
                                        spacer
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                    </Box>

                    <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
                        <Typography variant="h6" sx={{ mb: 1 }}>Revenue entries</Typography>

                        {revenue.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">No revenue entries for this year yet.</Typography>
                        ) : (
                            <Stack spacing={1}>
                                {revenue.map(r => (
                                    <Paper
                                        key={r.id ?? `${r.description}-${r.date}-${r.amount}`}
                                        variant="outlined"
                                        sx={{ p: 1.5 }}
                                    >
                                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
                                            <Box sx={{ flex: 1 }}>
                                                <Typography sx={{ fontWeight: 600 }}>{r.description}</Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {(r.category_name ?? "Uncategorized")} • {new Date(r.date).toDateString()}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Cash: ${formatMoney(r.cash_amount ?? 0)} • Square: ${formatMoney(r.square_amount ?? 0)} • E-transfer: ${formatMoney(r.etransfer_amount ?? 0)}
                                                </Typography>
                                            </Box>
                                            <Stack
                                                spacing={0.5}
                                                alignItems="flex-end"
                                                sx={{ minWidth: { sm: 160 } }}
                                            >
                                                <Stack direction="row" spacing={0.5}>
                                                    {canWrite ? (
                                                      <>
                                                        <Tooltip title="Edit">
                                                          <span>
                                                            <IconButton size="small" onClick={() => setEditing(r)} disabled={!r.id}>
                                                              <EditOutlinedIcon fontSize="small" />
                                                            </IconButton>
                                                          </span>
                                                        </Tooltip>
                                                        <Tooltip title="Delete">
                                                          <span>
                                                            <IconButton size="small" color="error" onClick={() => setDeleting(r)} disabled={!r.id}>
                                                              <DeleteOutlineIcon fontSize="small" />
                                                            </IconButton>
                                                          </span>
                                                        </Tooltip>
                                                      </>
                                                    ) : null}
                                                </Stack>
                                                <Typography sx={{ fontWeight: 700 }}>
                                                    ${formatMoney(r.amount ?? 0)}
                                                </Typography>
                                            </Stack>
                                        </Stack>
                                    </Paper>
                                ))}
                            </Stack>
                        )}
                    </Paper>
                </>
            )}

            <Dialog open={addDialogOpen && canWrite} onClose={() => setAddDialogOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>Add revenue</DialogTitle>
                <DialogContent dividers>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    <Stack spacing={2}>
                        <TextField
                            label="Description"
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            fullWidth
                            required
                        />
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                            <FormControl fullWidth required>
                                <InputLabel id="rev-cat-label">Category</InputLabel>
                                <Select
                                    labelId="rev-cat-label"
                                    label="Category"
                                    value={newCategoryId}
                                    onChange={(e) => setNewCategoryId(e.target.value as any)}
                                >
                                    {revenueCategories.map(c => (
                                        <MenuItem key={c.id ?? c.name} value={c.id ?? ""}>{c.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <TextField
                                label="Date"
                                type="date"
                                value={newDate}
                                onChange={(e) => setNewDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                fullWidth
                                required
                            />
                        </Stack>
                            <TextField
                            label="Cash"
                            type="number"
                            value={newCash}
                                onChange={(e) => setNewCash(e.target.value)}
                                onBlur={() => setNewCash(normalizeMoneyInput(newCash))}
                            fullWidth
                                inputProps={{ step: "0.01" }}
                            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                        />
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                            <TextField
                                label="Square"
                                type="number"
                                value={newSquare}
                                onChange={(e) => setNewSquare(e.target.value)}
                                onBlur={() => setNewSquare(normalizeMoneyInput(newSquare))}
                                fullWidth
                                inputProps={{ step: "0.01" }}
                                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                            />
                            <TextField
                                label="E-transfer"
                                type="number"
                                value={newEtransfer}
                                onChange={(e) => setNewEtransfer(e.target.value)}
                                onBlur={() => setNewEtransfer(normalizeMoneyInput(newEtransfer))}
                                fullWidth
                                inputProps={{ step: "0.01" }}
                                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                            />
                        </Stack>
                        <TextField
                            label="Total"
                            value={newTotal.toFixed(2)}
                            fullWidth
                            disabled
                            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button variant="outlined" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={handleCreateRevenue}>Add</Button>
                </DialogActions>
            </Dialog>

            {canWrite && editing && (
                <EditRevenueDialog
                    revenue={editing}
                    categories={revenueCategories}
                    onClose={() => setEditing(null)}
                    onUpdated={() => setRefresh(r => !r)}
                />
            )}

            {canWrite && deleting && (
                <ConfirmDeleteRevenueDialog
                    revenue={deleting}
                    onClose={() => setDeleting(null)}
                    onDeleted={() => setRefresh(r => !r)}
                />
            )}
        </Stack>
    )

}