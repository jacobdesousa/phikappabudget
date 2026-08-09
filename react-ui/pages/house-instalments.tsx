import { useCallback, useEffect, useState } from "react";
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
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { useAuth } from "../context/authContext";
import {
  deleteHousePayment,
  getHouseDeposits,
  getHousePayments,
  getHouseSummary,
} from "../services/houseService";
import {
  HouseSessionType,
  IHouseAssignment,
  IHouseDeposit,
  IHousePayment,
  IHouseResidentRow,
  IHouseSummary,
} from "../interfaces/api.interface";
import SchoolYearSelector from "../components/SchoolYearSelector";
import HouseSessionSelector from "../components/HouseSessionSelector";
import HousePaymentDialog from "../components/houseAssignment/housePaymentDialog";
import HouseDepositDialog from "../components/houseAssignment/houseDepositDialog";
import { schoolYearStartForDate } from "../utils/schoolYear";
import {
  depositStatusLabel,
  netRefund,
  instalmentLabel,
  sessionLabel,
  tintSx,
  tintSwatchSx,
  SUBTLE_CHIP_SX,
  TintColor,
} from "../utils/house";
import { formatMoney, roundMoney } from "../utils/money";

const CELL_SX = { py: 0.75 };
const HEAD_SX = { py: 1, fontWeight: 700, whiteSpace: "nowrap" as const };

