import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
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
import IconButton from "@mui/material/IconButton";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useAuth } from "../context/authContext";

import { IExpense, IExpenseCategory, IBrother } from "../interfaces/api.interface";
import { getExpenseCategories } from "../services/expenseCategoryService";
import { addExpense, addExpenseWithReceipt, getExpenses, updateExpense, uploadExpenseReceipt } from "../services/expensesService";
import { getAllBrothers } from "../services/brotherService";
import { schoolYearLabel, schoolYearStartForDate } from "../utils/schoolYear";
import ConfirmDeleteExpenseDialog from "../components/confirmDeleteExpense/confirmDeleteExpense";
import { formatMoney, normalizeMoneyInput, roundMoney } from "../utils/money";
import { approveExpense, disburseExpenses, rejectExpense } from "../services/expenseWorkflowService";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export default function ExpensesPage() {
  const { can } = useAuth();
  const canWrite = can("expenses.write");
  const canReview = can("expenses.review");
  const canDisburse = can("expenses.disburse");
  const [refresh, setRefresh] = useState(false);
  const currentYear = useMemo(() => schoolYearStartForDate(new Date()), []);
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
  const [newAmount, setNewAmount] = useState<string>("0");
  const [newDate, setNewDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [newCategoryId, setNewCategoryId] = useState<number | "">("");
  const [newBrotherId, setNewBrotherId] = useState<number | "">("");
  const [newCheque, setNewCheque] = useState<string>("");
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
          e.status === "paid"
      ),
    [expenses]
  );

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
    Promise.all([getExpenseCategories(), getAllBrothers(), getExpenses()])
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
  }, [refresh]);

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
          reimburse_brother_id: newBrotherId ? Number(newBrotherId) : null,
          cheque_number: newCheque || null,
          receipt: newReceipt,
        })
      : await addExpense({
          date: newDate,
          description: newDescription,
          category_id: Number(newCategoryId),
          amount,
          reimburse_brother_id: newBrotherId ? Number(newBrotherId) : null,
          cheque_number: newCheque || null,
        } as IExpense);

    if (!res.ok) {
      setError(res.error?.message ?? "Could not add expense.");
      return;
    }

    setAddOpen(false);
    setNewDescription("");
    setNewAmount("0");
    setNewDate(new Date().toISOString().slice(0, 10));
    setNewCategoryId("");
    setNewBrotherId("");
    setNewCheque("");
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
            <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
              School year: <b>{schoolYearLabel(currentYear)}</b>
            </Typography>
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
                              <a
                                href={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}${e.receipt_url}`}
                                target="_blank"
                                rel="noreferrer"
                              >
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
                                  <a href={`${apiBase}${e.receipt_url}`} target="_blank" rel="noreferrer">
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

          <Box sx={{ width: "100%", maxWidth: 1200, mx: "auto" }}>
            <Grid container spacing={2} alignItems="stretch">
              <Grid item xs={12} md={3} sx={{ display: "flex" }}>
                <Card variant="outlined" sx={{ width: "100%" }}>
                  <CardContent sx={{ minHeight: 104, display: "flex", flexDirection: "column" }}>
                    <Typography variant="overline" color="text.secondary">
                      Total expenses (Approved)
                    </Typography>
                    <Typography variant="h5">${formatMoney(totalExpensesApproved)}</Typography>
                    <Typography variant="caption" sx={{ visibility: "hidden" }}>
                      spacer
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3} sx={{ display: "flex" }}>
                <Card variant="outlined" sx={{ width: "100%" }}>
                  <CardContent sx={{ minHeight: 104, display: "flex", flexDirection: "column" }}>
                    <Typography variant="overline" color="text.secondary">
                      Entries
                    </Typography>
                    <Typography variant="h5">{approvedExpenses.length}</Typography>
                    <Typography variant="caption" sx={{ visibility: "hidden" }}>
                      spacer
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>

          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Expense entries (Approved)
            </Typography>

            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems={{ md: "center" }}
              sx={{ mb: 2 }}
            >
              <TextField
                label="Search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                fullWidth
              />
              <TextField
                select
                label="Category"
                value={filterCategoryId}
                onChange={(e) => setFilterCategoryId(e.target.value as any)}
                sx={{ minWidth: { md: 220 } }}
              >
                <MenuItem value="">
                  <em>All</em>
                </MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c.id ?? c.name} value={c.id ?? ""}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Person"
                value={filterBrotherId}
                onChange={(e) => setFilterBrotherId(e.target.value as any)}
                sx={{ minWidth: { md: 220 } }}
              >
                <MenuItem value="">
                  <em>All</em>
                </MenuItem>
                {brothers.map((b) => (
                  <MenuItem key={b.id ?? `${b.first_name}-${b.last_name}`} value={b.id ?? ""}>
                    {b.first_name} {b.last_name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Cheque #"
                value={filterChequeNumber}
                onChange={(e) => setFilterChequeNumber(e.target.value)}
                sx={{ minWidth: { md: 180 } }}
              />
              <Button
                variant="outlined"
                onClick={() => {
                  setSearchText("");
                  setFilterCategoryId("");
                  setFilterBrotherId("");
                  setFilterChequeNumber("");
                }}
                sx={{ minWidth: 120 }}
              >
                Clear
              </Button>
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Showing <b>{filteredApprovedExpenses.length}</b> / <b>{approvedExpenses.length}</b> • Total (filtered):{" "}
              <b>${formatMoney(filteredApprovedTotal)}</b>
            </Typography>

            {approvedExpenses.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No expenses for this year yet.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {filteredApprovedExpenses.map((e) => (
                  <Paper key={e.id ?? `${e.description}-${e.date}-${e.amount}`} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 600 }}>{e.description}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {(e.category_name ?? "Uncategorized")} • {new Date(e.date).toDateString()}
                          {e.cheque_number ? ` • Cheque: ${e.cheque_number}` : ""}
                        </Typography>
                        {e.receipt_url && (
                          <Typography variant="body2" color="text.secondary">
                            Receipt:{" "}
                            <a href={`${apiBase}${e.receipt_url}`} target="_blank" rel="noreferrer">
                              open
                            </a>
                          </Typography>
                        )}
                        <Typography variant="body2" color="text.secondary">
                          Reimburse:{" "}
                          {e.reimburse_first_name && e.reimburse_last_name
                            ? `${e.reimburse_first_name} ${e.reimburse_last_name}`
                            : e.reimburse_brother_id
                              ? `Brother #${e.reimburse_brother_id}`
                              : "—"}
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
                                  <IconButton size="small" onClick={() => setEditing(e)} disabled={!e.id}>
                                    <EditOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <span>
                                  <IconButton size="small" color="error" onClick={() => setDeleting(e)} disabled={!e.id}>
                                    <DeleteOutlineIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </>
                          ) : null}
                        </Stack>
                        <Typography sx={{ fontWeight: 700 }}>
                          ${formatMoney(e.amount ?? 0)}
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

      {/* Add */}
      <Dialog open={addOpen && canWrite} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add expense</DialogTitle>
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
              type="number"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              onBlur={() => setNewAmount(normalizeMoneyInput(newAmount))}
              fullWidth
              required
              inputProps={{ step: "0.01" }}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            />
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
        <DialogTitle>Edit expense</DialogTitle>
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
                  value={new Date(editing.date).toISOString().slice(0, 10)}
                  onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  required
                />
              </Stack>
              <TextField
                label="Amount"
                type="number"
                value={String(editing.amount ?? 0)}
                onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })}
                onBlur={() => setEditing({ ...editing, amount: roundMoney(Number(editing.amount ?? 0)) })}
                fullWidth
                required
                inputProps={{ step: "0.01" }}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              />
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
                  href={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}${reviewing.receipt_url}`}
                  target="_blank"
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
                  value={new Date(reviewing.date).toISOString().slice(0, 10)}
                  onChange={(e) => setReviewing({ ...reviewing, date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  required
                />
              </Stack>
              <TextField
                label="Amount"
                type="number"
                value={String(reviewing.amount ?? 0)}
                onChange={(e) => setReviewing({ ...reviewing, amount: Number(e.target.value) })}
                onBlur={() => setReviewing({ ...reviewing, amount: roundMoney(Number(reviewing.amount ?? 0)) })}
                fullWidth
                required
                inputProps={{ step: "0.01" }}
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


