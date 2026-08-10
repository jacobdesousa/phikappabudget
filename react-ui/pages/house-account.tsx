import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
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
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PostAddOutlinedIcon from "@mui/icons-material/PostAddOutlined";
import { useAuth } from "../context/authContext";
import {
  deleteAccountAdjustment,
  deleteDisbursement,
  getHouseAccount,
  getHouseTransactions,
  postDisbursementRevenue,
} from "../services/houseAccountService";
import {
  IHouseAccount,
  IHouseAccountAdjustment,
  IHouseDisbursement,
  IHouseTransaction,
  IHouseTransactionPage,
} from "../interfaces/api.interface";
import DisbursementDialog from "../components/houseAccount/disbursementDialog";
import AccountAdjustmentDialog from "../components/houseAccount/accountAdjustmentDialog";
import { schoolYearLabel } from "../utils/schoolYear";
import { sessionLabel } from "../utils/house";
import { formatMoney } from "../utils/money";

const CELL_SX = { py: 0.75 };
const HEAD_SX = { py: 1, fontWeight: 700, whiteSpace: "nowrap" as const };
const NUM_SX = { ...CELL_SX, textAlign: "right" as const, whiteSpace: "nowrap" as const };

export default function HouseAccountPage() {
  const { can } = useAuth();
  const canWrite = can("house.write");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<IHouseAccount | null>(null);

  const [editing, setEditing] = useState<IHouseDisbursement | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<IHouseDisbursement | null>(null);
  const [editingAdjustment, setEditingAdjustment] = useState<IHouseAccountAdjustment | null>(null);
  const [creatingAdjustment, setCreatingAdjustment] = useState(false);
  const [deletingAdjustment, setDeletingAdjustment] = useState<IHouseAccountAdjustment | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [txPage, setTxPage] = useState(0);
  const [txRowsPerPage, setTxRowsPerPage] = useState(25);
  const [transactions, setTransactions] = useState<IHouseTransactionPage | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAccount(await getHouseAccount());
    } catch (e: any) {
      setError(e?.message ?? "Could not load the house account.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Paged separately from the rest of the page: changing page shouldn't refetch
  // the balance, and a mutation elsewhere should refresh the ledger.
  const loadTransactions = useCallback(async () => {
    try {
      setTransactions(await getHouseTransactions(txRowsPerPage, txPage * txRowsPerPage));
    } catch (e: any) {
      setError(e?.message ?? "Could not load transactions.");
    }
  }, [txPage, txRowsPerPage]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions, account]);

  const disbursements = account?.disbursements ?? [];
  const payees = account?.payees ?? [];
  // Columns span every payee that appears anywhere in the history, plus any
  // newly configured one — a year whose split has since changed still renders.
  //
  // The header percentage comes from the current config, falling back to the
  // most recent share for a payee no longer configured. Historical rows keep
  // whatever pct they were created with, so a row can legitimately not match
  // the header if the split has since been changed.
  const columnPayees = Array.from(
    new Set([
      ...payees.map((p) => p.payee),
      ...disbursements.flatMap((d) => d.shares.map((s) => s.payee)),
    ])
  ).map((payee) => {
    const configured = payees.find((p) => p.payee === payee);
    const lastShare = [...disbursements]
      .reverse()
      .flatMap((d) => d.shares)
      .find((s) => s.payee === payee);
    const pct = Number(configured?.pct ?? lastShare?.pct);
    return { payee, pct: Number.isFinite(pct) ? pct : null };
  });
  const internalPayee = payees.find((p) => p.is_internal)?.payee ?? null;

  // Rows are grouped under a school-year subheader; ordering already comes from
  // the server, so grouping only has to preserve it.
  const byYear = disbursements.reduce<Record<number, IHouseDisbursement[]>>((acc, d) => {
    (acc[d.school_year] ??= []).push(d);
    return acc;
  }, {});
  const years = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => a - b);


  // The chapter's own share, and only while it hasn't been booked yet. Deleting
  // the revenue entry clears revenue_id server-side, so the action returns.
  function internalShare(d: IHouseDisbursement) {
    if (!internalPayee) return null;
    return d.shares.find((s) => s.payee === internalPayee && s.revenue_id === null) ?? null;
  }

  async function handlePost(d: IHouseDisbursement) {
    setActionError(null);
    try {
      await postDisbursementRevenue(d.id);
      await load();
    } catch (e: any) {
      setActionError(e?.message ?? "Could not post the share to revenue.");
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setActionError(null);
    try {
      await deleteDisbursement(deleting.id);
      setDeleting(null);
      await load();
    } catch (e: any) {
      setActionError(e?.message ?? "Could not delete the disbursement.");
    }
  }

  async function handleDeleteAdjustment() {
    if (!deletingAdjustment) return;
    setActionError(null);
    try {
      await deleteAccountAdjustment(deletingAdjustment.id);
      setDeletingAdjustment(null);
      await load();
    } catch (e: any) {
      setActionError(e?.message ?? "Could not delete the adjustment.");
    }
  }

  return (
    <>
      {canWrite && (creating || editing) && account ? (
        <DisbursementDialog
          payees={account.payees}
          security={account.security}
          derivedBalance={account.balance.balance}
          existing={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setCreating(false);
            setEditing(null);
            await load();
          }}
        />
      ) : null}

      {canWrite && (creatingAdjustment || editingAdjustment) ? (
        <AccountAdjustmentDialog
          existing={editingAdjustment ?? undefined}
          onClose={() => {
            setCreatingAdjustment(false);
            setEditingAdjustment(null);
          }}
          onSaved={async () => {
            setCreatingAdjustment(false);
            setEditingAdjustment(null);
            await load();
          }}
        />
      ) : null}

      {canWrite && deleting ? (
        <Dialog open fullWidth maxWidth="xs" onClose={() => setDeleting(null)}>
          <DialogTitle>Delete disbursement?</DialogTitle>
          <DialogContent dividers>
            {actionError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {actionError}
              </Alert>
            ) : null}
            <Typography variant="body2">
              The disbursement of {deleting.disbursed_on} and its payee shares will be removed.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleting(null)}>Cancel</Button>
            <Button color="error" variant="contained" onClick={handleDelete}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}

      {canWrite && deletingAdjustment ? (
        <Dialog open fullWidth maxWidth="xs" onClose={() => setDeletingAdjustment(null)}>
          <DialogTitle>Delete adjustment?</DialogTitle>
          <DialogContent dividers>
            {actionError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {actionError}
              </Alert>
            ) : null}
            <Typography variant="body2">
              {deletingAdjustment.description ?? `Adjustment #${deletingAdjustment.id}`} will be
              removed from the account.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeletingAdjustment(null)}>Cancel</Button>
            <Button color="error" variant="contained" onClick={handleDeleteAdjustment}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}

      <Stack spacing={2}>
        <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          {/* No year or session selector: the balance was never scoped to one,
              and the full history is short enough to read in one pass. */}
          <Typography variant="h5">House Account</Typography>
          <Typography variant="body2" color="text.secondary">
            Residence bank balance and every disbursement on record, as of today
            {account ? ` — ${sessionLabel(account.security.as_of_year, account.security.as_of_session)}` : ""}.
          </Typography>
        </Paper>

        {error ? <Alert severity="error">{error}</Alert> : null}
        {actionError && !deleting && !deletingAdjustment ? (
          <Alert severity="error" onClose={() => setActionError(null)}>
            {actionError}
          </Alert>
        ) : null}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : !account ? null : (
          <>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <SummaryTile label="Account balance" value={account.balance.balance} />
              <SummaryTile
                label="Deposits to refund"
                value={account.security.to_refund}
                hint={`${account.security.to_refund_count} deposits for residents past move out date.`}
              />
              <SummaryTile
                label="Current deposits held"
                value={account.security.held}
                hint={`${account.security.held_count} deposits for current or future residents.`}
              />
              <SummaryTile
                label="Undisbursed surplus"
                value={account.balance.undisbursed_surplus}
                hint="Balance less deposits held — what is actually available to disburse."
              />
            </Stack>

            {/* Same shape as Adjustments below: titled box, description, and
                its own add button in the header row. */}
            <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Box>
                  <Typography variant="subtitle1">Disbursements</Typography>
                  <Typography variant="body2" color="text.secondary">
                    The balance split between the payees each time money leaves the account.
                  </Typography>
                </Box>
                {canWrite ? (
                  <Button size="small" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
                    Disbursement
                  </Button>
                ) : null}
              </Stack>
              {disbursements.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  None recorded.
                </Typography>
              ) : (
                <TableContainer sx={{ overflowX: "auto" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={HEAD_SX}>Disbursed</TableCell>
                        <TableCell sx={{ ...HEAD_SX, textAlign: "right" }}>Balance</TableCell>
                        <TableCell sx={{ ...HEAD_SX, textAlign: "right" }}>
                          Less deposits to refund
                        </TableCell>
                        <TableCell sx={{ ...HEAD_SX, textAlign: "right" }}>
                          Less deposits held
                        </TableCell>
                        <TableCell sx={{ ...HEAD_SX, textAlign: "right" }}>Sub-total</TableCell>
                        {columnPayees.map(({ payee, pct }) => (
                          <TableCell key={payee} sx={{ ...HEAD_SX, textAlign: "right" }}>
                            {payee}
                            {pct === null ? "" : ` (${pct}%)`}
                          </TableCell>
                        ))}
                        <TableCell sx={HEAD_SX} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {years.map((y) => [
                        <TableRow key={`year-${y}`}>
                          <TableCell
                            colSpan={5 + columnPayees.length + 1}
                            sx={{
                              ...CELL_SX,
                              fontWeight: 700,
                              bgcolor: "action.hover",
                              position: "sticky",
                              left: 0,
                            }}
                          >
                            {schoolYearLabel(y)}
                          </TableCell>
                        </TableRow>,
                        ...byYear[y].map((d) => (
                        <TableRow key={d.id}>
                          <TableCell sx={CELL_SX}>
                            <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                              {d.disbursed_on}
                            </Typography>
                            {d.notes ? (
                              <Typography variant="caption" color="text.secondary">
                                {d.notes}
                              </Typography>
                            ) : null}
                          </TableCell>
                          <TableCell sx={NUM_SX}>${formatMoney(d.bank_balance)}</TableCell>
                          <TableCell sx={NUM_SX}>${formatMoney(d.security_to_refund)}</TableCell>
                          <TableCell sx={NUM_SX}>${formatMoney(d.security_on_account)}</TableCell>
                          <TableCell sx={{ ...NUM_SX, fontWeight: 700 }}>
                            ${formatMoney(d.sub_total)}
                          </TableCell>
                          {columnPayees.map(({ payee }) => {
                            const share = d.shares.find((s) => s.payee === payee);
                            if (!share) {
                              return (
                                <TableCell key={payee} sx={NUM_SX}>
                                  —
                                </TableCell>
                              );
                            }
                            // Money columns hold nothing but money, so every
                            // figure right-aligns under its header. Actions live
                            // in the actions column.
                            return (
                              <TableCell key={payee} sx={NUM_SX}>
                                <Typography variant="body2">
                                  ${formatMoney(share.amount)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                  ${formatMoney(share.running_total)} YTD
                                </Typography>
                                {share.cheque_number ? (
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    cheque #{share.cheque_number}
                                  </Typography>
                                ) : null}
                                {share.revenue_id !== null ? (
                                  <Typography variant="caption" color="success.main" display="block">
                                    posted
                                  </Typography>
                                ) : null}
                              </TableCell>
                            );
                          })}
                          <TableCell sx={{ ...CELL_SX, whiteSpace: "nowrap" }}>
                            {canWrite ? (
                              <>
                                {internalShare(d) ? (
                                  <Tooltip
                                    title={`Post the ${internalPayee} share to revenue`}
                                  >
                                    <IconButton size="small" onClick={() => handlePost(d)}>
                                      <PostAddOutlinedIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                ) : null}
                                <IconButton size="small" onClick={() => setEditing(d)}>
                                  <EditOutlinedIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={() => setDeleting(d)}>
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </>
                            ) : null}
                          </TableCell>
                        </TableRow>
                        )),
                      ])}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>

            <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Box>
                  <Typography variant="subtitle1">Adjustments</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Anything through the account that isn&apos;t a fee, deposit, or disbursement.
                  </Typography>
                </Box>
                {canWrite ? (
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => setCreatingAdjustment(true)}
                  >
                    Adjustment
                  </Button>
                ) : null}
              </Stack>
              {account.adjustments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  None recorded.
                </Typography>
              ) : (
                <TableContainer sx={{ overflowX: "auto" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={HEAD_SX}>Date</TableCell>
                        <TableCell sx={HEAD_SX}>Description</TableCell>
                        <TableCell sx={{ ...HEAD_SX, textAlign: "right" }}>Amount</TableCell>
                        <TableCell sx={HEAD_SX} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {account.adjustments.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell sx={CELL_SX}>{a.occurred_on}</TableCell>
                          <TableCell sx={CELL_SX}>
                            {a.description ?? "—"}
                            {a.disbursement_id !== null ? (
                              <Typography variant="caption" color="text.secondary" display="block">
                                automatic — recalculated with its disbursement
                              </Typography>
                            ) : null}
                          </TableCell>
                          <TableCell
                            sx={{ ...NUM_SX, color: Number(a.amount) < 0 ? "error.main" : undefined }}
                          >
                            ${formatMoney(a.amount)}
                          </TableCell>
                          <TableCell sx={{ ...CELL_SX, whiteSpace: "nowrap" }}>
                            {/* An automatic reconciliation is owned by its
                                disbursement: editing it here would be undone the
                                next time that disbursement is saved. */}
                            {canWrite && a.disbursement_id === null ? (
                              <>
                                <IconButton size="small" onClick={() => setEditingAdjustment(a)}>
                                  <EditOutlinedIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={() => setDeletingAdjustment(a)}>
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>

            <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle1">Transactions</Typography>
                <Typography variant="body2" color="text.secondary">
                  Every movement through the account — fees, deposits, refunds, disbursements and
                  adjustments — newest first.
                </Typography>
              </Box>
              {!transactions || transactions.total === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nothing recorded.
                </Typography>
              ) : (
                <>
                  <TableContainer sx={{ overflowX: "auto" }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={HEAD_SX}>Date</TableCell>
                          <TableCell sx={HEAD_SX}>Type</TableCell>
                          <TableCell sx={HEAD_SX}>Detail</TableCell>
                          <TableCell sx={HEAD_SX}>Cheque #</TableCell>
                          <TableCell sx={{ ...HEAD_SX, textAlign: "right" }}>Amount</TableCell>
                          <TableCell sx={{ ...HEAD_SX, textAlign: "right" }}>Balance</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {transactions.transactions.map((t) => (
                          <TableRow key={`${t.kind}-${t.source_id}`}>
                            <TableCell sx={{ ...CELL_SX, whiteSpace: "nowrap" }}>
                              {t.occurred_on}
                            </TableCell>
                            <TableCell sx={CELL_SX}>{TX_LABELS[t.kind]}</TableCell>
                            <TableCell sx={CELL_SX}>
                              {t.counterparty ?? t.detail ?? "—"}
                              {t.counterparty && t.detail ? (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {t.detail}
                                </Typography>
                              ) : null}
                            </TableCell>
                            <TableCell sx={CELL_SX}>{t.cheque_number ?? "—"}</TableCell>
                            <TableCell
                              sx={{ ...NUM_SX, color: t.amount < 0 ? "error.main" : undefined }}
                            >
                              {t.amount < 0 ? "−" : ""}${formatMoney(Math.abs(t.amount))}
                            </TableCell>
                            <TableCell sx={NUM_SX}>${formatMoney(t.running_balance)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    component="div"
                    count={transactions.total}
                    page={txPage}
                    onPageChange={(_e, next) => setTxPage(next)}
                    rowsPerPage={txRowsPerPage}
                    onRowsPerPageChange={(e) => {
                      setTxRowsPerPage(Number(e.target.value));
                      setTxPage(0);
                    }}
                    rowsPerPageOptions={[25, 50, 100]}
                  />
                </>
              )}
            </Paper>
          </>
        )}
      </Stack>
    </>
  );
}

const TX_LABELS: Record<IHouseTransaction["kind"], string> = {
  payment: "Fee payment",
  deposit: "Deposit received",
  deposit_refund: "Deposit refund",
  disbursement: "Disbursement",
  adjustment: "Adjustment",
};

function SummaryTile(props: { label: string; value: number; hint?: string }) {
  return (
    <Paper
      elevation={0}
      sx={{ p: 2, flex: 1, border: "1px solid", borderColor: "divider" }}
    >
      <Typography variant="caption" color="text.secondary">
        {props.label}
      </Typography>
      <Typography variant="h5">${formatMoney(props.value)}</Typography>
      {props.hint ? (
        <Typography variant="caption" color="text.secondary">
          {props.hint}
        </Typography>
      ) : null}
    </Paper>
  );
}
