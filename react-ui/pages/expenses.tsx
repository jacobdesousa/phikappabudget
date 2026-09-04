import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
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
import IconButton from "@mui/material/IconButton";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useAuth } from "../context/authContext";

import { IExpense, IExpenseCategory, IBrother } from "../interfaces/api.interface";
import { getExpenseCategories } from "../services/expenseCategoryService";
import { addExpense, addExpenseWithReceipt, getExpenses, updateExpense, uploadExpenseReceipt } from "../services/expensesService";
import { getAllBrothers } from "../services/brotherService";
import { schoolYearStartForDate } from "../utils/schoolYear";
import SchoolYearSelector from "../components/SchoolYearSelector";
import ConfirmDeleteExpenseDialog from "../components/confirmDeleteExpense/confirmDeleteExpense";
import ExpenseTable from "../components/expenseTable/expenseTable";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import { formatMoney, normalizeMoneyInput, roundMoney, sanitizeMoneyInput } from "../utils/money";
import { openAuthenticatedFile } from "../utils/openFile";
import { toDateInputValue } from "../utils/date";
import { approveExpense, disburseExpenses, rejectExpense } from "../services/expenseWorkflowService";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export default function ExpensesPage() {
  const { can } = useAuth();
  const canWrite = can("expenses.write");
  const canReview = can("expenses.review");
  const canDisburse = can("expenses.disburse");
  const [refresh, setRefresh] = useState(false);
  const [selectedYear, setSelectedYear] = useState(schoolYearStartForDate(new Date()));
  const [copiedSubmitLink, setCopiedSubmitLink] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const submitLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/expense-submit`;
  }, []);

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<IExpenseCategory[]>([]);
  const [brothers, setBrothers] = useState<IBrother[]>([]);
  const [expenses, setExpenses] = useState<IExpense[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<IExpense | null>(null);
  const [deleting, setDeleting] = useState<IExpense | null>(null);
  const [reviewing, setReviewing] = useState<IExpense | null>(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [disburseCheque, setDisburseCheque] = useState<string>("");
  const [selectedDisburseIds, setSelectedDisburseIds] = useState<Record<number, boolean>>({});

  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState<string>("0.00");
  // The edit and review dialogs keep `amount` as a number on the expense
  // object, which can't hold "12." while it is being typed. These mirror the
  // field as text; the number is written back on each keystroke.
  const [editAmountText, setEditAmountText] = useState<string>("");
  const [reviewAmountText, setReviewAmountText] = useState<string>("");
  const [newDate, setNewDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [newCategoryId, setNewCategoryId] = useState<number | "">("");
  const [newBrotherId, setNewBrotherId] = useState<number | "">("");
  const [newCheque, setNewCheque] = useState<string>("");
  // Spend that will never have a cheque: a direct debit, a card charge, a
  // correction. Nearly every expense is a cheque, so this stays off by default
  // and only hides the disbursement fields when it is ticked.
  const [newRecorded, setNewRecorded] = useState(false);
  const [newReceipt, setNewReceipt] = useState<File | null>(null);
  const [editReceipt, setEditReceipt] = useState<File | null>(null);

  // Filters for approved expense list
  const [searchText, setSearchText] = useState<string>("");
  const [filterCategoryId, setFilterCategoryId] = useState<number | "">("");
  const [filterBrotherId, setFilterBrotherId] = useState<number | "">("");
  const [filterChequeNumber, setFilterChequeNumber] = useState<string>("");

  const approvedExpenses = useMemo(
    () =>
      expenses.filter(
        (e) =>
          e.status === undefined ||
          e.status === null ||
          e.status === "approved" ||
          e.status === "paid" ||
          e.status === "recorded"
      ),
    [expenses]
  );

  // Stable identities so the memoised ExpenseTable is not re-rendered by every
  // keystroke in the Add/Edit dialogs, which share this component's state.
  const handleEditExpense = useCallback((e: IExpense) => setEditing(e), []);
  const handleDeleteExpense = useCallback((e: IExpense) => setDeleting(e), []);
  const handleOpenReceipt = useCallback(
    (e: IExpense) => openAuthenticatedFile(`${apiBase}${e.receipt_url}`),
    []
  );

  useEffect(() => {
    setEditAmountText(editing ? normalizeMoneyInput(String(editing.amount ?? 0)) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);

  useEffect(() => {
    setReviewAmountText(reviewing ? normalizeMoneyInput(String(reviewing.amount ?? 0)) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewing?.id]);

  const totalExpensesApproved = useMemo(
    () => approvedExpenses.reduce((acc, e) => acc + Number(e.amount ?? 0), 0),
    [approvedExpenses]
  );

  const filteredApprovedExpenses = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const chequeQ = filterChequeNumber.trim().toLowerCase();

    return approvedExpenses.filter((e) => {
      if (filterCategoryId && Number(e.category_id) !== Number(filterCategoryId)) return false;
      if (filterBrotherId && Number(e.reimburse_brother_id ?? 0) !== Number(filterBrotherId)) return false;
      if (chequeQ) {
        const cn = String(e.cheque_number ?? "").toLowerCase();
        if (!cn.includes(chequeQ)) return false;
      }

      if (!q) return true;
      const hay = [
        e.description,
        e.category_name,
        e.cheque_number,
        e.reimburse_first_name,
        e.reimburse_last_name,
        e.submitted_by_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [approvedExpenses, searchText, filterCategoryId, filterBrotherId, filterChequeNumber]);

  const filteredApprovedTotal = useMemo(
    () => filteredApprovedExpenses.reduce((acc, e) => acc + Number(e.amount ?? 0), 0),
    [filteredApprovedExpenses]
  );

  const pendingSubmissions = useMemo(
    () => expenses.filter((e) => e.status === "submitted"),
    [expenses]
  );

  const outstandingForDisbursement = useMemo(
    () =>
      expenses.filter(
        (e) => e.status === "approved" && (!e.cheque_number || String(e.cheque_number).trim() === "")
      ),
    [expenses]
  );

  const selectedOutstanding = useMemo(() => {
    const hasSelection = Object.keys(selectedDisburseIds).length > 0;
    const base = outstandingForDisbursement.filter((e) => !!e.id);
    if (!hasSelection) return base;
    return base.filter((e) => !!e.id && !!selectedDisburseIds[e.id!]);
  }, [outstandingForDisbursement, selectedDisburseIds]);

  const disburseTotal = useMemo(
    () => selectedOutstanding.reduce((acc, e) => acc + Number(e.amount ?? 0), 0),
    [selectedOutstanding]
  );

  const disburseByBrother = useMemo(() => {
    const m = new Map<number, { brother_id: number; name: string; total: number; count: number }>();
    for (const e of selectedOutstanding) {
      const bid = e.reimburse_brother_id ? Number(e.reimburse_brother_id) : 0;
      if (!bid) continue;
      const name =
        e.reimburse_first_name && e.reimburse_last_name
          ? `${e.reimburse_first_name} ${e.reimburse_last_name}`
          : `Brother #${bid}`;
      const prev = m.get(bid) ?? { brother_id: bid, name, total: 0, count: 0 };
      prev.total += Number(e.amount ?? 0);
      prev.count += 1;
      m.set(bid, prev);
    }
    return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedOutstanding]);

  useEffect(() => {
    setLoading(true);
    setError(undefined);
    Promise.all([getExpenseCategories(), getAllBrothers(), getExpenses(selectedYear)])
      .then(([cats, bros, rows]) => {
        setCategories(cats);
        setBrothers(bros);
        setExpenses(rows);
      })
      .catch(() => {
        setCategories([]);
        setBrothers([]);
        setExpenses([]);
      })
      .finally(() => setLoading(false));
  }, [refresh, selectedYear]);

  async function handleCreate() {
    setError(undefined);
    const amount = Number(newAmount);
    if (!newDescription || !newDate || !newCategoryId || Number.isNaN(amount)) {
      setError("Please fill out description, category, date, and a valid amount.");
      return;
    }

    const res = newReceipt
      ? await addExpenseWithReceipt({
          date: newDate,
          description: newDescription,
          category_id: Number(newCategoryId),
          amount,
          reimburse_brother_id: newRecorded || !newBrotherId ? null : Number(newBrotherId),
          cheque_number: newRecorded ? null : newCheque || null,
          status: newRecorded ? "recorded" : undefined,
          receipt: newReceipt,
        })
      : await addExpense({
          date: newDate,
          description: newDescription,
          category_id: Number(newCategoryId),
          amount,
          reimburse_brother_id: newRecorded || !newBrotherId ? null : Number(newBrotherId),
          cheque_number: newRecorded ? null : newCheque || null,
          status: newRecorded ? "recorded" : undefined,
        } as IExpense);

    if (!res.ok) {
      setError(res.error?.message ?? "Could not add expense.");
      return;
    }

    setAddOpen(false);
    setNewDescription("");
    setNewAmount("0.00");
    setNewDate(new Date().toISOString().slice(0, 10));
    setNewCategoryId("");
    setNewBrotherId("");
    setNewCheque("");
    setNewRecorded(false);
    setNewReceipt(null);
    setRefresh((r) => !r);
  }

  async function handleSaveEdit() {
    if (!editing?.id) return;
    setError(undefined);
    const amount = Number(String(editing.amount ?? 0));
    if (!editing.description || !editing.date || !editing.category_id || Number.isNaN(amount)) {
      setError("Please fill out description, category, date, and a valid amount.");
      return;
    }
    const res = await updateExpense(editing.id, {
      date: editing.date,
      description: editing.description,
      category_id: editing.category_id,
      amount,
      reimburse_brother_id: editing.reimburse_brother_id ?? null,
      cheque_number: editing.cheque_number ?? null,
      // Only ever moves an entry between "awaiting a cheque" and "recorded";
      // a disbursed expense keeps whatever status the cheque run gave it.
      status:
        editing.status === "recorded" || editing.status === "approved"
          ? editing.status
          : undefined,
    });
    if (!res.ok) {
      setError(res.error?.message ?? "Could not update expense.");
      return;
    }

    if (editReceipt) {
      const up = await uploadExpenseReceipt(editing.id, editReceipt);
      if (!up.ok) {
        setError(up.error?.message ?? "Saved expense, but could not upload receipt.");
        return;
      }
    }
    setEditing(null);
    setEditReceipt(null);
    setRefresh((r) => !r);
  }

  async function handleDelete() {
    setRefresh((r) => !r);
  }

  async function handleApproveReviewed() {
    if (!reviewing?.id) return;
    setError(undefined);
    if (!reviewing.reimburse_brother_id) {
      setError("Select a brother to reimburse before approving.");
      return;
    }
    // A half-typed date leaves the input empty, and an empty date would be
    // filed against a nonsense school year.
    if (!reviewing.date) {
      setError("Enter a valid date before approving.");
      return;
    }
    setReviewSaving(true);
    const saveRes = await updateExpense(reviewing.id, {
      date: reviewing.date,
      description: reviewing.description,
      category_id: reviewing.category_id,
      amount: Number(reviewing.amount ?? 0),
      reimburse_brother_id: reviewing.reimburse_brother_id ?? null,
      cheque_number: reviewing.cheque_number ?? null,
    });
    if (!saveRes.ok) {
      setReviewSaving(false);
      setError(saveRes.error?.message ?? "Could not save changes.");
      return;
    }
    const approveRes = await approveExpense(reviewing.id);
    setReviewSaving(false);
    if (!approveRes.ok) {
      setError(approveRes.error?.message ?? "Could not approve expense.");
      return;
    }
    setReviewing(null);
    setRefresh((r) => !r);
  }

  async function handleRejectReviewed() {
    if (!reviewing?.id) return;
    setError(undefined);
    setReviewSaving(true);
    const res = await rejectExpense(reviewing.id);
    setReviewSaving(false);
    if (!res.ok) {
      setError(res.error?.message ?? "Could not reject expense.");
      return;
    }
    setReviewing(null);
    setRefresh((r) => !r);
  }

  async function handleDisburseSelected() {
    setError(undefined);
    const cheque = disburseCheque.trim();
    if (!cheque) {
      setError("Enter a cheque number before disbursing.");
      return;
    }
    const ids = selectedOutstanding.map((e) => e.id!).filter(Boolean);
    if (ids.length === 0) {
      setError("Select at least one expense to disburse.");
      return;
    }
    const res = await disburseExpenses(cheque, ids);
    if (!res.ok) {
      setError(res.error?.message ?? "Could not disburse expenses.");
      return;
    }
    setDisburseCheque("");
    setSelectedDisburseIds({});
    setRefresh((r) => !r);
  }

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ sm: "center" }}
          justifyContent="space-between"
        >
          <Box>
            <Typography variant="h5">Expenses</Typography>
            <Typography variant="body2" color="text.secondary">
              Track chapter expenses, categories, and reimbursements.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <SchoolYearSelector value={selectedYear} onChange={setSelectedYear} />
            {canReview ? (
              <Button variant="outlined" onClick={() => setShareOpen(true)}>
                Share submit link
              </Button>
            ) : null}
            {canWrite ? (
              <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setAddOpen(true)}>
                Add expense
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Paper>

      <Dialog open={shareOpen} onClose={() => setShareOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Share expense submission link</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Send this link to brothers so they can submit a receipt for review.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
            <TextField
              value={submitLink}
              fullWidth
              size="small"
              inputProps={{ readOnly: true }}
              placeholder="/expense-submit"
            />
            <Button
              variant="contained"
              sx={{ minWidth: 120 }}
              onClick={async () => {
                setCopiedSubmitLink(false);
                const text = submitLink || "/expense-submit";
                try {
                  await navigator.clipboard.writeText(text);
                  setCopiedSubmitLink(true);
                  setTimeout(() => setCopiedSubmitLink(false), 1500);
                } catch {
                  try {
                    const el = document.createElement("textarea");
                    el.value = text;
                    document.body.appendChild(el);
                    el.select();
                    document.execCommand("copy");
                    document.body.removeChild(el);
                    setCopiedSubmitLink(true);
                    setTimeout(() => setCopiedSubmitLink(false), 1500);
                  } catch {
                    setError("Could not copy link automatically. Please copy it manually.");
                  }
                }
              }}
            >
              {copiedSubmitLink ? "Copied" : "Copy"}
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setShareOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {loading ? (
        <CircularProgress />
      ) : (
        <>
          {error && <Alert severity="error">{error}</Alert>}

          {canReview ? (
            <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
                <Box>
                  <Typography variant="h6">Review queue</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Submitted expenses awaiting Tau review and approval.
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Pending: <b>{pendingSubmissions.length}</b>
                </Typography>
              </Stack>

              {pendingSubmissions.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  No submissions waiting for review.
                </Typography>
              ) : (
                <Stack spacing={1} sx={{ mt: 2 }}>
                  {pendingSubmissions.map((e) => (
                    <Paper key={e.id ?? `${e.description}-${e.date}-${e.amount}`} variant="outlined" sx={{ p: 1.25 }}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontWeight: 600 }}>{e.description}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {e.submitted_by_name ? `Submitted by: ${e.submitted_by_name} • ` : ""}
                            {(e.category_name ?? "Uncategorized")} • {new Date(e.date).toDateString()}
                          </Typography>
                          {e.receipt_url && (
                            <Typography variant="body2" color="text.secondary">
                              Receipt:{" "}
                              <a style={{ cursor: "pointer" }} onClick={() => openAuthenticatedFile(`${apiBase}${e.receipt_url}`)}>
                                open
                              </a>
                            </Typography>
                          )}
                        </Box>
                        <Stack spacing={0.5} alignItems="flex-end" sx={{ minWidth: { sm: 160 } }}>
                          <Button variant="outlined" size="small" onClick={() => setReviewing(e)} disabled={!e.id}>
                            Review
                          </Button>
                          <Typography sx={{ fontWeight: 700 }}>${formatMoney(e.amount ?? 0)}</Typography>
                        </Stack>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Paper>
          ) : null}

          {canDisburse ? (
          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h6">Disbursement</Typography>
            <Typography variant="body2" color="text.secondary">
              Approved expenses with no cheque number. Select a batch and assign one cheque number.
            </Typography>

            {outstandingForDisbursement.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                No outstanding approved expenses.
              </Typography>
            ) : (
              <>
                <Divider sx={{ my: 2 }} />
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
                  <TextField
                    label="Cheque number"
                    value={disburseCheque}
                    onChange={(e) => setDisburseCheque(e.target.value)}
                    sx={{ minWidth: 220 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    Selected total: <b>${formatMoney(disburseTotal)}</b> • Selected: <b>{selectedOutstanding.length}</b>
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <Button variant="contained" onClick={handleDisburseSelected}>
                    Disburse selected
                  </Button>
                </Stack>

                <Stack spacing={1} sx={{ mt: 2 }}>
                  {outstandingForDisbursement.map((e) => (
                    <Paper key={e.id ?? `${e.description}-${e.date}-${e.amount}`} variant="outlined" sx={{ p: 1.25 }}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={
                                Object.keys(selectedDisburseIds).length === 0
                                  ? true
                                  : !!(e.id && selectedDisburseIds[e.id])
                              }
                              onChange={(ev) => {
                                if (!e.id) return;
                                setSelectedDisburseIds((prev) => ({ ...prev, [e.id!]: ev.target.checked }));
                              }}
                            />
                          }
                          label={
                            <Box>
                              <Typography sx={{ fontWeight: 600 }}>{e.description}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {(e.category_name ?? "Uncategorized")} • {new Date(e.date).toDateString()} • Reimburse:{" "}
                                {e.reimburse_first_name && e.reimburse_last_name
                                  ? `${e.reimburse_first_name} ${e.reimburse_last_name}`
                                  : e.reimburse_brother_id
                                    ? `Brother #${e.reimburse_brother_id}`
                                    : "—"}
                              </Typography>
                              {e.receipt_url && (
                                <Typography variant="body2" color="text.secondary">
                                  Receipt:{" "}
                                  <a style={{ cursor: "pointer" }} onClick={() => openAuthenticatedFile(`${apiBase}${e.receipt_url}`)}>
                                    open
                                  </a>
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        <Typography sx={{ fontWeight: 700 }}>${formatMoney(e.amount ?? 0)}</Typography>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>

                {disburseByBrother.length > 0 && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                      Per-person totals (selected)
                    </Typography>
                    <Stack spacing={0.75}>
                      {disburseByBrother.map((b) => (
                        <Stack key={b.brother_id} direction="row" justifyContent="space-between">
                          <Typography>{b.name}</Typography>
                          <Typography sx={{ fontWeight: 700 }}>${formatMoney(b.total)}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </>
                )}
              </>
            )}
          </Paper>
          ) : null}

          {/* One thin strip rather than cards: reference figures, not the point
              of the page. Counts live on the filter bar, so they are not
              repeated here. */}
          <Paper elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "divider" }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={{ xs: 1, sm: 2 }}
              justifyContent="space-between"
              alignItems={{ sm: "flex-start" }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Total expenses (approved)
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  ${formatMoney(totalExpensesApproved)}
                </Typography>
              </Box>

              <Box sx={{ textAlign: { sm: "right" } }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Filtered total
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  ${formatMoney(filteredApprovedTotal)}
                </Typography>
              </Box>
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: 1, border: "1px solid", borderColor: "divider" }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              alignItems={{ md: "center" }}
              justifyContent="space-between"
            >
              <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                <TextField
                  size="small"
                  placeholder="Search description, category, person…"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  sx={{ minWidth: { md: 260 }, flex: { md: "0 1 320px" } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                    endAdornment: searchText ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setSearchText("")} aria-label="clear search">
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  }}
                />
                <TextField
                  select
                  size="small"
                  label="Category"
                  value={filterCategoryId}
                  onChange={(e) => setFilterCategoryId(e.target.value as any)}
                  sx={{ minWidth: { md: 150 } }}
                >
                  <MenuItem value=""><em>All</em></MenuItem>
                  {categories.map((c) => (
                    <MenuItem key={c.id ?? c.name} value={c.id ?? ""}>{c.name}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Person"
                  value={filterBrotherId}
                  onChange={(e) => setFilterBrotherId(e.target.value as any)}
                  sx={{ minWidth: { md: 150 } }}
                >
                  <MenuItem value=""><em>All</em></MenuItem>
                  {brothers.map((b) => (
                    <MenuItem key={b.id ?? `${b.first_name}-${b.last_name}`} value={b.id ?? ""}>
                      {b.first_name} {b.last_name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  label="Cheque #"
                  value={filterChequeNumber}
                  onChange={(e) => setFilterChequeNumber(e.target.value)}
                  sx={{ minWidth: { md: 110 } }}
                />
                {(searchText || filterCategoryId !== "" || filterBrotherId !== "" || filterChequeNumber) && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setSearchText("");
                      setFilterCategoryId("");
                      setFilterBrotherId("");
                      setFilterChequeNumber("");
                    }}
                  >
                    Clear
                  </Button>
                )}
              </Stack>

              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                {filteredApprovedExpenses.length} of {approvedExpenses.length} shown
              </Typography>
            </Stack>
          </Paper>

          {approvedExpenses.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                No expenses for this year yet.
              </Typography>
            </Paper>
          ) : (
            <ExpenseTable
              data={filteredApprovedExpenses}
              canWrite={canWrite}
              onEdit={handleEditExpense}
              onDelete={handleDeleteExpense}
              onOpenReceipt={handleOpenReceipt}
            />
          )}

        </>
      )}

      {/* Add */}
      <Dialog open={addOpen && canWrite} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Expense</DialogTitle>
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
                <InputLabel id="exp-cat-label">Category</InputLabel>
                <Select
                  labelId="exp-cat-label"
                  label="Category"
                  value={newCategoryId}
                  onChange={(e) => setNewCategoryId(e.target.value as any)}
                >
                  {categories.map((c) => (
                    <MenuItem key={c.id ?? c.name} value={c.id ?? ""}>
                      {c.name}
                    </MenuItem>
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
              label="Amount"
              value={newAmount}
              onChange={(e) => setNewAmount(sanitizeMoneyInput(e.target.value))}
              onBlur={() => setNewAmount(normalizeMoneyInput(newAmount))}
              fullWidth
              required
              inputProps={{ inputMode: "decimal" }}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={newRecorded}
                  onChange={(e) => setNewRecorded(e.target.checked)}
                />
              }
              label="No disbursement needed"
            />
            {newRecorded ? (
              <Alert severity="info">
                Recorded against the budget with no cheque and nobody to reimburse — for
                direct debits, card charges and corrections.
              </Alert>
            ) : (
              <>
                <FormControl fullWidth>
                  <InputLabel id="exp-bro-label">Brother to reimburse</InputLabel>
                  <Select
                    labelId="exp-bro-label"
                    label="Brother to reimburse"
                    value={newBrotherId}
                    onChange={(e) => setNewBrotherId(e.target.value as any)}
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {brothers.map((b) => (
                      <MenuItem key={b.id ?? `${b.first_name}-${b.last_name}`} value={b.id ?? ""}>
                        {b.first_name} {b.last_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Cheque number"
                  value={newCheque}
                  onChange={(e) => setNewCheque(e.target.value)}
                  fullWidth
                  placeholder="e.g. 1042"
                />
              </>
            )}

            <Button variant="outlined" component="label">
              {newReceipt ? `Receipt selected: ${newReceipt.name}` : "Attach receipt (optional)"}
              <input
                type="file"
                hidden
                accept="application/pdf,image/*"
                onChange={(e) => setNewReceipt(e.target.files?.[0] ?? null)}
              />
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setAddOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={handleCreate}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editing && canWrite} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Expense</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {editing && (
            <Stack spacing={2}>
              <TextField
                label="Description"
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                fullWidth
                required
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <FormControl fullWidth required>
                  <InputLabel id="exp-edit-cat-label">Category</InputLabel>
                  <Select
                    labelId="exp-edit-cat-label"
                    label="Category"
                    value={editing.category_id}
                    onChange={(e) => setEditing({ ...editing, category_id: Number(e.target.value) })}
                  >
                    {categories.map((c) => (
                      <MenuItem key={c.id ?? c.name} value={c.id ?? ""}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Date"
                  type="date"
                  value={toDateInputValue(editing.date)}
                  onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  required
                />
              </Stack>
              <TextField
                label="Amount"
                value={editAmountText}
                onChange={(e) => {
                  const next = sanitizeMoneyInput(e.target.value);
                  setEditAmountText(next);
                  setEditing({ ...editing, amount: Number(next) || 0 });
                }}
                onBlur={() => {
                  const settled = normalizeMoneyInput(editAmountText);
                  setEditAmountText(settled);
                  setEditing({ ...editing, amount: roundMoney(Number(settled)) });
                }}
                fullWidth
                required
                inputProps={{ inputMode: "decimal" }}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              />
              {/* A disbursed expense is history — its cheque has been written,
                  so the toggle is only offered while one is still outstanding. */}
              {(editing.status === "recorded" || editing.status === "approved") && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={editing.status === "recorded"}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          status: e.target.checked ? "recorded" : "approved",
                          reimburse_brother_id: e.target.checked ? null : editing.reimburse_brother_id,
                          cheque_number: e.target.checked ? null : editing.cheque_number,
                        })
                      }
                    />
                  }
                  label="No disbursement needed"
                />
              )}
              {editing.status === "recorded" ? (
                <Alert severity="info">
                  Recorded against the budget with no cheque and nobody to reimburse.
                </Alert>
              ) : (
                <>
                  <FormControl fullWidth>
                    <InputLabel id="exp-edit-bro-label">Brother to reimburse</InputLabel>
                    <Select
                      labelId="exp-edit-bro-label"
                      label="Brother to reimburse"
                      value={editing.reimburse_brother_id ?? ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          reimburse_brother_id: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    >
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>
                      {brothers.map((b) => (
                        <MenuItem key={b.id ?? `${b.first_name}-${b.last_name}`} value={b.id ?? ""}>
                          {b.first_name} {b.last_name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    label="Cheque number"
                    value={editing.cheque_number ?? ""}
                    onChange={(e) => setEditing({ ...editing, cheque_number: e.target.value })}
                    fullWidth
                  />
                </>
              )}

              <Button variant="outlined" component="label">
                {editReceipt ? `New receipt: ${editReceipt.name}` : "Replace / attach receipt (optional)"}
                <input
                  type="file"
                  hidden
                  accept="application/pdf,image/*"
                  onChange={(e) => setEditReceipt(e.target.files?.[0] ?? null)}
                />
              </Button>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setEditing(null)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={!editing?.id}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete */}
      {canWrite && deleting && <ConfirmDeleteExpenseDialog expense={deleting} onClose={() => setDeleting(null)} onDeleted={handleDelete} />}

      {/* Review / approve */}
      <Dialog open={!!reviewing && canReview} onClose={() => setReviewing(null)} fullWidth maxWidth="sm">
        <DialogTitle>Review submission</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {reviewing && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {reviewing.submitted_by_name ? `Submitted by: ${reviewing.submitted_by_name}` : "Submitted expense"}
              </Typography>
              {reviewing.receipt_url && (
                <Button
                  variant="outlined"
                  onClick={() => openAuthenticatedFile(`${apiBase}${reviewing.receipt_url}`)}
                >
                  Open receipt
                </Button>
              )}
              <TextField
                label="Description"
                value={reviewing.description}
                onChange={(e) => setReviewing({ ...reviewing, description: e.target.value })}
                fullWidth
                required
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <FormControl fullWidth required>
                  <InputLabel id="revw-cat-label">Category</InputLabel>
                  <Select
                    labelId="revw-cat-label"
                    label="Category"
                    value={reviewing.category_id}
                    onChange={(e) => setReviewing({ ...reviewing, category_id: Number(e.target.value) })}
                  >
                    {categories.map((c) => (
                      <MenuItem key={c.id ?? c.name} value={c.id ?? ""}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Date"
                  type="date"
                  value={toDateInputValue(reviewing.date)}
                  onChange={(e) => setReviewing({ ...reviewing, date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  required
                />
              </Stack>
              <TextField
                label="Amount"
                value={reviewAmountText}
                onChange={(e) => {
                  const next = sanitizeMoneyInput(e.target.value);
                  setReviewAmountText(next);
                  setReviewing({ ...reviewing, amount: Number(next) || 0 });
                }}
                onBlur={() => {
                  const settled = normalizeMoneyInput(reviewAmountText);
                  setReviewAmountText(settled);
                  setReviewing({ ...reviewing, amount: roundMoney(Number(settled)) });
                }}
                fullWidth
                required
                inputProps={{ inputMode: "decimal" }}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              />
              <FormControl fullWidth required>
                <InputLabel id="revw-bro-label">Brother to reimburse</InputLabel>
                <Select
                  labelId="revw-bro-label"
                  label="Brother to reimburse"
                  value={reviewing.reimburse_brother_id ?? ""}
                  onChange={(e) =>
                    setReviewing({
                      ...reviewing,
                      reimburse_brother_id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                >
                  {brothers.map((b) => (
                    <MenuItem key={b.id ?? `${b.first_name}-${b.last_name}`} value={b.id ?? ""}>
                      {b.first_name} {b.last_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setReviewing(null)} disabled={reviewSaving}>
            Cancel
          </Button>
          <Button variant="outlined" color="error" onClick={handleRejectReviewed} disabled={reviewSaving || !reviewing?.id}>
            Reject
          </Button>
          <Button variant="contained" onClick={handleApproveReviewed} disabled={reviewSaving || !reviewing?.id}>
            Approve
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}


