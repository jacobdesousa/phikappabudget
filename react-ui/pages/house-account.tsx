import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
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
  postDisbursementRevenue,
} from "../services/houseAccountService";
import {
  HouseSessionType,
  IHouseAccount,
  IHouseAccountAdjustment,
  IHouseDisbursement,
} from "../interfaces/api.interface";
import SchoolYearSelector from "../components/SchoolYearSelector";
import HouseSessionSelector from "../components/HouseSessionSelector";
import DisbursementDialog from "../components/houseAccount/disbursementDialog";
import AccountAdjustmentDialog from "../components/houseAccount/accountAdjustmentDialog";
import { schoolYearStartForDate } from "../utils/schoolYear";
import { sessionLabel, tintSx, tintSwatchSx, SUBTLE_CHIP_SX, TintColor } from "../utils/house";
import { formatMoney } from "../utils/money";

const CELL_SX = { py: 0.75 };
const HEAD_SX = { py: 1, fontWeight: 700, whiteSpace: "nowrap" as const };
const NUM_SX = { ...CELL_SX, textAlign: "right" as const, whiteSpace: "nowrap" as const };

export default function HouseAccountPage() {
  const { can } = useAuth();
  const canWrite = can("house.write");

  const [year, setYear] = useState(schoolYearStartForDate(new Date()));
  const [session, setSession] = useState<HouseSessionType>("winter");
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAccount(await getHouseAccount(year));
    } catch (e: any) {
      setError(e?.message ?? "Could not load the house account.");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  // The account is a single bank account; only the disbursement table is
  // session-scoped.
  const disbursements = (account?.disbursements ?? []).filter((d) => d.session_type === session);
  const payees = account?.payees ?? [];
  // Fall back to the payees seen on existing rows so a year with no config
  // still renders its history.
  const columnPayees = payees.length
    ? payees.map((p) => p.payee)
    : Array.from(new Set(disbursements.flatMap((d) => d.shares.map((s) => s.payee))));
  const internalPayee = payees.find((p) => p.is_internal)?.payee ?? null;
  const nextSeq =
    disbursements.reduce((max, d) => Math.max(max, d.seq ?? 0), 0) + 1;

  function statusTint(d: IHouseDisbursement): TintColor | null {
    return d.status === "disbursed" ? "success" : "warning";
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
          year={year}
          session={session}
          payees={account.payees}
          security={account.security}
          nextSeq={nextSeq}
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
          year={year}
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
              {deleting.label ?? `Disbursement #${deleting.id}`} and its payee shares will be
              removed.
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
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ sm: "center" }}
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="h5">House Account</Typography>
              <Typography variant="body2" color="text.secondary">
                Residence bank balance and disbursements for {sessionLabel(year, session)}.
              </Typography>
            </Box>
            <Stack direction="row" spacing={2} alignItems="center">
              <HouseSessionSelector value={session} onChange={setSession} />
              <SchoolYearSelector value={year} onChange={setYear} />
            </Stack>
          </Stack>
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
              <SummaryTile
                label="Account balance"
                value={account.balance.balance}
                hint="Fees + deposits − refunds − disbursements ± adjustments. Not session-specific."
              />
              <SummaryTile
                label="Deposits held"
                value={account.balance.deposits_held}
                hint={`${account.security.deposits_held_count} residents. Owed back, so never disbursed.`}
              />
              <SummaryTile
                label="Undisbursed surplus"
                value={account.balance.undisbursed_surplus}
                hint="Balance less deposits held — what is actually available to split."
              />
            </Stack>

            {account.payee_totals.length ? (
              <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Disbursed to date
                </Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                  {account.payee_totals.map((t) => (
                    <Chip
                      key={t.payee}
                      size="small"
                      variant="outlined"
                      label={`${t.payee}: $${formatMoney(t.total)}`}
                    />
                  ))}
                </Stack>
              </Paper>
            ) : null}

            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Box sx={tintSwatchSx("warning")} />
                <Typography variant="caption" color="text.secondary">
                  Estimated
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Box sx={tintSwatchSx("success")} />
                <Typography variant="caption" color="text.secondary">
                  Disbursed
                </Typography>
              </Stack>
              <Box sx={{ flexGrow: 1 }} />
              {canWrite ? (
                <Button size="small" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
                  Disbursement
                </Button>
              ) : null}
            </Stack>

            <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
              {disbursements.length === 0 ? (
                <Alert severity="info" sx={{ m: 2 }}>
                  No disbursements recorded for {sessionLabel(year, session)}.
                </Alert>
              ) : (
                <TableContainer sx={{ overflowX: "auto" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={HEAD_SX}>Disbursement</TableCell>
                        <TableCell sx={HEAD_SX}>Date</TableCell>
                        <TableCell sx={{ ...HEAD_SX, textAlign: "right" }}>Balance</TableCell>
                        <TableCell sx={{ ...HEAD_SX, textAlign: "right" }}>
                          Less security to refund
                        </TableCell>
                        <TableCell sx={{ ...HEAD_SX, textAlign: "right" }}>
                          Less security on account
                        </TableCell>
                        <TableCell sx={{ ...HEAD_SX, textAlign: "right" }}>Sub-total</TableCell>
                        {columnPayees.map((p) => (
                          <TableCell key={p} sx={{ ...HEAD_SX, textAlign: "right" }}>
                            {p}
                          </TableCell>
                        ))}
                        <TableCell sx={HEAD_SX} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {disbursements.map((d) => (
                        <TableRow key={d.id} sx={tintSx(statusTint(d))}>
                          <TableCell sx={CELL_SX}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body2">
                                {d.label ?? `#${d.seq ?? d.id}`}
                              </Typography>
                              {d.status === "estimated" ? (
                                <Chip size="small" variant="outlined" sx={SUBTLE_CHIP_SX} label="estimated" />
                              ) : null}
                            </Stack>
                            {d.notes ? (
                              <Typography variant="caption" color="text.secondary">
                                {d.notes}
                              </Typography>
                            ) : null}
                          </TableCell>
                          <TableCell sx={CELL_SX}>{d.disbursed_on ?? "—"}</TableCell>
                          <TableCell sx={NUM_SX}>${formatMoney(d.bank_balance)}</TableCell>
                          <TableCell sx={NUM_SX}>${formatMoney(d.security_to_refund)}</TableCell>
                          <TableCell sx={NUM_SX}>${formatMoney(d.security_on_account)}</TableCell>
                          <TableCell sx={{ ...NUM_SX, fontWeight: 700 }}>
                            ${formatMoney(d.sub_total)}
                          </TableCell>
                          {columnPayees.map((p) => {
                            const share = d.shares.find((s) => s.payee === p);
                            if (!share) {
                              return (
                                <TableCell key={p} sx={NUM_SX}>
                                  —
                                </TableCell>
                              );
                            }
                            const postable =
                              canWrite &&
                              d.status === "disbursed" &&
                              share.revenue_id === null &&
                              p === internalPayee;
                            return (
                              <TableCell key={p} sx={NUM_SX}>
                                <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                                  <Box>
                                    <Typography variant="body2">
                                      ${formatMoney(share.amount)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      ${formatMoney(share.running_total)} total
                                    </Typography>
                                  </Box>
                                  {share.revenue_id !== null ? (
                                    <Chip
                                      size="small"
                                      variant="outlined"
                                      sx={SUBTLE_CHIP_SX}
                                      label="posted"
                                    />
                                  ) : null}
                                  {postable ? (
                                    <Tooltip title="Post this share to revenue">
                                      <IconButton size="small" onClick={() => handlePost(d)}>
                                        <PostAddOutlinedIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  ) : null}
                                </Stack>
                              </TableCell>
                            );
                          })}
                          <TableCell sx={{ ...CELL_SX, whiteSpace: "nowrap" }}>
                            {canWrite ? (
                              <>
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
                      ))}
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
                  None recorded for {year}.
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
                          <TableCell sx={CELL_SX}>{a.description ?? "—"}</TableCell>
                          <TableCell
                            sx={{ ...NUM_SX, color: Number(a.amount) < 0 ? "error.main" : undefined }}
                          >
                            ${formatMoney(a.amount)}
                          </TableCell>
                          <TableCell sx={{ ...CELL_SX, whiteSpace: "nowrap" }}>
                            {canWrite ? (
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
          </>
        )}
      </Stack>
    </>
  );
}

function SummaryTile(props: { label: string; value: number; hint: string }) {
  return (
    <Paper
      elevation={0}
      sx={{ p: 2, flex: 1, border: "1px solid", borderColor: "divider" }}
    >
      <Typography variant="caption" color="text.secondary">
        {props.label}
      </Typography>
      <Typography variant="h5">${formatMoney(props.value)}</Typography>
      <Typography variant="caption" color="text.secondary">
        {props.hint}
      </Typography>
    </Paper>
  );
}
