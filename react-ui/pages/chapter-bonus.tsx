import * as React from "react";
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
  InputAdornment,
  Link as MuiLink,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import dayjs from "dayjs";
import Link from "next/link";
import type { IChapterBonusDeduction } from "../interfaces/api.interface";
import {
  addBonusDeduction,
  deleteBonusDeduction,
  getBonusDeductions,
  getBonusRules,
  getBonusSummary,
  getWorkdayRatesForMonth,
  previewBonusPenalty,
  upsertWorkdayRatesForMonth,
} from "../services/chapterBonusService";
import { API_BASE_URL } from "../services/apiClient";
import { formatMoney, normalizeMoneyInput } from "../utils/money";
import { useAuth } from "../context/authContext";

function currentMonth(): string {
  return dayjs().format("YYYY-MM");
}

export default function ChapterBonusPage() {
  const { can } = useAuth();
  const canWrite = can("chapterBonus.write");
  const resolveApiUrl = React.useCallback((pathOrUrl: string) => {
    if (!pathOrUrl) return pathOrUrl;
    if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
    return `${API_BASE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
  }, []);
  const [month, setMonth] = React.useState<string>(currentMonth());
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<IChapterBonusDeduction[]>([]);
  const [total, setTotal] = React.useState<number>(0);
  const [error, setError] = React.useState<string | null>(null);
  const [rules, setRules] = React.useState<Array<{ violation_type: string }>>([]);

  const [addOpen, setAddOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [violationType, setViolationType] = React.useState<string>("");
  const [amount, setAmount] = React.useState<string>("0.00");
  const [amountHelper, setAmountHelper] = React.useState<string>("Enter a positive amount (this is a deduction).");
  const [comments, setComments] = React.useState<string>("");
  const [photo, setPhoto] = React.useState<File | null>(null);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<IChapterBonusDeduction | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const [ratesLoading, setRatesLoading] = React.useState(false);
  const [ratesSaving, setRatesSaving] = React.useState(false);
  const [ratesError, setRatesError] = React.useState<string | null>(null);
  const [ratesSuccess, setRatesSuccess] = React.useState<string | null>(null);
  const [activePresentRate, setActivePresentRate] = React.useState<string>("25.00");
  const [activeLateRate, setActiveLateRate] = React.useState<string>("20.00");
  const [activeCoverallsRate, setActiveCoverallsRate] = React.useState<string>("30.00");
  const [activeCoverallsNametagRate, setActiveCoverallsNametagRate] = React.useState<string>("35.00");
  const [pledgePresentRate, setPledgePresentRate] = React.useState<string>("20.00");
  const [pledgeLateRate, setPledgeLateRate] = React.useState<string>("10.00");

  const [workdaysLoading, setWorkdaysLoading] = React.useState(false);
  const [workdaysError, setWorkdaysError] = React.useState<string | null>(null);
  const [workdays, setWorkdays] = React.useState<any[]>([]);

  const totals = React.useMemo(() => {
    const revenue = (workdays ?? []).reduce((sum, w) => sum + Number(w?.summary?.earnings_total ?? 0), 0);
    const deductions = Number(total ?? 0);
    const rawProfit = revenue - deductions;
    return {
      revenue,
      deductions,
      rawProfit,
      profitFloor: Math.max(0, rawProfit),
    };
  }, [workdays, total]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, summary, rulesRes] = await Promise.all([getBonusDeductions(month), getBonusSummary(month), getBonusRules()]);
      setItems(rows);
      setTotal(Number(summary.total ?? 0));
      setRules((rulesRes ?? []).map((r) => ({ violation_type: r.violation_type })));
      if (!violationType && rulesRes?.[0]?.violation_type) setViolationType(rulesRes[0].violation_type);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load deductions.");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [month, violationType]);

  const refreshRates = React.useCallback(async () => {
    // new month => reset autosave baseline
    ratesAutosaveReadyRef.current = false;
    lastSavedRatesHashRef.current = null;
    setRatesLoading(true);
    setRatesError(null);
    try {
      const data = await getWorkdayRatesForMonth(month);
      setActivePresentRate(formatMoney(Number(data.active_present_rate ?? 0)));
      setActiveLateRate(formatMoney(Number(data.active_late_rate ?? 0)));
      setActiveCoverallsRate(formatMoney(Number(data.active_coveralls_rate ?? 0)));
      setActiveCoverallsNametagRate(formatMoney(Number(data.active_coveralls_nametag_rate ?? 0)));
      setPledgePresentRate(formatMoney(Number(data.pledge_present_rate ?? 0)));
      setPledgeLateRate(formatMoney(Number(data.pledge_late_rate ?? 0)));
    } catch (e: any) {
      setRatesError(e?.message ?? "Failed to load workday rates.");
      setActivePresentRate("0.00");
      setActiveLateRate("0.00");
      setActiveCoverallsRate("0.00");
      setActiveCoverallsNametagRate("0.00");
      setPledgePresentRate("0.00");
      setPledgeLateRate("0.00");
    } finally {
      setRatesLoading(false);
    }
  }, [month]);

  const lastSavedRatesHashRef = React.useRef<string | null>(null);
  const ratesAutosaveReadyRef = React.useRef(false);
  const ratesDebounceRef = React.useRef<any>(null);
  const ratesSaveSeqRef = React.useRef(0);

  const buildRatesPayload = React.useCallback(() => {
    return {
      active_present_rate: Number(normalizeMoneyInput(activePresentRate)),
      active_late_rate: Number(normalizeMoneyInput(activeLateRate)),
      active_coveralls_rate: Number(normalizeMoneyInput(activeCoverallsRate)),
      active_coveralls_nametag_rate: Number(normalizeMoneyInput(activeCoverallsNametagRate)),
      pledge_present_rate: Number(normalizeMoneyInput(pledgePresentRate)),
      pledge_late_rate: Number(normalizeMoneyInput(pledgeLateRate)),
    };
  }, [
    activePresentRate,
    activeLateRate,
    activeCoverallsRate,
    activeCoverallsNametagRate,
    pledgePresentRate,
    pledgeLateRate,
  ]);

  const computeRevenueFromCounts = React.useCallback(
    (counts: any, payload: ReturnType<typeof buildRatesPayload>) => {
      if (!counts) return 0;
      return (
        Number(counts.active_present ?? 0) * payload.active_present_rate +
        Number(counts.active_late ?? 0) * payload.active_late_rate +
        Number(counts.active_coveralls ?? 0) * payload.active_coveralls_rate +
        Number(counts.active_coveralls_nametag ?? 0) * payload.active_coveralls_nametag_rate +
        Number(counts.pledge_present ?? 0) * payload.pledge_present_rate +
        Number(counts.pledge_late ?? 0) * payload.pledge_late_rate
      );
    },
    []
  );

  const refreshWorkdays = React.useCallback(async () => {
    setWorkdaysLoading(true);
    setWorkdaysError(null);
    try {
      // Lazy import to avoid circular deps in this file
      const mod = await import("../services/workdaysService");
      const rows = await mod.getWorkdaysForBonusMonth(month);
      setWorkdays(rows ?? []);
    } catch (e: any) {
      setWorkdaysError(e?.message ?? "Failed to load workdays.");
      setWorkdays([]);
    } finally {
      setWorkdaysLoading(false);
    }
  }, [month]);

  React.useEffect(() => {
    void refresh();
    void refreshRates();
    void refreshWorkdays();
  }, [refresh, refreshRates]);

  // Mark the freshly-loaded rates as saved (prevents autosave firing immediately).
  React.useEffect(() => {
    // after refreshRates completes, ratesLoading flips false; then mark current state as "saved"
    if (ratesLoading) return;
    if (ratesAutosaveReadyRef.current) return;
    const hash = JSON.stringify(buildRatesPayload());
    lastSavedRatesHashRef.current = hash;
    ratesAutosaveReadyRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratesLoading]);

  // Debounced autosave for rates (clean UX: no Save button)
  React.useEffect(() => {
    if (ratesLoading) return;
    if (!ratesAutosaveReadyRef.current) return;
    const payload = buildRatesPayload();
    const hash = JSON.stringify(payload);
    if (hash === lastSavedRatesHashRef.current) return;

    if (ratesDebounceRef.current) clearTimeout(ratesDebounceRef.current);
    ratesDebounceRef.current = setTimeout(async () => {
      const seq = ++ratesSaveSeqRef.current;
      setRatesSaving(true);
      setRatesError(null);
      setRatesSuccess(null);

      const res = await upsertWorkdayRatesForMonth(month, payload);
      if (seq !== ratesSaveSeqRef.current) return;

      setRatesSaving(false);
      if (!res.ok) {
        setRatesError(res.error);
        return;
      }
      lastSavedRatesHashRef.current = hash;
      setRatesSuccess("Saved");
      setTimeout(() => setRatesSuccess(null), 900);

      // Update the visible workday earnings locally to avoid a jarring refetch/replace.
      setWorkdays((prev) =>
        (prev ?? []).map((w: any) => {
          const counts = w?.summary?.attended_counts;
          if (!counts) return w;
          const earnings_total = computeRevenueFromCounts(counts, payload);
          return { ...w, summary: { ...w.summary, earnings_total } };
        })
      );
    }, 600);

    return () => {
      if (ratesDebounceRef.current) clearTimeout(ratesDebounceRef.current);
    };
  }, [month, ratesLoading, buildRatesPayload, computeRevenueFromCounts]);

  React.useEffect(() => {
    if (!addOpen) return;
    if (!month || !violationType) return;
    let cancelled = false;
    (async () => {
      if (violationType === "Other") {
        setAmount("0.00");
        setAmountHelper("Custom amount required for Other violations.");
        return;
      }
      try {
        const preview = await previewBonusPenalty(month, violationType);
        if (cancelled) return;
        setAmount(String(preview.amount));
        setAmountHelper(`Auto-calculated: violation #${preview.occurrence_number} this month.`);
      } catch {
        // No configured rule yet; allow manual amount
        if (cancelled) return;
        setAmountHelper("No configured rule found; enter amount manually or add a rule in Chapter Bonus Config.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addOpen, month, violationType]);

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ sm: "center" }}>
          <Box>
            <Typography variant="h5">Chapter Bonus</Typography>
            <Typography variant="body2" color="text.secondary">
              Track chapter bonus deductions with photo evidence and per-month totals.
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <IconButton
                aria-label="Previous month"
                size="small"
                onClick={() => setMonth(dayjs(`${month}-01`).subtract(1, "month").format("YYYY-MM"))}
              >
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
              <TextField
                label="Month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 170 }}
              />
              <IconButton
                aria-label="Next month"
                size="small"
                onClick={() => setMonth(dayjs(`${month}-01`).add(1, "month").format("YYYY-MM"))}
              >
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Stack>
            <Button
              variant="outlined"
              startIcon={<PictureAsPdfOutlinedIcon />}
              onClick={() => window.open(`/chapter-bonus/print?month=${encodeURIComponent(month)}&autoprint=1`, "_blank", "noopener,noreferrer")}
            >
              Export PDF
            </Button>
            {canWrite ? (
              <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setAddOpen(true)}>
                Add deduction
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Month totals ({month})
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1, sm: 3 }} sx={{ mt: 0.5 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Total revenue
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>
                  ${formatMoney(totals.revenue)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Total deductions
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>
                  ${formatMoney(totals.deductions)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Total profit
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>
                  ${formatMoney(totals.profitFloor)}
                </Typography>
                {totals.rawProfit < 0 ? (
                  <Typography variant="body2" color="error" sx={{ mt: 0.25 }}>
                    -${formatMoney(Math.abs(totals.rawProfit))}
                  </Typography>
                ) : null}
              </Box>
            </Stack>
          </Box>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} justifyContent="space-between">
          <Box>
            <Typography variant="h6">Workday earning rates</Typography>
            <Typography variant="body2" color="text.secondary">
              {canWrite ? "Set rates for this month." : "Rates for this month (read-only)."}
            </Typography>
          </Box>
          {ratesError ? <Alert severity="error">{ratesError}</Alert> : null}
          <Box sx={{ minWidth: 80, display: "flex", justifyContent: "flex-end" }}>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ whiteSpace: "nowrap", visibility: canWrite && ratesSaving ? "visible" : "hidden" }}
            >
              Saving…
            </Typography>
          </Box>
          {canWrite ? (
            <Snackbar open={Boolean(ratesSuccess)} onClose={() => setRatesSuccess(null)} autoHideDuration={900} anchorOrigin={{ vertical: "top", horizontal: "right" }}>
              <Alert severity="success" variant="filled" sx={{ boxShadow: 6 }}>
                {ratesSuccess}
              </Alert>
            </Snackbar>
          ) : null}
          <Box
            sx={{
              flex: 1,
              display: "grid",
              gap: 1,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "1fr 1fr",
                lg: "1fr 1fr 1fr",
              },
              alignItems: "start",
            }}
          >
            <TextField
              size="small"
              fullWidth
              label="Active — Present"
              type="number"
              value={activePresentRate}
              onChange={(e) => setActivePresentRate(e.target.value)}
              onBlur={() => setActivePresentRate(normalizeMoneyInput(activePresentRate))}
              inputProps={{ step: "5" }}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              disabled={ratesLoading || !canWrite}
            />
            <TextField
              size="small"
              fullWidth
              label="Active — Late"
              type="number"
              value={activeLateRate}
              onChange={(e) => setActiveLateRate(e.target.value)}
              onBlur={() => setActiveLateRate(normalizeMoneyInput(activeLateRate))}
              inputProps={{ step: "5" }}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              disabled={ratesLoading || !canWrite}
            />
            <TextField
              size="small"
              fullWidth
              label="Active — Coveralls"
              type="number"
              value={activeCoverallsRate}
              onChange={(e) => setActiveCoverallsRate(e.target.value)}
              onBlur={() => setActiveCoverallsRate(normalizeMoneyInput(activeCoverallsRate))}
              inputProps={{ step: "5" }}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              disabled={ratesLoading || !canWrite}
            />
            <TextField
              size="small"
              fullWidth
              label="Active — Coveralls + Nametag"
              type="number"
              value={activeCoverallsNametagRate}
              onChange={(e) => setActiveCoverallsNametagRate(e.target.value)}
              onBlur={() => setActiveCoverallsNametagRate(normalizeMoneyInput(activeCoverallsNametagRate))}
              inputProps={{ step: "5" }}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              disabled={ratesLoading || !canWrite}
            />
            <TextField
              size="small"
              fullWidth
              label="Pledge — Present"
              type="number"
              value={pledgePresentRate}
              onChange={(e) => setPledgePresentRate(e.target.value)}
              onBlur={() => setPledgePresentRate(normalizeMoneyInput(pledgePresentRate))}
              inputProps={{ step: "5" }}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              disabled={ratesLoading || !canWrite}
            />
            <TextField
              size="small"
              fullWidth
              label="Pledge — Late"
              type="number"
              value={pledgeLateRate}
              onChange={(e) => setPledgeLateRate(e.target.value)}
              onBlur={() => setPledgeLateRate(normalizeMoneyInput(pledgeLateRate))}
              inputProps={{ step: "5" }}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              disabled={ratesLoading || !canWrite}
            />
          </Box>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
          <Box>
            <Typography variant="h6">Workdays for {month}</Typography>
            <Typography variant="body2" color="text.secondary">
              Workdays are included based on each workday’s associated month.
            </Typography>
          </Box>
        </Stack>
        {workdaysError ? <Alert severity="error" sx={{ mt: 2 }}>{workdaysError}</Alert> : null}
        {workdaysLoading ? (
          <CircularProgress sx={{ mt: 2 }} />
        ) : (
          <Box sx={{ mt: 2 }}>
            {workdays.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No workdays are counting for this month.
              </Typography>
            ) : (
              <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
                <Box component="thead">
                  <Box component="tr">
                    <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1 }}>
                      Date
                    </Box>
                    <Box component="th" sx={{ textAlign: "right", borderBottom: "1px solid", borderColor: "divider", py: 1, width: 170 }}>
                      Active — Present
                    </Box>
                    <Box component="th" sx={{ textAlign: "right", borderBottom: "1px solid", borderColor: "divider", py: 1, width: 150 }}>
                      Active — Late
                    </Box>
                    <Box component="th" sx={{ textAlign: "right", borderBottom: "1px solid", borderColor: "divider", py: 1, width: 170 }}>
                      Active — Coveralls
                    </Box>
                    <Box component="th" sx={{ textAlign: "right", borderBottom: "1px solid", borderColor: "divider", py: 1, width: 220 }}>
                      Active — Cov + Tag
                    </Box>
                    <Box component="th" sx={{ textAlign: "right", borderBottom: "1px solid", borderColor: "divider", py: 1, width: 170 }}>
                      Pledge — Present
                    </Box>
                    <Box component="th" sx={{ textAlign: "right", borderBottom: "1px solid", borderColor: "divider", py: 1, width: 150 }}>
                      Pledge — Late
                    </Box>
                    <Box component="th" sx={{ textAlign: "right", borderBottom: "1px solid", borderColor: "divider", py: 1, width: 140 }}>
                      Earnings ($)
                    </Box>
                  </Box>
                </Box>
                <Box component="tbody">
                  {workdays.map((w) => (
                    <Box component="tr" key={w.id}>
                      <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1 }}>
                        {w.id ? (
                          <Link href={`/workdays/${w.id}`}>
                            {w.workday_date ? dayjs(w.workday_date).format("MMM D, YYYY") : "—"}
                          </Link>
                        ) : (
                          (w.workday_date ? dayjs(w.workday_date).format("MMM D, YYYY") : "—")
                        )}
                      </Box>
                      <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, textAlign: "right" }}>
                        {w.summary?.attended_counts?.active_present ?? 0}
                      </Box>
                      <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, textAlign: "right" }}>
                        {w.summary?.attended_counts?.active_late ?? 0}
                      </Box>
                      <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, textAlign: "right" }}>
                        {w.summary?.attended_counts?.active_coveralls ?? 0}
                      </Box>
                      <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, textAlign: "right" }}>
                        {w.summary?.attended_counts?.active_coveralls_nametag ?? 0}
                      </Box>
                      <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, textAlign: "right" }}>
                        {w.summary?.attended_counts?.pledge_present ?? 0}
                      </Box>
                      <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, textAlign: "right" }}>
                        {w.summary?.attended_counts?.pledge_late ?? 0}
                      </Box>
                      <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, textAlign: "right" }}>
                        ${formatMoney(w.summary?.earnings_total ?? 0)}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Paper>

      {loading ? (
        <CircularProgress />
      ) : (
        <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Deductions
          </Typography>
          {items.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No deductions for this month.
            </Typography>
          ) : (
            <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
              <Box component="thead">
                <Box component="tr">
                  <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1 }}>
                    Date
                  </Box>
                  <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1 }}>
                    Violation
                  </Box>
                  <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1 }}>
                    Comments
                  </Box>
                  <Box component="th" sx={{ textAlign: "right", borderBottom: "1px solid", borderColor: "divider", py: 1, width: 120 }}>
                    Amount
                  </Box>
                  <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1, pl: 3, width: 190 }}>
                    Evidence
                  </Box>
                  <Box component="th" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, width: 80 }} />
                </Box>
              </Box>
              <Box component="tbody">
                {items.map((d) => (
                  <Box component="tr" key={d.id ?? `${d.month}-${d.violation_type}-${d.created_at}`}>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1 }}>
                      {d.created_at ? dayjs(d.created_at).format("MMM D, YYYY") : "—"}
                    </Box>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1 }}>
                      <b>{d.violation_type}</b>
                    </Box>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1 }}>
                      {d.comments?.trim() ? d.comments : "—"}
                    </Box>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, textAlign: "right" }}>
                      ${formatMoney(d.amount)}
                    </Box>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, pl: 3 }}>
                      {d.photo_url ? (
                        <MuiLink href={resolveApiUrl(d.photo_url)} target="_blank" rel="noreferrer">
                          View photo
                        </MuiLink>
                      ) : (
                        "—"
                      )}
                    </Box>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, textAlign: "right" }}>
                      {canWrite ? (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(d);
                            setDeleteOpen(true);
                          }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      ) : null}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Paper>
      )}

      {/* Add deduction */}
      <Dialog open={addOpen && canWrite} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          Add deduction
          <IconButton onClick={() => setAddOpen(false)} aria-label="close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField label="Month" type="month" value={month} disabled InputLabelProps={{ shrink: true }} />

            <TextField
              select
              label="Violation type"
              value={violationType}
              onChange={(e) => {
                setViolationType(e.target.value);
              }}
              fullWidth
            >
              {rules.length === 0 ? (
                <MenuItem value="" disabled>
                  No rules yet (configure first)
                </MenuItem>
              ) : null}
              {rules.map((r) => (
                <MenuItem key={r.violation_type} value={r.violation_type}>
                  {r.violation_type}
                </MenuItem>
              ))}
              <MenuItem value="Other">Other (custom)</MenuItem>
            </TextField>

            <TextField
              label="Amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={() => setAmount(normalizeMoneyInput(amount))}
              inputProps={{ step: "0.01" }}
              fullWidth
              helperText={amountHelper}
            />

            <TextField
              label="Comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              multiline
              minRows={3}
              fullWidth
              required={violationType === "Other"}
              helperText={violationType === "Other" ? "Required for Other (custom) violations." : undefined}
            />

            <Button variant="outlined" component="label">
              {photo ? `Photo selected: ${photo.name}` : "Upload photo evidence"}
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              />
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setAddOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              setError(null);

              if (violationType === "Other" && !comments.trim()) {
                setSubmitting(false);
                setError("Comments are required for Other (custom) violations.");
                return;
              }

              const form = new FormData();
              form.append("month", month);
              form.append("amount", normalizeMoneyInput(amount));
              form.append("violation_type", violationType);
              form.append("comments", comments);
              if (photo) form.append("photo", photo);

              const res = await addBonusDeduction(form);
              setSubmitting(false);
              if (!res.ok) {
                setError(res.error);
                return;
              }
              setAddOpen(false);
              setAmount("0.00");
              setComments("");
              setPhoto(null);
              void refresh();
            }}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete */}
      <Dialog open={deleteOpen && canWrite} onClose={() => setDeleteOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          Delete deduction
          <IconButton onClick={() => setDeleteOpen(false)} aria-label="close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {deleteError ? <Alert severity="error">{deleteError}</Alert> : null}
          <Typography sx={{ mt: deleteError ? 2 : 0 }}>
            Are you sure you want to delete <b>{deleteTarget?.violation_type}</b> for ${formatMoney(deleteTarget?.amount ?? 0)}?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            disabled={!deleteTarget?.id}
            onClick={async () => {
              if (!deleteTarget?.id) return;
              setDeleteError(null);
              const res = await deleteBonusDeduction(deleteTarget.id);
              if (!res.ok) {
                setDeleteError(res.error);
                return;
              }
              setDeleteOpen(false);
              setDeleteTarget(null);
              void refresh();
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}


