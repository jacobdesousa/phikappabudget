import { useEffect, useState, useCallback } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
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
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  IBudgetDuesConfig,
  IBudgetExpenseRow,
  IBudgetReconciliation,
  IBudgetRevenueRow,
  IBudgetSummary,
} from "../interfaces/api.interface";
import {
  getBudgetSummary,
  saveDuesConfig,
  saveExpenseAllocations,
  saveReconciliation,
  saveRevenueAllocations,
} from "../services/budgetService";
import { useAuth } from "../context/authContext";
import SchoolYearSelector from "../components/SchoolYearSelector";
import { formatMoney } from "../utils/money";
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

function InlineBudgetCell({
  value,
  onSave,
  canWrite,
}: {
  value: number;
  onSave: (v: number) => void;
  canWrite: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (!canWrite || !editing) {
    return (
      <TableCell
        align="right"
        sx={{
          ...CELL_SX,
          cursor: canWrite ? "pointer" : "default",
          "&:hover": canWrite ? { bgcolor: "action.hover", textDecoration: "underline dotted" } : {},
        }}
        onClick={canWrite ? () => { setDraft(value.toFixed(2)); setEditing(true); } : undefined}
      >
        ${formatMoney(value)}
      </TableCell>
    );
  }
  return (
    <TableCell align="right" sx={{ py: "1px", px: "2px" }}>
      <TextField
        autoFocus
        size="small"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onSave(parseFloat(draft) || 0); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setEditing(false); setDraft(value.toFixed(2)); }
        }}
        inputProps={{ style: { fontSize: "0.72rem", padding: "2px 4px", textAlign: "right", width: 52 } }}
        InputProps={{ startAdornment: <InputAdornment position="start" sx={{ fontSize: "0.7rem", mr: 0 }}>$</InputAdornment> }}
        variant="outlined"
        sx={{ "& .MuiOutlinedInput-root": { pl: "6px" } }}
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

function DuesBudgetedCell({ duesConfig }: { duesConfig: IBudgetDuesConfig }) {
  const total =
    duesConfig.active_count * duesConfig.dues_rate_active +
    duesConfig.estimated_pledges * duesConfig.dues_rate_pledge;
  return (
    <TableCell align="right" sx={CELL_SX}>
      ${formatMoney(total)}
    </TableCell>
  );
}

function ChapterBonusBudgetedCell({
  budgeted_amount,
  canWrite,
  onSaveRate,
}: {
  budgeted_amount: number;
  canWrite: boolean;
  onSaveRate: (rate: number) => void;
}) {
  const ratePerMonth = budgeted_amount / 8;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (!canWrite || !editing) {
    return (
      <Tooltip title={`8 months × $${formatMoney(ratePerMonth)}/mo — click to change rate`}>
        <TableCell
          align="right"
          sx={{
            ...CELL_SX,
            fontStyle: "italic",
            cursor: canWrite ? "pointer" : "default",
            "&:hover": canWrite ? { bgcolor: "action.hover", textDecoration: "underline dotted" } : {},
          }}
          onClick={canWrite ? () => { setDraft(ratePerMonth.toFixed(2)); setEditing(true); } : undefined}
        >
          ${formatMoney(budgeted_amount)}
        </TableCell>
      </Tooltip>
    );
  }
  return (
    <TableCell sx={{ py: "1px", px: "4px" }}>
      <Stack direction="row" alignItems="center" gap={0.5}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6rem", whiteSpace: "nowrap" }}>$/mo:</Typography>
        <TextField
          autoFocus
          size="small"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { onSaveRate(parseFloat(draft) || 0); setEditing(false); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setEditing(false);
          }}
          inputProps={{ style: { fontSize: "0.65rem", padding: "1px 3px", textAlign: "right", width: 55 } }}
          InputProps={{ startAdornment: <InputAdornment position="start" sx={{ fontSize: "0.6rem" }}>$</InputAdornment> }}
          variant="outlined"
        />
      </Stack>
    </TableCell>
  );
}

