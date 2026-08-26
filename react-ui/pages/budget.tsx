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
  IBudgetHouseRebate,
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
import SaveIndicator from "../components/SaveIndicator";
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
  // The editor replaces the whole cell, so it has to fit the Budgeted column on
  // its own — the units live in the adornments rather than a separate label.
  return (
    <TableCell sx={{ py: "1px", px: "2px" }}>
      <TextField
        autoFocus
        fullWidth
        size="small"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onSaveRate(parseFloat(draft) || 0); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        inputProps={{
          style: { fontSize: "0.65rem", padding: "2px 0", textAlign: "right", minWidth: 0 },
          title: "Chapter Bonus rate per month",
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start" sx={{ mr: 0, "& p": { fontSize: "0.6rem" } }}>$</InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end" sx={{ ml: "1px", "& p": { fontSize: "0.6rem" } }}>/mo</InputAdornment>
          ),
        }}
        variant="outlined"
        sx={{ "& .MuiOutlinedInput-root": { pl: "4px", pr: "4px" } }}
      />
    </TableCell>
  );
}

// The House Fee Rebate is derived from the house tables, so its Budgeted cell is
// read-only — the breakdown behind the number lives in the expand row.
function HouseRebateBudgetedCell({ rebate }: { rebate: IBudgetHouseRebate }) {
  return (
    <Tooltip
      title={`$${formatMoney(rebate.fees_total)} of residence fees × ${rebate.pct}%${
        rebate.payee ? ` (${rebate.payee})` : ""
      } — expand the row for the breakdown`}
    >
      <TableCell align="right" sx={{ ...CELL_SX, fontStyle: "italic" }}>
        ${formatMoney(rebate.budgeted)}
      </TableCell>
    </Tooltip>
  );
}

