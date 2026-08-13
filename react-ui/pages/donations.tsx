import { useCallback, useEffect, useMemo, useState } from "react";
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
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import SearchIcon from "@mui/icons-material/Search";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { useAuth } from "../context/authContext";
import {
  IBrother,
  IDonation,
  IDonationCampaign,
  IDonationSummary,
  IDonorSummary,
} from "../interfaces/api.interface";
import { getAllBrothers } from "../services/brotherService";
import {
  deleteDonation,
  getDonations,
  getDonationSummary,
  type DonationFilters,
} from "../services/donationsService";
import DonationDialog from "../components/donations/donationDialog";
import BondDialog from "../components/donations/bondDialog";
import { formatMoney } from "../utils/money";

const CELL_SX = { py: 0.75 };
const HEAD_SX = { py: 1, fontWeight: 700, whiteSpace: "nowrap" as const };
const NUM_SX = { ...CELL_SX, textAlign: "right" as const, whiteSpace: "nowrap" as const };

function donorName(row: { first_name: string | null; last_name: string | null }) {
  return `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "—";
}

export default function DonationsPage() {
  const { can } = useAuth();
  const canWrite = can("donations.write");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [summary, setSummary] = useState<IDonationSummary | null>(null);
  const [brothers, setBrothers] = useState<IBrother[]>([]);

  // Donor paging. The roster grows without bound, so this one is paged; the
  // campaigns table is not.
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Donor table controls. Filtering happens in the browser: the roster is a few
  // hundred rows at most, and the summary already carries everything it sorts on.
  const [donorSearch, setDonorSearch] = useState("");
  const [donorBondFilter, setDonorBondFilter] = useState("");
  const [donorSort, setDonorSort] = useState("name");
  // Bumped on every mutation so open donor rows refetch their history.
  const [refreshKey, setRefreshKey] = useState(0);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<IDonation | null>(null);
  const [deleting, setDeleting] = useState<IDonation | null>(null);
  const [bondFor, setBondFor] = useState<{ id: number; name: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, b] = await Promise.all([getDonationSummary(), getAllBrothers()]);
      setSummary(s);
      setBrothers(b);
      setRefreshKey((k) => k + 1);
    } catch (e: any) {
      setError(e?.message ?? "Could not load donations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const donors = useMemo(() => summary?.brothers ?? [], [summary]);
  const outstandingBonds = donors.filter((d) => (d.bond_outstanding ?? 0) > 0);

  const visibleDonors = useMemo(() => {
    const q = donorSearch.trim().toLowerCase();
    const matches = donors.filter((d) => {
      if (q) {
        const haystack = [donorName(d), d.pledge_class, d.bond_number, d.status]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      switch (donorBondFilter) {
        case "outstanding":
          return (d.bond_outstanding ?? 0) > 0;
        case "paid":
          return d.has_bond && d.bond_outstanding === 0;
        case "numbered":
          return Boolean(d.bond_number);
        // The follow-up list: bond settled, certificate number still to come.
        case "unnumbered":
          return d.has_bond && d.bond_outstanding === 0 && !d.bond_number;
        case "none":
          return !d.has_bond;
        default:
          return true;
      }
    });

    const sorted = [...matches];
    sorted.sort((a, b) => {
      switch (donorSort) {
        case "lifetime":
          return b.lifetime_total - a.lifetime_total;
        case "owing":
          return (b.bond_outstanding ?? -1) - (a.bond_outstanding ?? -1);
        case "recent":
          return String(b.last_donation_on ?? "").localeCompare(String(a.last_donation_on ?? ""));
        default:
          return donorName(a).localeCompare(donorName(b));
      }
    });
    return sorted;
  }, [donors, donorSearch, donorBondFilter, donorSort]);

  // A narrowed list can be shorter than the page you were on.
  useEffect(() => {
    setPage(0);
  }, [donorSearch, donorBondFilter, donorSort]);

  const pagedDonors = visibleDonors.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  async function handleDelete() {
    if (!deleting) return;
    setActionError(null);
    try {
      await deleteDonation(deleting.id);
      setDeleting(null);
      await load();
    } catch (e: any) {
      setActionError(e?.message ?? "Could not delete the donation.");
    }
  }

  return (
    <>
      {canWrite && (creating || editing) ? (
        <DonationDialog
          brothers={brothers}
          campaigns={summary?.campaigns ?? []}
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

      {canWrite && bondFor ? (
        <BondDialog
          brotherId={bondFor.id}
          brotherName={bondFor.name}
          onClose={() => setBondFor(null)}
          onSaved={async () => {
            setBondFor(null);
            await load();
          }}
        />
      ) : null}

      {canWrite && deleting ? (
        <Dialog open fullWidth maxWidth="xs" onClose={() => setDeleting(null)}>
          <DialogTitle>Delete donation?</DialogTitle>
          <DialogContent dividers>
            {actionError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {actionError}
              </Alert>
            ) : null}
            <Typography variant="body2">
              ${formatMoney(deleting.amount)} from {donorName(deleting)} on {deleting.donated_on}{" "}
              will be removed.
              {deleting.kind === "bond"
                ? " Their bond will show that much still owing again."
                : ""}
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

      <Stack spacing={2}>
        <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
          >
            <Box>
              <Typography variant="h5">Donations</Typography>
              <Typography variant="body2" color="text.secondary">
                Alumni giving and bond payments. A gift is applied to the donor&apos;s outstanding
                bond first, and the rest counts toward a campaign.
              </Typography>
            </Box>
            {canWrite ? (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
                New donation
              </Button>
            ) : null}
          </Stack>
        </Paper>

        {error ? <Alert severity="error">{error}</Alert> : null}
        {actionError && !deleting ? (
          <Alert severity="error" onClose={() => setActionError(null)}>
            {actionError}
          </Alert>
        ) : null}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : !summary ? null : (
          <>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <SummaryTile
                label="Lifetime giving"
                value={summary.totals.lifetime_total}
                hint={`${summary.totals.donor_count} donors on record.`}
              />
              <SummaryTile
                label="Toward bonds"
                value={summary.totals.bond_total}
                hint={`Bonds now open at $${formatMoney(summary.bond_price)}.`}
              />
              <SummaryTile
                label="General donations"
                value={summary.totals.general_total}
                hint="Everything past the bond, campaign or not."
              />
              <SummaryTile
                label="Bonds outstanding"
                value={summary.totals.bond_outstanding}
                hint={`${outstandingBonds.length} bonds not yet paid off.`}
              />
            </Stack>

            <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ mb: 1 }}
                alignItems={{ xs: "stretch", sm: "center" }}
              >
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  Donors
                </Typography>
                <TextField
                  size="small"
                  label="Search"
                  placeholder="Name, pledge class, bond number"
                  value={donorSearch}
                  onChange={(e) => setDonorSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ minWidth: 260 }}
                />
                <TextField
                  select
                  size="small"
                  label="Bond"
                  value={donorBondFilter}
                  onChange={(e) => setDonorBondFilter(e.target.value)}
                  sx={{ minWidth: 160 }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="outstanding">Still owing</MenuItem>
                  <MenuItem value="paid">Paid off</MenuItem>
                  <MenuItem value="numbered">Has bond number</MenuItem>
                  <MenuItem value="unnumbered">Paid, no number yet</MenuItem>
                  <MenuItem value="none">No bond</MenuItem>
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Sort by"
                  value={donorSort}
                  onChange={(e) => setDonorSort(e.target.value)}
                  sx={{ minWidth: 160 }}
                >
                  <MenuItem value="name">Name</MenuItem>
                  <MenuItem value="lifetime">Lifetime giving</MenuItem>
                  <MenuItem value="owing">Bond owing</MenuItem>
                  <MenuItem value="recent">Most recent gift</MenuItem>
                </TextField>
              </Stack>

              <TableContainer sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ ...HEAD_SX, width: 44 }} />
                      <TableCell sx={HEAD_SX}>Brother</TableCell>
                      <TableCell sx={HEAD_SX}>Pledge class</TableCell>
                      <TableCell sx={NUM_SX}>Lifetime</TableCell>
                      <TableCell sx={NUM_SX}>Bond owing</TableCell>
                      <TableCell sx={HEAD_SX}>Bond no.</TableCell>
                      <TableCell sx={HEAD_SX}>Last gift</TableCell>
                      {canWrite ? <TableCell sx={HEAD_SX} /> : null}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visibleDonors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canWrite ? 8 : 7} sx={CELL_SX}>
                          <Typography variant="body2" color="text.secondary">
                            {donors.length === 0
                              ? "No donations recorded yet."
                              : "No donors match this search."}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedDonors.map((d) => (
                        <DonorRow
                          key={d.brother_id}
                          donor={d}
                          canWrite={canWrite}
                          // Bumped by every mutation, so an open row reloads its
                          // history instead of showing what it fetched before.
                          refreshKey={refreshKey}
                          onEditBond={() => setBondFor({ id: d.brother_id, name: donorName(d) })}
                          onEditDonation={setEditing}
                          onDeleteDonation={setDeleting}
                        />
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={visibleDonors.length}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
                rowsPerPageOptions={[10, 25, 50, 100]}
              />
              <Typography variant="caption" color="text.secondary">
                {visibleDonors.length} of {donors.length} donors. Open a row for that brother&apos;s
                full history.
              </Typography>
            </Paper>

            <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Campaigns
              </Typography>
              {/* No pagination: there are only ever a handful of campaigns. */}
              <TableContainer sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ ...HEAD_SX, width: 44 }} />
                      <TableCell sx={HEAD_SX}>Campaign</TableCell>
                      <TableCell sx={HEAD_SX}>Runs</TableCell>
                      <TableCell sx={NUM_SX}>Raised</TableCell>
                      <TableCell sx={NUM_SX}>Goal</TableCell>
                      <TableCell sx={{ ...HEAD_SX, minWidth: 140 }}>Progress</TableCell>
                      <TableCell sx={NUM_SX}>Gifts</TableCell>
                      <TableCell sx={NUM_SX}>Donors</TableCell>
                      <TableCell sx={HEAD_SX}>Last gift</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {/* Bond money first, then unattached gifts, then the
                        campaigns. Bond rows never carry a campaign, so without
                        these two the table would not reach every donation. */}
                    <CampaignRow
                      campaign={{
                        name: "Bond payments",
                        description: "Money applied to alumni bonds.",
                        is_active: true,
                        ...summary.bond_payments,
                      }}
                      filters={{ kind: "bond" }}
                      canWrite={canWrite}
                      refreshKey={refreshKey}
                      onEditDonation={setEditing}
                      onDeleteDonation={setDeleting}
                    />
                    <CampaignRow
                      campaign={{
                        name: "General donations",
                        description: "Gifts not pinned to a campaign.",
                        is_active: true,
                        ...summary.unattached,
                      }}
                      filters={{ no_campaign: true, kind: "general" }}
                      canWrite={canWrite}
                      refreshKey={refreshKey}
                      onEditDonation={setEditing}
                      onDeleteDonation={setDeleting}
                    />
                    {summary.campaigns.map((c) => (
                      <CampaignRow
                        key={c.id}
                        campaign={c}
                        canWrite={canWrite}
                        refreshKey={refreshKey}
                        onEditDonation={setEditing}
                        onDeleteDonation={setDeleting}
                      />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Typography variant="caption" color="text.secondary">
                Open a row for every gift in that campaign. Campaigns are added and edited in
                Donations Config.
              </Typography>
            </Paper>
          </>
        )}
      </Stack>
    </>
  );
}

// One campaign, with every gift pinned to it folded underneath. The catch-all
// row (`unattached`) covers donations pinned to no campaign — bond payments are
// always among them — so the table reaches every donation the old ledger did.
function CampaignRow(props: {
  campaign: IDonationCampaign;
  // What to fetch when the row is opened. Absent means "this campaign".
  filters?: DonationFilters;
  canWrite: boolean;
  refreshKey: number;
  onEditDonation: (d: IDonation) => void;
  onDeleteDonation: (d: IDonation) => void;
}) {
  const c = props.campaign;
  const [open, setOpen] = useState(false);
  const [gifts, setGifts] = useState<IDonation[] | null>(null);
  const [giftsError, setGiftsError] = useState<string | null>(null);

  // The filters arrive as an object literal, so a fresh identity every render.
  // Depend on the contents instead, or an open row refetches forever.
  const filterKey = JSON.stringify(props.filters ?? { campaign_id: c.id });
  const raised = Number(c.raised ?? 0);
  const goal = Number(c.goal_amount ?? 0);
  const pct = goal > 0 ? Math.min(100, (raised / goal) * 100) : 0;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setGiftsError(null);
    getDonations({ ...JSON.parse(filterKey), limit: 500 })
      .then((page) => {
        if (!cancelled) setGifts(page.rows);
      })
      .catch((e: any) => {
        if (!cancelled) setGiftsError(e?.message ?? "Could not load these donations.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filterKey, props.refreshKey]);

  const runs =
    c.starts_on || c.ends_on ? `${c.starts_on ?? "—"} → ${c.ends_on ?? "—"}` : "—";

  return (
    <>
      <TableRow hover>
        <TableCell sx={CELL_SX}>
          <IconButton size="small" onClick={() => setOpen((v) => !v)} aria-label="Show donations">
            {open ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell sx={CELL_SX}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {c.name}
            {c.is_active ? "" : " (closed)"}
          </Typography>
          {c.description ? (
            <Typography variant="caption" color="text.secondary">
              {c.description}
            </Typography>
          ) : null}
        </TableCell>
        <TableCell sx={{ ...CELL_SX, whiteSpace: "nowrap" }}>{props.filters ? "—" : runs}</TableCell>
        <TableCell sx={NUM_SX}>${formatMoney(raised)}</TableCell>
        <TableCell sx={NUM_SX}>{goal > 0 ? `$${formatMoney(goal)}` : "—"}</TableCell>
        <TableCell sx={CELL_SX}>
          {goal > 0 ? (
            <Stack direction="row" alignItems="center" spacing={1}>
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{ height: 8, borderRadius: 1, flexGrow: 1, minWidth: 80 }}
              />
              <Typography variant="caption" color="text.secondary">
                {Math.round(pct)}%
              </Typography>
            </Stack>
          ) : (
            <Typography variant="caption" color="text.secondary">
              No goal set
            </Typography>
          )}
        </TableCell>
        <TableCell sx={NUM_SX}>{c.donation_count ?? 0}</TableCell>
        <TableCell sx={NUM_SX}>{c.donor_count ?? 0}</TableCell>
        <TableCell sx={CELL_SX}>{c.last_donation_on ?? "—"}</TableCell>
      </TableRow>

      <TableRow>
        <TableCell sx={{ py: 0, borderBottom: open ? undefined : "none" }} colSpan={9}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ py: 1.5, pl: 5 }}>
              {giftsError ? (
                <Alert severity="error" sx={{ mb: 1 }}>
                  {giftsError}
                </Alert>
              ) : null}
              {gifts === null ? (
                <CircularProgress size={20} />
              ) : gifts.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nothing recorded here yet.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={HEAD_SX}>Date</TableCell>
                      <TableCell sx={HEAD_SX}>Brother</TableCell>

                      <TableCell sx={NUM_SX}>Amount</TableCell>
                      <TableCell sx={HEAD_SX}>Note</TableCell>
                      {props.canWrite ? <TableCell sx={HEAD_SX} /> : null}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {gifts.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell sx={CELL_SX}>{row.donated_on}</TableCell>
                        <TableCell sx={CELL_SX}>{donorName(row)}</TableCell>

                        <TableCell sx={NUM_SX}>${formatMoney(row.amount)}</TableCell>
                        <TableCell sx={CELL_SX}>{row.note ?? "—"}</TableCell>
                        {props.canWrite ? (
                          <TableCell sx={{ ...CELL_SX, whiteSpace: "nowrap" }}>
                            <IconButton size="small" onClick={() => props.onEditDonation(row)}>
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" onClick={() => props.onDeleteDonation(row)}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// One donor, with their whole giving history folded underneath. The history is
// fetched when the row is first opened rather than up front — the summary covers
// what the closed row shows, and most rows are never opened.
function DonorRow(props: {
  donor: IDonorSummary;
  canWrite: boolean;
  refreshKey: number;
  onEditBond: () => void;
  onEditDonation: (d: IDonation) => void;
  onDeleteDonation: (d: IDonation) => void;
}) {
  const d = props.donor;
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<IDonation[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setHistoryError(null);
    getDonations({ brother_id: d.brother_id, limit: 500 })
      .then((page) => {
        if (!cancelled) setHistory(page.rows);
      })
      .catch((e: any) => {
        if (!cancelled) setHistoryError(e?.message ?? "Could not load this history.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, d.brother_id, props.refreshKey]);

  const colSpan = props.canWrite ? 8 : 7;

  return (
    <>
      <TableRow hover>
        <TableCell sx={CELL_SX}>
          <IconButton size="small" onClick={() => setOpen((v) => !v)} aria-label="Show history">
            {open ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell sx={CELL_SX}>{donorName(d)}</TableCell>
        <TableCell sx={CELL_SX}>{d.pledge_class ?? "—"}</TableCell>
        <TableCell sx={NUM_SX}>${formatMoney(d.lifetime_total)}</TableCell>
        {/* Owing against the price in one cell — "$50.00 / $300.00" — and just
            the chip once there is nothing left to pay. */}
        <TableCell sx={NUM_SX}>
          {d.bond_outstanding === null || d.bond_price === null ? (
            "—"
          ) : d.bond_outstanding > 0 ? (
            <>
              <Box component="span" sx={{ color: "error.main" }}>
                ${formatMoney(d.bond_outstanding)}
              </Box>
              <Box component="span" sx={{ color: "text.secondary" }}>
                {" / $"}
                {formatMoney(d.bond_price)}
              </Box>
            </>
          ) : (
            <Chip size="small" label="Paid" color="success" variant="outlined" />
          )}
        </TableCell>
        <TableCell sx={CELL_SX}>
          {d.bond_number ?? (
            <Typography variant="caption" color="text.secondary">
              {d.has_bond && d.bond_outstanding === 0 ? "Awaiting number" : "—"}
            </Typography>
          )}
        </TableCell>
        <TableCell sx={CELL_SX}>{d.last_donation_on ?? "—"}</TableCell>
        {props.canWrite ? (
          <TableCell sx={{ ...CELL_SX, whiteSpace: "nowrap" }}>
            <Tooltip title="Edit bond">
              <IconButton size="small" onClick={props.onEditBond}>
                <AccountBalanceOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </TableCell>
        ) : null}
      </TableRow>

      <TableRow>
        <TableCell sx={{ py: 0, borderBottom: open ? undefined : "none" }} colSpan={colSpan}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ py: 1.5, pl: 5 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Giving history — {d.donation_count} {d.donation_count === 1 ? "entry" : "entries"}
              </Typography>
              {historyError ? (
                <Alert severity="error" sx={{ mb: 1 }}>
                  {historyError}
                </Alert>
              ) : null}
              {history === null ? (
                <CircularProgress size={20} />
              ) : history.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nothing recorded yet — the bond was opened by hand.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={HEAD_SX}>Date</TableCell>
                      <TableCell sx={HEAD_SX}>Kind</TableCell>
                      <TableCell sx={HEAD_SX}>Campaign</TableCell>
                      <TableCell sx={NUM_SX}>Amount</TableCell>
                      <TableCell sx={HEAD_SX}>Note</TableCell>
                      {props.canWrite ? <TableCell sx={HEAD_SX} /> : null}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {history.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell sx={CELL_SX}>{row.donated_on}</TableCell>
                        <TableCell sx={CELL_SX}>
                          <Chip
                            size="small"
                            variant="outlined"
                            color={row.kind === "bond" ? "primary" : "default"}
                            label={row.kind === "bond" ? "Bond" : "Donation"}
                          />
                        </TableCell>
                        <TableCell sx={CELL_SX}>{row.campaign_name ?? "—"}</TableCell>
                        <TableCell sx={NUM_SX}>${formatMoney(row.amount)}</TableCell>
                        <TableCell sx={CELL_SX}>{row.note ?? "—"}</TableCell>
                        {props.canWrite ? (
                          <TableCell sx={{ ...CELL_SX, whiteSpace: "nowrap" }}>
                            <IconButton size="small" onClick={() => props.onEditDonation(row)}>
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" onClick={() => props.onDeleteDonation(row)}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function SummaryTile(props: { label: string; value: number; hint?: string }) {
  return (
    <Paper elevation={0} sx={{ p: 2, flex: 1, border: "1px solid", borderColor: "divider" }}>
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
