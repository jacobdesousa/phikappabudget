import { useEffect, useState, useCallback } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
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
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  IBudgetExpenseRow,
  IBudgetReconciliation,
  IBudgetRevenueRow,
  IBudgetSummary,
} from "../interfaces/api.interface";
import {
  getBudgetSummary,
  saveExpenseAllocations,
  saveReconciliation,
  saveRevenueAllocations,
} from "../services/budgetService";
import { useAuth } from "../context/authContext";
import SchoolYearSelector from "../components/SchoolYearSelector";
import { formatMoney, normalizeMoneyInput } from "../utils/money";
import { schoolYearStartForDate } from "../utils/schoolYear";

const CELL_SX = { py: "3px", px: "6px", fontSize: "0.72rem", whiteSpace: "nowrap" as const };
const HEAD_SX = { ...CELL_SX, fontWeight: 700 };
const TOTAL_SX = { ...CELL_SX, fontWeight: 700, borderTop: "2px solid", borderColor: "divider" };

function remainingColor(remaining: number, budgeted: number) {
  if (budgeted === 0) return "inherit";
  if (remaining < 0) return "error.main";
  if (remaining / budgeted < 0.2) return "warning.main";
  return "inherit";
}

function MoneyCell({ value, sx }: { value: number; sx?: object }) {
  return (
    <TableCell align="right" sx={{ ...CELL_SX, ...sx }}>
      ${formatMoney(value)}
    </TableCell>
  );
}

function EditableMoneyCell({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <TableCell align="right" sx={{ py: "1px", px: "4px" }}>
      <TextField
        size="small"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onChange(normalizeMoneyInput(e.target.value))}
        inputProps={{ style: { fontSize: "0.72rem", padding: "2px 4px", textAlign: "right", width: 70 } }}
        InputProps={{ startAdornment: <InputAdornment position="start" sx={{ fontSize: "0.7rem" }}>$</InputAdornment> }}
        variant="outlined"
      />
    </TableCell>
  );
}

function InlineMoneyField({
  label,
  value,
  onBlur,
  canWrite,
  resetKey,
}: {
  label: string;
  value: number;
  onBlur: (raw: string) => void;
  canWrite: boolean;
  resetKey: string;
}) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      {canWrite ? (
        <TextField
          size="small"
          defaultValue={value.toFixed(2)}
          key={resetKey}
          onBlur={(e) => onBlur(e.target.value)}
          inputProps={{ style: { fontSize: "0.78rem", padding: "3px 6px", width: 90, textAlign: "right" } }}
          InputProps={{
            startAdornment: <InputAdornment position="start" sx={{ fontSize: "0.7rem" }}>$</InputAdornment>,
          }}
          variant="outlined"
        />
      ) : (
        <Typography variant="body2" fontWeight={500}>
          ${formatMoney(value)}
        </Typography>
      )}
    </Box>
  );
}

