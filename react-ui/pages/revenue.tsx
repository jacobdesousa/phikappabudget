import { useEffect, useMemo, useState } from "react";
import SchoolYearSelector from "../components/SchoolYearSelector";
import SchoolYearFilingSelect from "../components/SchoolYearFilingSelect";
import { getRevenueCategories } from "../services/revenueCategoryService";
import { IRevenue, IRevenueCategory, IRevenueSummary } from "../interfaces/api.interface";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { addRevenue, getRevenue, getRevenueSummary } from "../services/revenueService";
import { schoolYearLabel, schoolYearStartForDate } from "../utils/schoolYear";
import { formatMoney, normalizeMoneyInput, sanitizeMoneyInput } from "../utils/money";
import { matchesRevenueSearch } from "../utils/revenueSearch";
import RevenueTable from "../components/revenueTable/revenueTable";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import IconButton from "@mui/material/IconButton";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
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
    const [newCash, setNewCash] = useState<string>("0.00");
    const [newSquare, setNewSquare] = useState<string>("0.00");
    const [newEtransfer, setNewEtransfer] = useState<string>("0.00");
    const [newCheque, setNewCheque] = useState<string>("0.00");
    const [newDate, setNewDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
    const [newCategoryId, setNewCategoryId] = useState<number | "">("");
    // Opens on the year being viewed — you are filing against the year on
    // screen. From there it follows the date, until the user picks a year
    // themselves; their choice then sticks and the field warns about the
    // mismatch rather than being overwritten on the next date edit.
    const [newSchoolYear, setNewSchoolYear] = useState(schoolYearStartForDate(new Date()));
    const [schoolYearTouched, setSchoolYearTouched] = useState(false);

    const [error, setError] = useState<string | undefined>(undefined);
    const [search, setSearch] = useState("");

    const [selectedYear, setSelectedYear] = useState(schoolYearStartForDate(new Date()));
    const newTotal = useMemo(() => {
        const parts = [newCash, newSquare, newEtransfer, newCheque].map((v) => Number(v || 0));
        return parts.reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
    }, [newCash, newSquare, newEtransfer, newCheque]);

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

        Promise.all([getRevenue(selectedYear), getRevenueSummary(selectedYear)])
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
    }, [refresh, selectedYear]);

    useEffect(() => {
        if (!addDialogOpen) {
            setNewSchoolYear(selectedYear);
            setSchoolYearTouched(false);
        }
    }, [selectedYear, addDialogOpen]);

    async function handleCreateRevenue() {
        setError(undefined);
        const cash = Number(newCash);
        const square = Number(newSquare);
        const etransfer = Number(newEtransfer);
        const cheque = Number(newCheque);
        if (!newDescription || !newDate || !newCategoryId || Number.isNaN(cash) || Number.isNaN(square) || Number.isNaN(etransfer) || Number.isNaN(cheque)) {
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
            cheque_amount: cheque,
            amount: newTotal,
            school_year: newSchoolYear,
        });

        if (!res.ok) {
            setError(res.error?.message ?? "Could not add revenue entry.");
            return;
        }

        setAddDialogOpen(false);
        setNewDescription("");
        setNewCash("0.00");
        setNewSquare("0.00");
        setNewEtransfer("0.00");
        setNewCheque("0.00");
        setNewDate(new Date().toISOString().slice(0, 10));
        setNewCategoryId("");
        // Back to the viewed year, so the next entry doesn't inherit the last
        // one's override.
        setNewSchoolYear(selectedYear);
        setSchoolYearTouched(false);
        setRefresh(r => !r);
    }

    const visibleRevenue = revenue.filter((r) => matchesRevenueSearch(r, search));

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
                        <SchoolYearSelector value={selectedYear} onChange={setSelectedYear} />
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

                    {/* One thin strip rather than four cards: these are reference
                        figures, not the point of the page. Entry count lives on
                        the search bar, so it is not repeated here.

                        Total sits left as the headline; the two components it
                        breaks down into are pushed to the right edge, so the
                        strip spans the row instead of bunching at one end. */}
                    <Paper elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "divider" }}>
                        <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={{ xs: 1, sm: 2 }}
                            justifyContent="space-between"
                            alignItems={{ sm: "flex-start" }}
                        >
                            <Box>
                                <Typography variant="caption" color="text.secondary" display="block">
                                    Total revenue
                                </Typography>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                    ${formatMoney(summary?.total_revenue ?? 0)}
                                </Typography>
                            </Box>

                            <Stack
                                direction="row"
                                spacing={3}
                                divider={<Box sx={{ borderLeft: "1px solid", borderColor: "divider" }} />}
                            >
                                <Box sx={{ textAlign: { sm: "right" } }}>
                                    <Typography variant="caption" color="text.secondary" display="block">
                                        Dues
                                    </Typography>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                        ${formatMoney(summary?.dues_total ?? 0)}
                                    </Typography>
                                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.65rem" }}>
                                        Regular ${formatMoney(summary?.dues_regular_total ?? 0)} · Neophyte ${formatMoney(summary?.dues_neophyte_total ?? 0)}
                                    </Typography>
                                </Box>

                                <Box sx={{ textAlign: { sm: "right" } }}>
                                    <Typography variant="caption" color="text.secondary" display="block">
                                        Manual revenue
                                    </Typography>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                        ${formatMoney(summary?.manual_total ?? 0)}
                                    </Typography>
                                </Box>
                            </Stack>
                        </Stack>
                    </Paper>

                    <Paper elevation={0} sx={{ p: 1, border: "1px solid", borderColor: "divider" }}>
                        <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={1}
                            alignItems={{ md: "center" }}
                            justifyContent="space-between"
                        >
                            <TextField
                                size="small"
                                placeholder="Search description, category, amount…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                sx={{ minWidth: { md: 340 }, flex: { md: "0 1 420px" } }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon fontSize="small" />
                                        </InputAdornment>
                                    ),
                                    endAdornment: search ? (
                                        <InputAdornment position="end">
                                            <IconButton size="small" onClick={() => setSearch("")} aria-label="clear search">
                                                <ClearIcon fontSize="small" />
                                            </IconButton>
                                        </InputAdornment>
                                    ) : null,
                                }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                                {visibleRevenue.length} of {revenue.length} shown
                            </Typography>
                        </Stack>
                    </Paper>

                    {revenue.length === 0 ? (
                        <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
                            <Typography variant="body2" color="text.secondary">
                                No revenue entries for this year yet.
                            </Typography>
                        </Paper>
                    ) : (
                        <RevenueTable
                            data={visibleRevenue}
                            canWrite={canWrite}
                            onEdit={(r) => setEditing(r)}
                            onDelete={(r) => setDeleting(r)}
                        />
                    )}
                </>
            )}

            <Dialog open={addDialogOpen && canWrite} onClose={() => setAddDialogOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>Add Revenue</DialogTitle>
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
                                onChange={(e) => {
                                    setNewDate(e.target.value);
                                    if (!schoolYearTouched && e.target.value) {
                                        setNewSchoolYear(schoolYearStartForDate(e.target.value));
                                    }
                                }}
                                InputLabelProps={{ shrink: true }}
                                fullWidth
                                required
                            />
                        </Stack>
                        <SchoolYearFilingSelect
                            value={newSchoolYear}
                            onChange={(y) => { setNewSchoolYear(y); setSchoolYearTouched(true); }}
                            date={newDate}
                        />
                        <TextField
                            label="Cash"
                                                        value={newCash}
                            onChange={(e) => setNewCash(sanitizeMoneyInput(e.target.value))}
                            onBlur={() => setNewCash(normalizeMoneyInput(newCash))}
                            fullWidth
                            inputProps={{ inputMode: "decimal" }}
                            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                        />
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                            <TextField
                                label="Square"
                                                                value={newSquare}
                                onChange={(e) => setNewSquare(sanitizeMoneyInput(e.target.value))}
                                onBlur={() => setNewSquare(normalizeMoneyInput(newSquare))}
                                fullWidth
                                inputProps={{ inputMode: "decimal" }}
                                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                            />
                            <TextField
                                label="E-transfer"
                                                                value={newEtransfer}
                                onChange={(e) => setNewEtransfer(sanitizeMoneyInput(e.target.value))}
                                onBlur={() => setNewEtransfer(normalizeMoneyInput(newEtransfer))}
                                fullWidth
                                inputProps={{ inputMode: "decimal" }}
                                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                            />
                            <TextField
                                label="Cheque"
                                                                value={newCheque}
                                onChange={(e) => setNewCheque(sanitizeMoneyInput(e.target.value))}
                                onBlur={() => setNewCheque(normalizeMoneyInput(newCheque))}
                                fullWidth
                                inputProps={{ inputMode: "decimal" }}
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