export default function HouseInstalmentsPage() {
  const { can } = useAuth();
  const canWrite = can("house.write");

  const [year, setYear] = useState(schoolYearStartForDate(new Date()));
  const [session, setSession] = useState<HouseSessionType>("winter");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<IHouseSummary | null>(null);
  const [deposits, setDeposits] = useState<IHouseDeposit[]>([]);
  const [paymentsByBrother, setPaymentsByBrother] = useState<Record<number, IHousePayment[]>>({});
  const [expanded, setExpanded] = useState<number | null>(null);

  const [payingFor, setPayingFor] = useState<
    {
      brotherId: number;
      brotherName: string;
      assignments?: IHouseAssignment[];
      existing?: IHousePayment;
    } | undefined
  >(undefined);
  const [depositFor, setDepositFor] = useState<
    { brotherId: number; brotherName: string; existing?: IHouseDeposit } | undefined
  >(undefined);
  const [deletingPayment, setDeletingPayment] = useState<IHousePayment | undefined>(undefined);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, depositRows] = await Promise.all([
        getHouseSummary(year, session),
        getHouseDeposits(),
      ]);
      setSummary(summaryData);
      setDeposits(depositRows);
      setPaymentsByBrother({});
    } catch (e: any) {
      setSummary(null);
      setDeposits([]);
      setError(e?.message ?? "Could not load resident balances.");
    } finally {
      setLoading(false);
    }
  }, [year, session]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadPayments(brotherId: number) {
    const rows = await getHousePayments({ brother_id: brotherId, year, session });
    setPaymentsByBrother((prev) => ({ ...prev, [brotherId]: rows }));
  }

  async function toggleExpand(brotherId: number) {
    if (expanded === brotherId) {
      setExpanded(null);
      return;
    }
    setExpanded(brotherId);
    if (!paymentsByBrother[brotherId]) await loadPayments(brotherId);
  }

  async function handleDeletePayment() {
    if (!deletingPayment) return;
    setDeleteError(null);
    try {
      await deleteHousePayment(deletingPayment.id);
      const brotherId = deletingPayment.brother_id;
      setDeletingPayment(undefined);
      await Promise.all([load(), loadPayments(brotherId)]);
    } catch (e: any) {
      setDeleteError(e?.message ?? "Could not delete the payment.");
    }
  }

  // Overpaid is called out separately from settled: it means money to return or
  // carry forward, not a closed account. Everything else — on track but not
  // finished — stays untinted so "behind" actually stands out.
  function rowTint(r: IHouseResidentRow): TintColor | null {
    if (r.balance_total < 0) return "info";
    if (r.balance_total === 0) return "success";
    if (r.is_behind) return "error";
    return null;
  }

  const residents = summary?.residents ?? [];
  const totals = residents.reduce(
    (acc, r) => ({
      owed: roundMoney(acc.owed + r.total_owed),
      paid: roundMoney(acc.paid + r.total_paid),
      due: roundMoney(acc.due + r.due_to_date),
    }),
    { owed: 0, paid: 0, due: 0 }
  );

  return (
    <>
      {canWrite && payingFor && (
        <HousePaymentDialog
          year={year}
          session={session}
          brotherId={payingFor.brotherId}
          brotherName={payingFor.brotherName}
          assignments={payingFor.assignments}
          sessionConfig={summary?.session}
          existing={payingFor.existing}
          onClose={() => setPayingFor(undefined)}
          onSaved={async () => {
            const brotherId = payingFor.brotherId;
            setPayingFor(undefined);
            await Promise.all([load(), loadPayments(brotherId)]);
          }}
        />
      )}

      {canWrite && depositFor && (
        <HouseDepositDialog
          brotherId={depositFor.brotherId}
          brotherName={depositFor.brotherName}
          defaultAmount={Number(summary?.session?.security_deposit_amount ?? 500)}
          existing={depositFor.existing}
          onClose={() => setDepositFor(undefined)}
          onSaved={async () => {
            setDepositFor(undefined);
            await load();
          }}
        />
      )}

      {canWrite && deletingPayment && (
        <Dialog open onClose={() => setDeletingPayment(undefined)} fullWidth maxWidth="xs">
          <DialogTitle>Delete payment</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              {deleteError && <Alert severity="error">{deleteError}</Alert>}
              <Typography variant="body2">
                Delete the ${formatMoney(deletingPayment.amount)} payment from {deletingPayment.paid_at}?
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" onClick={() => setDeletingPayment(undefined)}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleDeletePayment}>Delete</Button>
          </DialogActions>
        </Dialog>
      )}

      <Stack spacing={2}>
        <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ sm: "center" }}
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="h5">Resident Instalments</Typography>
              <Typography variant="body2" color="text.secondary">
                Room fees owed, paid, and outstanding for {sessionLabel(year, session)}.
              </Typography>
            </Box>
            <Stack direction="row" spacing={2} alignItems="center">
              <HouseSessionSelector value={session} onChange={setSession} />
              <SchoolYearSelector value={year} onChange={setYear} />
            </Stack>
          </Stack>
        </Paper>

        {error && <Alert severity="error">{error}</Alert>}

        {!loading && residents.length > 0 && (
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ px: 0.5 }}>
            {([
              ["success", "Paid in full"],
              ["info", "Overpaid"],
              ["error", "Behind"],
            ] as const).map(([color, label]) => (
              <Stack key={color} direction="row" spacing={0.75} alignItems="center">
                <Box sx={tintSwatchSx(color)} />
                <Typography variant="caption" color="text.secondary">{label}</Typography>
              </Stack>
            ))}
          </Stack>
        )}

        {summary && summary.instalments.length > 0 && (
          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Instalment schedule</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {summary.instalments.map((i) => (
                <Chip
                  key={i.seq}
                  size="small"
                  label={`${instalmentLabel(i.seq)} · ${i.due_date ?? "no date"} · ${Number(i.weight_pct)}%`}
                  color={i.due_date && new Date(i.due_date) <= new Date() ? "primary" : "default"}
                  variant={i.due_date && new Date(i.due_date) <= new Date() ? "filled" : "outlined"}
                />
              ))}
            </Stack>
          </Paper>
        )}

        {loading ? (
          <CircularProgress />
        ) : residents.length === 0 ? (
          <Alert severity="info">
            No residents assigned for this session yet. Assign rooms on the House Residents page.
          </Alert>
        ) : (
          <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={HEAD_SX} />
                    <TableCell sx={HEAD_SX}>Resident</TableCell>
                    <TableCell sx={HEAD_SX}>Room</TableCell>
                    <TableCell sx={HEAD_SX} align="right">Owed</TableCell>
                    <TableCell sx={HEAD_SX} align="right">Due to date</TableCell>
                    <TableCell sx={HEAD_SX} align="right">Paid</TableCell>
                    <TableCell sx={HEAD_SX} align="right">Balance</TableCell>
                    <TableCell sx={HEAD_SX} align="right">Deposit</TableCell>
                    <TableCell sx={HEAD_SX} align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {residents.map((r) => {
                    const name = `${r.first_name} ${r.last_name}`;
                    // Exactly one deposit per resident — it carries over between years.
                    const openDeposit = deposits.find((d) => d.brother_id === r.brother_id);
                    return [
                      <TableRow key={r.brother_id} hover sx={tintSx(rowTint(r))}>
                        <TableCell sx={CELL_SX}>
                          <IconButton size="small" onClick={() => toggleExpand(r.brother_id)}>
                            {expanded === r.brother_id ? (
                              <KeyboardArrowUpIcon fontSize="small" />
                            ) : (
                              <KeyboardArrowDownIcon fontSize="small" />
                            )}
                          </IconButton>
                        </TableCell>
                        <TableCell sx={CELL_SX}>
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <span>{name}</span>
                          {r.brother_status === "Boarder" && (
                            <Chip
                              label="Boarder"
                              size="small"
                              variant="outlined"
                              sx={SUBTLE_CHIP_SX}
                            />
                          )}
                          </Stack>
                        </TableCell>
                        <TableCell sx={CELL_SX}>
                          {r.assignments.map((a) => a.room_code).join(", ")}
                        </TableCell>
                        <TableCell sx={CELL_SX} align="right">${formatMoney(r.total_owed)}</TableCell>
                        <TableCell sx={CELL_SX} align="right">${formatMoney(r.due_to_date)}</TableCell>
                        <TableCell sx={CELL_SX} align="right">${formatMoney(r.total_paid)}</TableCell>
                        <TableCell sx={CELL_SX} align="right">
                          {r.balance_total < 0 ? (
                            <Chip
                              size="small"
                              color="info"
                              label={`$${formatMoney(-r.balance_total)} credit`}
                              sx={{ height: 20, fontWeight: 600, "& .MuiChip-label": { px: 0.75 } }}
                            />
                          ) : (
                            `$${formatMoney(r.balance_total)}`
                          )}
                        </TableCell>
                        <TableCell sx={CELL_SX} align="right">
                          {/* Assigning a room always creates the deposit, so a
                              resident on this table always has one. Shown net of
                              deductions — click through for the itemisation. */}
                          {!openDeposit ? (
                            <Typography variant="caption" color="text.secondary">—</Typography>
                          ) : (
                            <Chip
                              size="small"
                              label={`$${formatMoney(netRefund(openDeposit))} ${depositStatusLabel(
                                openDeposit.status
                              )}`}
                              color={
                                openDeposit.status === "outstanding"
                                  ? "warning"
                                  : openDeposit.status === "received"
                                  ? "default"
                                  : "success"
                              }
                              onClick={
                                canWrite
                                  ? () =>
                                      setDepositFor({
                                        brotherId: r.brother_id,
                                        brotherName: name,
                                        existing: openDeposit,
                                      })
                                  : undefined
                              }
                            />
                          )}
                        </TableCell>
                        <TableCell sx={CELL_SX} align="right">
                          {canWrite && (
                            <Button
                              size="small"
                              startIcon={<AddIcon />}
                              onClick={() =>
                                setPayingFor({
                                  brotherId: r.brother_id,
                                  brotherName: name,
                                  assignments: r.assignments,
                                })
                              }
                            >
                              Payment
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>,

                      <TableRow key={`${r.brother_id}-detail`}>
                        <TableCell sx={{ py: 0, border: 0 }} colSpan={9}>
                          <Collapse in={expanded === r.brother_id} unmountOnExit>
                            <Box sx={{ py: 2, px: 1 }}>
                              {/* Show the working, so a figure can be checked
                                  against the fee schedule without guesswork. */}
                              <Typography variant="subtitle2">How this is calculated</Typography>
                              <Box
                                sx={{
                                  mb: 2,
                                  mt: 0.5,
                                  p: 1.5,
                                  borderRadius: 1,
                                  border: "1px solid",
                                  borderColor: "divider",
                                }}
                              >
                                {r.assignments.map((a) => (
                                  <Box key={a.id} sx={{ mb: 1, "&:last-of-type": { mb: 0 } }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                      {a.room_code}
                                      {a.capacity > 1 ? ` · bed ${a.bed}` : ""}
                                      {a.occupancy === "full_room" ? " · buy-out" : ""}
                                    </Typography>

                                    {a.amount_override != null ? (
                                      <Typography variant="caption" display="block" color="warning.main">
                                        Manual amount ${formatMoney(a.amount_override)} for the session
                                        {a.override_note ? ` — ${a.override_note}` : ""}
                                      </Typography>
                                    ) : (
                                      <Typography variant="caption" display="block" color="text.secondary">
                                        ${formatMoney(a.resolved_rate ?? 0)}/term × {a.terms} term
                                        {a.terms === 1 ? "" : "s"} = ${formatMoney(a.session_base)}
                                      </Typography>
                                    )}

                                    {a.rebate_amount > 0 && (
                                      <Typography variant="caption" display="block" color="text.secondary">
                                        − ${formatMoney(a.rebate_amount)} member rebate (
                                        {a.rebate_beds > 1 ? `${a.rebate_beds} beds × ` : ""}
                                        {a.terms} × ${formatMoney(a.rebate_per_term)})
                                      </Typography>
                                    )}

                                    {a.prepay_amount > 0 && (
                                      <Typography variant="caption" display="block" color="text.secondary">
                                        − ${formatMoney(a.prepay_amount)} pre-payment discount ({a.prepay_pct}%)
                                      </Typography>
                                    )}

                                    <Typography variant="caption" display="block" sx={{ fontWeight: 600 }}>
                                      = ${formatMoney(a.total_owed)}
                                      {a.start_date && a.end_date
                                        ? `  (${a.start_date} → ${a.end_date})`
                                        : ""}
                                    </Typography>
                                  </Box>
                                ))}

                                {r.assignments.length > 1 && (
                                  <Typography variant="body2" sx={{ fontWeight: 700, mt: 1 }}>
                                    Total owed ${formatMoney(r.total_owed)}
                                  </Typography>
                                )}
                              </Box>

                              <Typography variant="subtitle2">Instalments</Typography>
                              <Table size="small" sx={{ mb: 2 }}>
                                <TableHead>
                                  <TableRow>
                                    <TableCell sx={HEAD_SX}>Instalment</TableCell>
                                    <TableCell sx={HEAD_SX}>Due</TableCell>
                                    <TableCell sx={HEAD_SX} align="right">Amount</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {(summary?.instalments ?? []).map((i) => (
                                    <TableRow key={i.seq}>
                                      <TableCell sx={CELL_SX}>{instalmentLabel(i.seq)}</TableCell>
                                      <TableCell sx={CELL_SX}>{i.due_date ?? "—"}</TableCell>
                                      <TableCell sx={CELL_SX} align="right">
                                        ${formatMoney(roundMoney(r.total_owed * (Number(i.weight_pct) / 100)))}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>

                              <Typography variant="subtitle2">Payments</Typography>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell sx={HEAD_SX}>Date</TableCell>
                                    <TableCell sx={HEAD_SX} align="right">Amount</TableCell>
                                    <TableCell sx={HEAD_SX}>Memo</TableCell>
                                    <TableCell sx={HEAD_SX} align="right" />
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {(paymentsByBrother[r.brother_id] ?? []).length === 0 ? (
                                    <TableRow>
                                      <TableCell sx={CELL_SX} colSpan={4}>
                                        <Typography variant="caption" color="text.secondary">
                                          No payments recorded.
                                        </Typography>
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    (paymentsByBrother[r.brother_id] ?? []).map((p) => (
                                      <TableRow key={p.id}>
                                        <TableCell sx={CELL_SX}>{p.paid_at}</TableCell>
                                        <TableCell sx={CELL_SX} align="right">${formatMoney(p.amount)}</TableCell>
                                        <TableCell sx={CELL_SX}>{p.memo ?? "—"}</TableCell>
                                        <TableCell sx={CELL_SX} align="right">
                                          {canWrite && (
                                            <>
                                              <IconButton
                                                size="small"
                                                onClick={() =>
                                                  setPayingFor({
                                                    brotherId: r.brother_id,
                                                    brotherName: name,
                                                    existing: p,
                                                  })
                                                }
                                              >
                                                <EditOutlinedIcon fontSize="small" />
                                              </IconButton>
                                              <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => setDeletingPayment(p)}
                                              >
                                                <DeleteOutlineIcon fontSize="small" />
                                              </IconButton>
                                            </>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))
                                  )}
                                </TableBody>
                              </Table>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>,
                    ];
                  })}

                  <TableRow>
                    <TableCell sx={{ ...CELL_SX, fontWeight: 700 }} colSpan={3}>Total</TableCell>
                    <TableCell sx={{ ...CELL_SX, fontWeight: 700 }} align="right">${formatMoney(totals.owed)}</TableCell>
                    <TableCell sx={{ ...CELL_SX, fontWeight: 700 }} align="right">${formatMoney(totals.due)}</TableCell>
                    <TableCell sx={{ ...CELL_SX, fontWeight: 700 }} align="right">${formatMoney(totals.paid)}</TableCell>
                    <TableCell sx={{ ...CELL_SX, fontWeight: 700 }} align="right">
                      {roundMoney(totals.owed - totals.paid) < 0
                        ? `$${formatMoney(roundMoney(totals.paid - totals.owed))} credit`
                        : `$${formatMoney(roundMoney(totals.owed - totals.paid))}`}
                    </TableCell>
                    <TableCell sx={CELL_SX} colSpan={2} />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </Stack>
    </>
  );
}