function RevenueSection({
  rows,
  editMode,
  budgets,
  onBudgetChange,
  totals,
}: {
  rows: IBudgetRevenueRow[];
  editMode: boolean;
  budgets: Record<number, string>;
  onBudgetChange: (id: number, v: string) => void;
  totals: { budgeted: number; actual: number };
}) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const toggle = (id: number) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Table size="small" sx={{ tableLayout: "fixed" }}>
        <TableHead>
          <TableRow sx={{ bgcolor: "action.hover" }}>
            <TableCell sx={{ ...HEAD_SX, width: 24 }} />
            <TableCell sx={HEAD_SX}>Revenue Category</TableCell>
            <TableCell align="right" sx={{ ...HEAD_SX, width: 72 }}>Prior Yr</TableCell>
            <TableCell align="right" sx={{ ...HEAD_SX, width: 80 }}>Budgeted</TableCell>
            <TableCell align="right" sx={{ ...HEAD_SX, width: 72 }}>Actual</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <>
              <TableRow key={r.category_id} hover>
                <TableCell sx={{ ...CELL_SX, width: 24, p: 0 }}>
                  {r.entries.length > 0 && (
                    <IconButton size="small" onClick={() => toggle(r.category_id)} sx={{ p: "2px" }}>
                      {expanded[r.category_id] ? (
                        <KeyboardArrowDownIcon sx={{ fontSize: 14 }} />
                      ) : (
                        <KeyboardArrowRightIcon sx={{ fontSize: 14 }} />
                      )}
                    </IconButton>
                  )}
                </TableCell>
                <TableCell sx={CELL_SX}>
                  {r.category_name}
                  {r.entries.length > 0 && (
                    <Chip label={r.entries.length} size="small" sx={{ ml: 0.5, height: 14, fontSize: "0.6rem" }} />
                  )}
                </TableCell>
                <MoneyCell value={r.prior_year_actual} sx={{ color: "text.secondary" }} />
                {editMode ? (
                  <EditableMoneyCell
                    value={budgets[r.category_id] ?? "0.00"}
                    onChange={(v) => onBudgetChange(r.category_id, v)}
                  />
                ) : (
                  <MoneyCell value={r.budgeted_amount} />
                )}
                <MoneyCell value={r.actual_amount} />
              </TableRow>
              {r.entries.length > 0 && (
                <TableRow key={`${r.category_id}-entries`}>
                  <TableCell colSpan={5} sx={{ p: 0, border: 0 }}>
                    <Collapse in={!!expanded[r.category_id]} timeout="auto" unmountOnExit>
                      <Table size="small" sx={{ bgcolor: "action.hover" }}>
                        <TableBody>
                          {r.entries.map((e) => (
                            <TableRow key={e.id}>
                              <TableCell sx={{ ...CELL_SX, pl: 5, width: 80, color: "text.secondary" }}>
                                {typeof e.date === "string" ? e.date.slice(0, 10) : String(e.date).slice(0, 10)}
                              </TableCell>
                              <TableCell sx={{ ...CELL_SX, color: "text.secondary" }}>{e.description}</TableCell>
                              <TableCell align="right" sx={{ ...CELL_SX, width: 72, color: "text.secondary" }}>
                                ${formatMoney(e.amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Collapse>
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
          <TableRow>
            <TableCell sx={{ ...TOTAL_SX, width: 24 }} />
            <TableCell sx={TOTAL_SX}>TOTAL</TableCell>
            <TableCell sx={{ ...TOTAL_SX, width: 72 }} />
            <TableCell align="right" sx={{ ...TOTAL_SX, width: 80 }}>${formatMoney(totals.budgeted)}</TableCell>
            <TableCell align="right" sx={{ ...TOTAL_SX, width: 72 }}>${formatMoney(totals.actual)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Paper>
  );
}

function ExpenseSection({
  rows,
  editMode,
  budgets,
  onBudgetChange,
  totals,
}: {
  rows: IBudgetExpenseRow[];
  editMode: boolean;
  budgets: Record<number, string>;
  onBudgetChange: (id: number, v: string) => void;
  totals: { budgeted: number; actual: number; remaining: number };
}) {
  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Table size="small" sx={{ tableLayout: "fixed" }}>
        <TableHead>
          <TableRow sx={{ bgcolor: "action.hover" }}>
            <TableCell sx={HEAD_SX}>Expense Category</TableCell>
            <TableCell align="right" sx={{ ...HEAD_SX, width: 72 }}>Prior Yr</TableCell>
            <TableCell align="right" sx={{ ...HEAD_SX, width: 80 }}>Budgeted</TableCell>
            <TableCell align="right" sx={{ ...HEAD_SX, width: 72 }}>Actual</TableCell>
            <TableCell align="right" sx={{ ...HEAD_SX, width: 80 }}>Remaining</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.category_id} hover>
              <TableCell sx={CELL_SX}>{r.category_name}</TableCell>
              <MoneyCell value={r.prior_year_actual} sx={{ color: "text.secondary" }} />
              {editMode ? (
                <EditableMoneyCell
                  value={budgets[r.category_id] ?? "0.00"}
                  onChange={(v) => onBudgetChange(r.category_id, v)}
                />
              ) : (
                <MoneyCell value={r.budgeted_amount} />
              )}
              <MoneyCell value={r.actual_amount} />
              <TableCell
                align="right"
                sx={{
                  ...CELL_SX,
                  color: remainingColor(r.remaining, r.budgeted_amount),
                  fontWeight: r.remaining < 0 ? 700 : "inherit",
                }}
              >
                ${formatMoney(r.remaining)}
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell sx={TOTAL_SX}>TOTAL</TableCell>
            <TableCell sx={{ ...TOTAL_SX, width: 72 }} />
            <TableCell align="right" sx={{ ...TOTAL_SX, width: 80 }}>${formatMoney(totals.budgeted)}</TableCell>
            <TableCell align="right" sx={{ ...TOTAL_SX, width: 72 }}>${formatMoney(totals.actual)}</TableCell>
            <TableCell
              align="right"
              sx={{
                ...TOTAL_SX,
                width: 80,
                color: totals.remaining < 0 ? "error.main" : "inherit",
              }}
            >
              ${formatMoney(totals.remaining)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Paper>
  );
}

function ReconciliationSection({
  data,
  canWrite,
  year,
  onSaved,
}: {
  data: IBudgetReconciliation;
  canWrite: boolean;
  year: number;
  onSaved: (d: IBudgetReconciliation) => void;
}) {
  const [fields, setFields] = useState<IBudgetReconciliation>(data);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFields(data);
  }, [data]);

  const handleBlur = async (field: keyof IBudgetReconciliation, raw: string) => {
    const val = parseFloat(raw) || 0;
    const updated = { ...fields, [field]: val };
    setFields(updated);
    if (!canWrite) return;
    setSaving(true);
    try {
      await saveReconciliation(year, updated);
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  };

  const totalKnown = fields.bank_balance + fields.cash_amount + fields.accounts_receivable;
  const spendable = totalKnown - fields.emergency_reserve;
  const reserveDip = fields.emergency_reserve - fields.bank_balance;
  const ateIntoReserve = reserveDip > 0;

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
        <AccountBalanceOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
        <Typography variant="caption" fontWeight={700} sx={{ letterSpacing: 1, color: "text.secondary" }}>
          RECONCILIATION
        </Typography>
        {saving && <CircularProgress size={12} />}
      </Stack>

      {/* Regular fields */}
      <Stack direction="row" flexWrap="wrap" gap={2} mb={1.5}>
        <InlineMoneyField
          label="Cash on Hand"
          value={fields.cash_amount}
          onBlur={(v) => handleBlur("cash_amount", v)}
          canWrite={canWrite}
          resetKey={`cash-${data.cash_amount}`}
        />
        <InlineMoneyField
          label="Bank Balance"
          value={fields.bank_balance}
          onBlur={(v) => handleBlur("bank_balance", v)}
          canWrite={canWrite}
          resetKey={`bank-${data.bank_balance}`}
        />
        <InlineMoneyField
          label="Accounts Receivable"
          value={fields.accounts_receivable}
          onBlur={(v) => handleBlur("accounts_receivable", v)}
          canWrite={canWrite}
          resetKey={`ar-${data.accounts_receivable}`}
        />
      </Stack>

      {/* Emergency reserve — visually distinct */}
      <Paper
        variant="outlined"
        sx={{
          p: 1,
          mb: 1.5,
          borderColor: ateIntoReserve ? "error.main" : "warning.main",
          borderStyle: "dashed",
        }}
      >
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <ShieldOutlinedIcon sx={{ fontSize: 16, color: ateIntoReserve ? "error.main" : "warning.main" }} />
          <Box flex={1}>
            <Typography variant="caption" color="text.secondary" display="block">
              Emergency Reserve <Typography component="span" variant="caption" color="text.disabled">(set-aside — not for spending)</Typography>
            </Typography>
            {canWrite ? (
              <TextField
                size="small"
                defaultValue={fields.emergency_reserve.toFixed(2)}
                key={`reserve-${data.emergency_reserve}`}
                onBlur={(e) => handleBlur("emergency_reserve", e.target.value)}
                inputProps={{ style: { fontSize: "0.78rem", padding: "3px 6px", width: 90, textAlign: "right" } }}
                InputProps={{
                  startAdornment: <InputAdornment position="start" sx={{ fontSize: "0.7rem" }}>$</InputAdornment>,
                }}
                variant="outlined"
              />
            ) : (
              <Typography variant="body2" fontWeight={500}>
                ${formatMoney(fields.emergency_reserve)}
              </Typography>
            )}
          </Box>
          {ateIntoReserve && (
            <Chip
              icon={<WarningAmberIcon sx={{ fontSize: 14 }} />}
              label={`$${formatMoney(reserveDip)} drawn from reserve`}
              color="error"
              size="small"
              sx={{ fontWeight: 700 }}
            />
          )}
        </Stack>
      </Paper>

      {/* Alert if ate into reserve */}
      {ateIntoReserve && (
        <Alert severity="error" icon={<WarningAmberIcon />} sx={{ mb: 1.5, fontSize: "0.8rem", py: 0.5 }}>
          Bank balance (${formatMoney(fields.bank_balance)}) is below the emergency reserve (${formatMoney(fields.emergency_reserve)}).
          You have drawn <strong>${formatMoney(reserveDip)}</strong> from emergency funds.
        </Alert>
      )}

      {/* Derived totals */}
      <Stack direction="row" gap={3} flexWrap="wrap">
        <Box>
          <Typography variant="caption" color="text.secondary">
            Total Known Money
          </Typography>
          <Typography variant="body2" fontWeight={700}>
            ${formatMoney(totalKnown)}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Available to Spend
          </Typography>
          <Tooltip title="Bank + Cash + AR − Emergency Reserve">
            <Typography
              variant="body2"
              fontWeight={700}
              color={spendable < 0 ? "error.main" : spendable < fields.emergency_reserve * 0.25 ? "warning.main" : "success.main"}
            >
              ${formatMoney(spendable)}
            </Typography>
          </Tooltip>
        </Box>
      </Stack>
    </Paper>
  );
}

export default function BudgetPage() {
  const { can } = useAuth();
  const canWrite = can("budget.write");
  const router = useRouter();

  const [year, setYear] = useState<number>(schoolYearStartForDate(new Date()));
  const [summary, setSummary] = useState<IBudgetSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [expenseBudgets, setExpenseBudgets] = useState<Record<number, string>>({});
  const [revenueBudgets, setRevenueBudgets] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async (y: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBudgetSummary(y);
      setSummary(data);
      const eb: Record<number, string> = {};
      for (const r of data.expense_rows) eb[r.category_id] = r.budgeted_amount.toFixed(2);
      setExpenseBudgets(eb);
      const rb: Record<number, string> = {};
      for (const r of data.revenue_rows) rb[r.category_id] = r.budgeted_amount.toFixed(2);
      setRevenueBudgets(rb);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load budget");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(year);
  }, [year, load]);

  const handleCancelEdit = () => {
    if (!summary) return;
    const eb: Record<number, string> = {};
    for (const r of summary.expense_rows) eb[r.category_id] = r.budgeted_amount.toFixed(2);
    setExpenseBudgets(eb);
    const rb: Record<number, string> = {};
    for (const r of summary.revenue_rows) rb[r.category_id] = r.budgeted_amount.toFixed(2);
    setRevenueBudgets(rb);
    setEditMode(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const expRows = Object.entries(expenseBudgets).map(([id, amt]) => ({
        category_id: Number(id),
        budgeted_amount: parseFloat(amt) || 0,
      }));
      const revRows = Object.entries(revenueBudgets).map(([id, amt]) => ({
        category_id: Number(id),
        budgeted_amount: parseFloat(amt) || 0,
      }));
      await Promise.all([
        saveExpenseAllocations(year, expRows),
        saveRevenueAllocations(year, revRows),
      ]);
      await load(year);
      setEditMode(false);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

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
            <Typography variant="h5">Budget</Typography>
            <Typography variant="body2" color="text.secondary">
              Budgeted vs actual spend by category. Edit allocations to plan the year.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <SchoolYearSelector value={year} onChange={setYear} />
            {canWrite && !editMode && (
              <Button
                size="small"
                startIcon={<EditOutlinedIcon />}
                variant="outlined"
                onClick={() => setEditMode(true)}
              >
                Edit Budgets
              </Button>
            )}
            {canWrite && editMode && (
              <>
                <Button
                  size="small"
                  startIcon={saving ? <CircularProgress size={14} /> : <SaveOutlinedIcon />}
                  variant="contained"
                  onClick={handleSave}
                  disabled={saving}
                >
                  Save
                </Button>
                <Button size="small" startIcon={<CancelOutlinedIcon />} onClick={handleCancelEdit} disabled={saving}>
                  Cancel
                </Button>
              </>
            )}
            <Tooltip title="Print view">
              <IconButton size="small" onClick={() => router.push(`/budget/print?year=${year}`)}>
                <PrintOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      <Box px={2} pb={2}>
        <Stack gap={1.5}>
          {saveError && (
            <Alert severity="error" onClose={() => setSaveError(null)}>
              {saveError}
            </Alert>
          )}

          {loading && (
            <Box display="flex" justifyContent="center" py={6}>
              <CircularProgress />
            </Box>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          {summary && !loading && (
            <>
              {summary.outstanding_disbursements.count > 0 && (
                <Alert
                  severity="warning"
                  icon={<WarningAmberIcon fontSize="small" />}
                  action={
                    <Button size="small" component={Link} href="/expenses">
                      View
                    </Button>
                  }
                >
                  {summary.outstanding_disbursements.count} approved expense
                  {summary.outstanding_disbursements.count !== 1 ? "s" : ""} totalling $
                  {formatMoney(summary.outstanding_disbursements.total)} not yet disbursed.
                </Alert>
              )}

              <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
                <Chip
                  label={`Net: ${summary.totals.net >= 0 ? "+" : ""}$${formatMoney(summary.totals.net)}`}
                  color={summary.totals.net >= 0 ? "success" : "error"}
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
                <Typography variant="caption" color="text.secondary">
                  Revenue ${formatMoney(summary.totals.revenue.actual)} − Expenses $
                  {formatMoney(summary.totals.expense.actual)}
                </Typography>
              </Stack>

              <Grid container spacing={1.5}>
                <Grid item xs={12} md={5}>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    sx={{ letterSpacing: 1, color: "text.secondary", mb: 0.5, display: "block" }}
                  >
                    REVENUE
                  </Typography>
                  <RevenueSection
                    rows={summary.revenue_rows}
                    editMode={editMode}
                    budgets={revenueBudgets}
                    onBudgetChange={(id, v) => setRevenueBudgets((p) => ({ ...p, [id]: v }))}
                    totals={summary.totals.revenue}
                  />
                </Grid>
                <Grid item xs={12} md={7}>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    sx={{ letterSpacing: 1, color: "text.secondary", mb: 0.5, display: "block" }}
                  >
                    EXPENSES
                  </Typography>
                  <ExpenseSection
                    rows={summary.expense_rows}
                    editMode={editMode}
                    budgets={expenseBudgets}
                    onBudgetChange={(id, v) => setExpenseBudgets((p) => ({ ...p, [id]: v }))}
                    totals={summary.totals.expense}
                  />
                </Grid>
              </Grid>

              <ReconciliationSection
                data={summary.reconciliation}
                canWrite={canWrite}
                year={year}
                onSaved={(d) =>
                  setSummary((s) =>
                    s
                      ? {
                          ...s,
                          reconciliation: d,
                          totals: {
                            ...s.totals,
                            total_known_money: d.bank_balance + d.cash_amount + d.accounts_receivable,
                          },
                        }
                      : s
                  )
                }
              />
            </>
          )}
        </Stack>
      </Box>
    </Stack>
  );
}