function RevenueSection({
  rows,
  duesConfig,
  estimatedPledges,
  onSavePledges,
  canWrite,
  onSaveBudget,
  onSaveCbRate,
  totals,
}: {
  rows: IBudgetRevenueRow[];
  duesConfig: IBudgetDuesConfig;
  estimatedPledges: number;
  onSavePledges: (n: number) => void;
  canWrite: boolean;
  onSaveBudget: (categoryId: number, amount: number) => void;
  onSaveCbRate: (rate: number) => void;
  totals: { budgeted: number; actual: number };
}) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const toggle = (id: number) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  // Pin Dues first, Chapter Bonus second, then alphabetical
  const pinOrder = (r: IBudgetRevenueRow) => (r.is_dues ? 0 : r.is_chapter_bonus ? 1 : 2);
  const sorted = [...rows].sort((a, b) => pinOrder(a) - pinOrder(b));

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Table size="small" sx={{ tableLayout: "fixed" }}>
        <TableHead>
          <TableRow sx={{ bgcolor: "action.hover" }}>
            <TableCell sx={{ ...HEAD_SX, width: 24 }} />
            <TableCell sx={HEAD_SX}>Revenue Category</TableCell>
            <TableCell align="right" sx={{ ...HEAD_SX, width: 80 }}>Budgeted</TableCell>
            <TableCell align="right" sx={{ ...HEAD_SX, width: 72 }}>Actual</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((r) => {
            const showExpand = r.is_dues
              ? duesConfig.active_count > 0 || duesConfig.estimated_pledges > 0
              : r.entries.length > 0;
            return (
              <>
                <TableRow key={r.category_id} hover sx={(r.is_dues || r.is_chapter_bonus) ? { bgcolor: "action.selected" } : undefined}>
                  <TableCell sx={{ ...CELL_SX, width: 24, p: 0 }}>
                    {showExpand && (
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
                    <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap">
                      <span>{r.category_name}</span>
                      {r.is_dues && (
                        <Tooltip title="Auto-calculated: actives × dues rate + projected pledges × pledge rate">
                          <AutoAwesomeIcon sx={{ fontSize: 11, color: "text.disabled" }} />
                        </Tooltip>
                      )}
                      {r.is_chapter_bonus && (
                        <Tooltip title="8 bonus months × monthly rate">
                          <AutoAwesomeIcon sx={{ fontSize: 11, color: "text.disabled" }} />
                        </Tooltip>
                      )}
                      {!r.is_dues && r.entries.length > 0 && (
                        <Chip label={r.entries.length} size="small" sx={{ ml: 0.5, height: 14, fontSize: "0.6rem" }} />
                      )}
                    </Stack>
                  </TableCell>
                  {r.is_dues ? (
                    <DuesBudgetedCell duesConfig={duesConfig} />
                  ) : r.is_chapter_bonus ? (
                    <ChapterBonusBudgetedCell
                      budgeted_amount={r.budgeted_amount}
                      canWrite={canWrite}
                      onSaveRate={onSaveCbRate}
                    />
                  ) : (
                    <InlineBudgetCell
                      value={r.budgeted_amount}
                      canWrite={canWrite}
                      onSave={(v) => onSaveBudget(r.category_id, v)}
                    />
                  )}
                  <MoneyCell value={r.actual_amount} />
                </TableRow>
                {/* Dues breakdown sub-rows */}
                {r.is_dues && (
                  <TableRow key={`${r.category_id}-dues-breakdown`}>
                    <TableCell colSpan={4} sx={{ p: 0, border: 0 }}>
                      <Collapse in={!!expanded[r.category_id]} timeout="auto" unmountOnExit>
                        <Table size="small" sx={{ bgcolor: "action.hover", tableLayout: "fixed" }}>
                          <TableBody>
                            <TableRow>
                              <TableCell sx={{ ...CELL_SX, width: 24 }} />
                              <TableCell sx={{ ...CELL_SX, color: "text.secondary" }}>
                                Actives ({duesConfig.active_count} × ${formatMoney(duesConfig.dues_rate_active)})
                              </TableCell>
                              <TableCell align="right" sx={{ ...CELL_SX, width: 80, color: "text.secondary" }}>
                                ${formatMoney(duesConfig.active_count * duesConfig.dues_rate_active)}
                              </TableCell>
                              <TableCell sx={{ ...CELL_SX, width: 72 }} />
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ ...CELL_SX, width: 24 }} />
                              <TableCell sx={{ ...CELL_SX, color: "text.secondary" }}>
                                <Stack direction="row" alignItems="center" gap={0.5}>
                                  <span>Pledges (est.</span>
                                  <TextField
                                    size="small"
                                    defaultValue={estimatedPledges}
                                    key={`pledges-${estimatedPledges}`}
                                    onBlur={(e) => {
                                      const n = parseInt(e.target.value, 10);
                                      if (!isNaN(n) && n >= 0) onSavePledges(n);
                                    }}
                                    inputProps={{ style: { fontSize: "0.65rem", padding: "1px 4px", width: 30, textAlign: "center" }, type: "number", min: 0 }}
                                    variant="outlined"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <span>× ${formatMoney(duesConfig.dues_rate_pledge)})</span>
                                </Stack>
                              </TableCell>
                              <TableCell align="right" sx={{ ...CELL_SX, width: 80, color: "text.secondary" }}>
                                ${formatMoney(estimatedPledges * duesConfig.dues_rate_pledge)}
                              </TableCell>
                              <TableCell sx={{ ...CELL_SX, width: 72 }} />
                            </TableRow>
                          </TableBody>
                        </Table>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                )}
                {/* Regular revenue entries */}
                {!r.is_dues && r.entries.length > 0 && (
                  <TableRow key={`${r.category_id}-entries`}>
                    <TableCell colSpan={4} sx={{ p: 0, border: 0 }}>
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
            );
          })}
          <TableRow>
            <TableCell sx={{ ...TOTAL_SX, width: 24 }} />
            <TableCell sx={TOTAL_SX}>TOTAL</TableCell>
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
  canWrite,
  onSaveBudget,
  totals,
}: {
  rows: IBudgetExpenseRow[];
  canWrite: boolean;
  onSaveBudget: (categoryId: number, amount: number) => void;
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
              <InlineBudgetCell
                value={r.budgeted_amount}
                canWrite={canWrite}
                onSave={(v) => onSaveBudget(r.category_id, v)}
              />
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
  revenueBudgeted,
  expenseBudgeted,
  onSaved,
}: {
  data: IBudgetReconciliation;
  canWrite: boolean;
  year: number;
  revenueBudgeted: number;
  expenseBudgeted: number;
  onSaved: (d: IBudgetReconciliation) => void;
}) {
  const [reserve, setReserve] = useState(data.emergency_reserve);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setReserve(data.emergency_reserve);
  }, [data.emergency_reserve]);

  const handleReserveBlur = async (raw: string) => {
    const val = parseFloat(raw) || 0;
    setReserve(val);
    if (!canWrite) return;
    setSaving(true);
    try {
      await saveReconciliation(year, val);
      onSaved({
        ...data,
        emergency_reserve: val,
        bank_balance: data.cash_amount + val,
      });
    } finally {
      setSaving(false);
    }
  };

  const bank_balance = data.cash_amount + reserve;
  const reserveDip = reserve > bank_balance;
  const budgetedNet = revenueBudgeted - expenseBudgeted;
  const budgetedOverdrawn = budgetedNet < -reserve;

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
        <AccountBalanceOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
        <Typography variant="caption" fontWeight={700} sx={{ letterSpacing: 1, color: "text.secondary" }}>
          RECONCILIATION
        </Typography>
        {saving && <CircularProgress size={12} />}
      </Stack>

      <Stack direction="row" gap={3} flexWrap="wrap" alignItems="flex-start">
        {/* Equation: Cash on Hand + Emergency Reserve = Bank Balance */}
        <Box sx={{ minWidth: 220 }}>
          {/* Cash on Hand */}
          <Tooltip title="Actual revenue − actual expenses">
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} sx={{ py: "2px" }}>
              <Typography variant="caption" color="text.secondary">Cash on Hand</Typography>
              <Typography variant="body2" fontWeight={600} color={data.cash_amount < 0 ? "error.main" : "inherit"}>
                ${formatMoney(data.cash_amount)}
              </Typography>
            </Stack>
          </Tooltip>

          {/* + Emergency Reserve */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} sx={{ py: "2px" }}>
            <Stack direction="row" alignItems="center" gap={0.5}>
              <Typography variant="caption" color={reserveDip ? "error.main" : "warning.main"} fontWeight={700}>+</Typography>
              <ShieldOutlinedIcon sx={{ fontSize: 12, color: reserveDip ? "error.main" : "warning.main" }} />
              <Typography variant="caption" color="text.secondary">Emergency Reserve</Typography>
            </Stack>
            {canWrite ? (
              <TextField
                size="small"
                defaultValue={data.emergency_reserve.toFixed(2)}
                key={`reserve-${data.emergency_reserve}`}
                onBlur={(e) => handleReserveBlur(e.target.value)}
                inputProps={{ style: { fontSize: "0.72rem", padding: "1px 4px", width: 80, textAlign: "right" } }}
                InputProps={{ startAdornment: <InputAdornment position="start" sx={{ fontSize: "0.68rem" }}>$</InputAdornment> }}
                variant="outlined"
              />
            ) : (
              <Typography variant="body2" fontWeight={600}>${formatMoney(reserve)}</Typography>
            )}
          </Stack>

          {/* = Bank Balance */}
          <Tooltip title="Cash on Hand + Emergency Reserve">
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}
              sx={{ py: "3px", mt: "2px", borderTop: "1.5px solid", borderColor: "divider" }}>
              <Stack direction="row" alignItems="center" gap={0.5}>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>=</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>Bank Balance</Typography>
              </Stack>
              <Typography variant="body2" fontWeight={700} color={bank_balance < 0 ? "error.main" : "inherit"}>
                ${formatMoney(bank_balance)}
              </Typography>
            </Stack>
          </Tooltip>
        </Box>

        {/* Accounts Receivable */}
          <Box sx={{ pl: 2, borderLeft: "1px solid", borderColor: "divider" }}>
            <Typography variant="caption" color="text.secondary" display="block">Accounts Receivable</Typography>
            <Typography variant="body2" fontWeight={700} color={data.accounts_receivable > 0 ? "warning.main" : "inherit"}>
              ${formatMoney(data.accounts_receivable)}
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.6rem" }}>budgeted − actual revenue</Typography>
          </Box>

        {/* Budgeted Net */}
        <Tooltip title={`If all budgeted amounts are hit: revenue $${formatMoney(revenueBudgeted)} − expenses $${formatMoney(expenseBudgeted)}`}>
          <Box sx={{ pl: 2, borderLeft: "1px solid", borderColor: "divider" }}>
            <Typography variant="caption" color="text.secondary" display="block">Budgeted Net</Typography>
            <Typography
              variant="body2"
              fontWeight={700}
              color={budgetedOverdrawn ? "error.main" : budgetedNet < 0 ? "warning.main" : "success.main"}
            >
              {budgetedNet >= 0 ? "+" : ""}${formatMoney(budgetedNet)}
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.6rem" }}>
              {budgetedOverdrawn
                ? `overdrawn by $${formatMoney(Math.abs(budgetedNet) - reserve)} beyond reserve`
                : budgetedNet < 0
                ? `draws $${formatMoney(Math.abs(budgetedNet))} from reserve`
                : "budget surplus"}
            </Typography>
          </Box>
        </Tooltip>
      </Stack>

      {reserveDip && (
        <Alert severity="error" icon={<WarningAmberIcon />} sx={{ mt: 1.5, fontSize: "0.8rem", py: 0.5 }}>
          Cash on Hand (${formatMoney(data.cash_amount)}) is below the Emergency Reserve (${formatMoney(reserve)}).
          You have drawn <strong>${formatMoney(reserve - data.cash_amount)}</strong> from emergency funds.
        </Alert>
      )}
      {budgetedOverdrawn && (
        <Alert severity="error" icon={<WarningAmberIcon />} sx={{ mt: 1, fontSize: "0.8rem", py: 0.5 }}>
          Budgeted expenses exceed budgeted revenue by <strong>${formatMoney(Math.abs(budgetedNet))}</strong>, which is more than the Emergency Reserve (${formatMoney(reserve)}). The chapter would be overdrawn by <strong>${formatMoney(Math.abs(budgetedNet) - reserve)}</strong> if all allocations are spent.
        </Alert>
      )}
      {!budgetedOverdrawn && budgetedNet < 0 && (
        <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mt: 1, fontSize: "0.8rem", py: 0.5 }}>
          Budget runs a <strong>${formatMoney(Math.abs(budgetedNet))}</strong> deficit — covered by the Emergency Reserve, leaving <strong>${formatMoney(reserve - Math.abs(budgetedNet))}</strong> remaining.
        </Alert>
      )}
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
  const [estimatedPledges, setEstimatedPledges] = useState(15);

  const load = useCallback(async (y: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBudgetSummary(y);
      setSummary(data);
      setEstimatedPledges(data.dues_config.estimated_pledges);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load budget");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(year); }, [year, load]);

  const handleSaveExpenseBudget = async (categoryId: number, amount: number) => {
    if (!canWrite) return;
    // Optimistic update
    setSummary((s) => s ? {
      ...s,
      expense_rows: s.expense_rows.map((r) =>
        r.category_id === categoryId ? { ...r, budgeted_amount: amount, remaining: amount - r.actual_amount } : r
      ),
    } : s);
    try {
      await saveExpenseAllocations(year, [{ category_id: categoryId, budgeted_amount: amount }]);
    } catch { await load(year); }
  };

  const handleSaveRevenueBudget = async (categoryId: number, amount: number) => {
    if (!canWrite) return;
    setSummary((s) => s ? {
      ...s,
      revenue_rows: s.revenue_rows.map((r) =>
        r.category_id === categoryId ? { ...r, budgeted_amount: amount } : r
      ),
    } : s);
    try {
      await saveRevenueAllocations(year, [{ category_id: categoryId, budgeted_amount: amount }]);
    } catch { await load(year); }
  };

  const handleSaveCbRate = async (rate: number) => {
    if (!summary || !canWrite) return;
    try {
      await saveDuesConfig(year, {
        estimated_pledges: estimatedPledges,
        chapter_bonus_monthly_rate: rate,
      });
      await load(year);
    } catch { /* ignore */ }
  };

  const handleSavePledges = async (n: number) => {
    if (!summary || !canWrite) return;
    setEstimatedPledges(n);
    try {
      await saveDuesConfig(year, {
        estimated_pledges: n,
        chapter_bonus_monthly_rate: summary.dues_config.chapter_bonus_monthly_rate,
      });
      await load(year);
    } catch { /* ignore */ }
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
            <Stack direction="row" spacing={1} alignItems="center">
              <SchoolYearSelector value={year} onChange={setYear} />
              <Button
                variant="outlined"
                startIcon={<PictureAsPdfOutlinedIcon />}
                onClick={() => window.open(`/budget/print?year=${year}&autoprint=1`, "_blank")}
              >
                Export PDF
              </Button>
            </Stack>
          </Stack>
        </Paper>

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

            <ReconciliationSection
              data={summary.reconciliation}
              canWrite={canWrite}
              year={year}
              revenueBudgeted={summary.totals.revenue.budgeted}
              expenseBudgeted={summary.totals.expense.budgeted}
              onSaved={(d) =>
                setSummary((s) => s ? { ...s, reconciliation: d } : s)
              }
            />

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <Box sx={{ flex: { md: "0 0 41.67%" }, minWidth: 0 }}>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{ letterSpacing: 1, color: "text.secondary", mb: 0.5, display: "block" }}
                >
                  REVENUE
                </Typography>
                <RevenueSection
                  rows={summary.revenue_rows}
                  duesConfig={summary.dues_config}
                  estimatedPledges={estimatedPledges}
                  onSavePledges={handleSavePledges}
                  canWrite={canWrite}
                  onSaveBudget={handleSaveRevenueBudget}
                  onSaveCbRate={handleSaveCbRate}
                  totals={summary.totals.revenue}
                />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{ letterSpacing: 1, color: "text.secondary", mb: 0.5, display: "block" }}
                >
                  EXPENSES
                </Typography>
                <ExpenseSection
                  rows={summary.expense_rows}
                  canWrite={canWrite}
                  onSaveBudget={handleSaveExpenseBudget}
                  totals={summary.totals.expense}
                />
              </Box>
            </Stack>
          </>
        )}
    </Stack>
  );
}