function RevenueSection({
  rows,
  duesConfig,
  houseRebate,
  estimatedPledges,
  onSavePledges,
  canWrite,
  onSaveBudget,
  onSaveCbRate,
  totals,
}: {
  rows: IBudgetRevenueRow[];
  duesConfig: IBudgetDuesConfig;
  houseRebate: IBudgetHouseRebate;
  estimatedPledges: number;
  onSavePledges: (n: number) => void;
  canWrite: boolean;
  onSaveBudget: (categoryId: number, amount: number) => void;
  onSaveCbRate: (rate: number) => void;
  totals: { budgeted: number; actual: number };
}) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const toggle = (id: number) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  // Pin the derived categories to the top — Dues, Chapter Bonus, House Fee
  // Rebate, then the carry-over — and leave the rest alphabetical.
  const pinOrder = (r: IBudgetRevenueRow) =>
    r.is_dues ? 0 : r.is_chapter_bonus ? 1 : r.is_house_rebate ? 2 : r.is_carryover ? 3 : 4;
  const sorted = [...rows].sort((a, b) => pinOrder(a) - pinOrder(b));

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Table size="small" sx={{ tableLayout: "fixed" }}>
        <TableHead>
          <TableRow sx={{ bgcolor: "action.hover" }}>
            <TableCell sx={{ ...HEAD_SX, width: 24 }} />
            <TableCell sx={HEAD_SX}>Revenue Category</TableCell>
            <TableCell align="right" sx={{ ...HEAD_SX, width: 96 }}>Budgeted</TableCell>
            <TableCell align="right" sx={{ ...HEAD_SX, width: 72 }}>Actual</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((r) => {
            const showExpand = r.is_dues
              ? duesConfig.active_count > 0 || duesConfig.estimated_pledges > 0
              : r.is_house_rebate
              ? houseRebate.sessions.length > 0 || r.entries.length > 0
              : r.entries.length > 0;
            const pinned = r.is_dues || r.is_chapter_bonus || r.is_house_rebate || r.is_carryover;
            return (
              <>
                <TableRow key={r.category_id} hover sx={pinned ? { bgcolor: "action.selected" } : undefined}>
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
                      {r.is_house_rebate && (
                        <Tooltip title="Auto-calculated: total residence fees × the chapter's disbursement percentage">
                          <AutoAwesomeIcon sx={{ fontSize: 11, color: "text.disabled" }} />
                        </Tooltip>
                      )}
                      {r.is_carryover && (
                        <Tooltip title="Cash left in the bank at the end of last school year — carried forward so the account balance stays continuous">
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
                  ) : r.is_house_rebate ? (
                    <HouseRebateBudgetedCell rebate={houseRebate} />
                  ) : r.is_carryover ? (
                    <MoneyCell value={r.budgeted_amount} sx={{ fontStyle: "italic" }} />
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
                              <TableCell align="right" sx={{ ...CELL_SX, width: 96, color: "text.secondary" }}>
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
                              <TableCell align="right" sx={{ ...CELL_SX, width: 96, color: "text.secondary" }}>
                                ${formatMoney(estimatedPledges * duesConfig.dues_rate_pledge)}
                              </TableCell>
                              <TableCell sx={{ ...CELL_SX, width: 72 }} />
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ ...CELL_SX, width: 24 }} />
                              <TableCell sx={{ ...CELL_SX, color: "text.secondary", borderTop: "1px solid", borderColor: "divider" }}>
                                Collected ({duesConfig.payments_count} payment
                                {duesConfig.payments_count === 1 ? "" : "s"} on the dues page)
                              </TableCell>
                              <TableCell sx={{ ...CELL_SX, width: 96, borderTop: "1px solid", borderColor: "divider" }} />
                              <TableCell align="right" sx={{ ...CELL_SX, width: 72, color: "text.secondary", borderTop: "1px solid", borderColor: "divider" }}>
                                ${formatMoney(duesConfig.payments_total)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                )}
                {/* House Fee Rebate breakdown sub-rows */}
                {r.is_house_rebate && houseRebate.sessions.length > 0 && (
                  <TableRow key={`${r.category_id}-rebate-breakdown`}>
                    <TableCell colSpan={4} sx={{ p: 0, border: 0 }}>
                      <Collapse in={!!expanded[r.category_id]} timeout="auto" unmountOnExit>
                        <Table size="small" sx={{ bgcolor: "action.hover", tableLayout: "fixed" }}>
                          <TableBody>
                            {houseRebate.sessions.map((sess) => (
                              <TableRow key={sess.session_type}>
                                <TableCell sx={{ ...CELL_SX, width: 24 }} />
                                <TableCell sx={{ ...CELL_SX, color: "text.secondary" }}>
                                  {sess.session_type.charAt(0).toUpperCase() + sess.session_type.slice(1)} fees
                                  {" "}({sess.assignments} assignment{sess.assignments === 1 ? "" : "s"})
                                </TableCell>
                                <TableCell align="right" sx={{ ...CELL_SX, width: 96, color: "text.secondary" }}>
                                  ${formatMoney(sess.fees_total)}
                                </TableCell>
                                <TableCell sx={{ ...CELL_SX, width: 72 }} />
                              </TableRow>
                            ))}
                            <TableRow>
                              <TableCell sx={{ ...CELL_SX, width: 24 }} />
                              <TableCell sx={{ ...CELL_SX, color: "text.secondary", fontWeight: 700 }}>
                                Total residence fees
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{ ...CELL_SX, width: 96, color: "text.secondary", fontWeight: 700,
                                      borderTop: "1px solid", borderColor: "divider" }}
                              >
                                ${formatMoney(houseRebate.fees_total)}
                              </TableCell>
                              <TableCell sx={{ ...CELL_SX, width: 72 }} />
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ ...CELL_SX, width: 24 }} />
                              <TableCell sx={{ ...CELL_SX, color: "text.secondary" }}>
                                × {houseRebate.pct}% chapter share
                                {houseRebate.payee ? ` (${houseRebate.payee})` : ""}
                              </TableCell>
                              <TableCell align="right" sx={{ ...CELL_SX, width: 96, color: "text.secondary", fontWeight: 700 }}>
                                ${formatMoney(houseRebate.budgeted)}
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
            <TableCell align="right" sx={{ ...TOTAL_SX, width: 96 }}>${formatMoney(totals.budgeted)}</TableCell>
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
  // The prior-year carry-over pins to the top, the same way the derived
  // categories do on the revenue side.
  const sorted = [...rows].sort((a, b) => Number(!!b.is_carryover) - Number(!!a.is_carryover));
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
          {sorted.map((r) => (
            <TableRow key={r.category_id} hover sx={r.is_carryover ? { bgcolor: "action.selected" } : undefined}>
              <TableCell sx={CELL_SX}>
                <Stack direction="row" alignItems="center" gap={0.5}>
                  <span>{r.category_name}</span>
                  {r.is_carryover && (
                    <Tooltip title="Overspend carried in from last school year — the bank account doesn't reset in September, so it stays on the books">
                      <AutoAwesomeIcon sx={{ fontSize: 11, color: "text.disabled" }} />
                    </Tooltip>
                  )}
                </Stack>
              </TableCell>
              <MoneyCell value={r.prior_year_actual} sx={{ color: "text.secondary" }} />
              {r.is_carryover ? (
                <MoneyCell value={r.budgeted_amount} sx={{ fontStyle: "italic" }} />
              ) : (
                <InlineBudgetCell
                  value={r.budgeted_amount}
                  canWrite={canWrite}
                  onSave={(v) => onSaveBudget(r.category_id, v)}
                />
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
  revenueBudgeted,
  expenseBudgeted,
  onSaveReserve,
  onSaved,
}: {
  data: IBudgetReconciliation;
  canWrite: boolean;
  year: number;
  revenueBudgeted: number;
  expenseBudgeted: number;
  onSaveReserve: (value: number) => Promise<void>;
  onSaved: (d: IBudgetReconciliation) => void;
}) {
  const [reserve, setReserve] = useState(data.emergency_reserve);

  useEffect(() => {
    setReserve(data.emergency_reserve);
  }, [data.emergency_reserve]);

  const handleReserveBlur = async (raw: string) => {
    const val = parseFloat(raw) || 0;
    setReserve(val);
    if (!canWrite) return;
    try {
      await onSaveReserve(val);
      onSaved({
        ...data,
        emergency_reserve: val,
        bank_balance: data.cash_amount + val,
      });
    } catch {
      // runSave surfaces the message; leave the field showing what was typed.
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
  // Every editable figure on this page saves as soon as it is committed, with
  // no Save button — so it has to say so. Tracked page-wide rather than per
  // field: only one save is ever in flight, and a spinner per cell would be
  // noisier than the edit itself.
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Two of these handlers previously swallowed their errors outright, so a
  // failed save looked identical to a successful one.
  const runSave = useCallback(async (fn: () => Promise<void>) => {
    setSaving(true);
    setSaveError(null);
    try {
      await fn();
      setSavedAt(new Date());
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Could not save that change.");
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

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
      await runSave(() => saveExpenseAllocations(year, [{ category_id: categoryId, budgeted_amount: amount }]));
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
      await runSave(() => saveRevenueAllocations(year, [{ category_id: categoryId, budgeted_amount: amount }]));
    } catch { await load(year); }
  };

  const handleSaveCbRate = async (rate: number) => {
    if (!summary || !canWrite) return;
    try {
      await runSave(() => saveDuesConfig(year, {
        estimated_pledges: estimatedPledges,
        chapter_bonus_monthly_rate: rate,
      }));
      await load(year);
    } catch { /* surfaced by runSave */ }
  };

  const handleSavePledges = async (n: number) => {
    if (!summary || !canWrite) return;
    setEstimatedPledges(n);
    try {
      await runSave(() => saveDuesConfig(year, {
        estimated_pledges: n,
        chapter_bonus_monthly_rate: summary.dues_config.chapter_bonus_monthly_rate,
      }));
      await load(year);
    } catch { /* surfaced by runSave */ }
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
              <SaveIndicator saving={saving} savedAt={savedAt} />
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
        {saveError && (
          <Alert severity="error" onClose={() => setSaveError(null)}>
            {saveError}
          </Alert>
        )}

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
              onSaveReserve={(v) => runSave(() => saveReconciliation(year, v))}
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
                  houseRebate={summary.house_rebate}
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

