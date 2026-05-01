import * as React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import dayjs from "dayjs";
import { Alert, Box, CircularProgress, Divider, Typography } from "@mui/material";
import type { IChapterBonusDeduction } from "../../interfaces/api.interface";
import { formatMoney } from "../../utils/money";
import { getBonusDeductions, getBonusSummary, getWorkdayRatesForMonth } from "../../services/chapterBonusService";
import { getWorkdaysForBonusMonth } from "../../services/workdaysService";
import { API_BASE_URL } from "../../services/apiClient";

function currentMonth(): string {
  return dayjs().format("YYYY-MM");
}

export default function ChapterBonusPrintPage() {
  const router = useRouter();
  const month = String(router.query.month ?? currentMonth());
  const autoprint = router.query.autoprint === "1";

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<IChapterBonusDeduction[]>([]);
  const [deductionsTotal, setDeductionsTotal] = React.useState<number>(0);
  const [rates, setRates] = React.useState<any>(null);
  const [workdays, setWorkdays] = React.useState<any[]>([]);

  const resolveApiUrl = React.useCallback((pathOrUrl: string) => {
    if (!pathOrUrl) return pathOrUrl;
    if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
    return `${API_BASE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
  }, []);

  React.useEffect(() => {
    if (!router.isReady) return;
    if (!month || month.length < 7) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [rows, summary, r, w] = await Promise.all([
          getBonusDeductions(month),
          getBonusSummary(month),
          getWorkdayRatesForMonth(month),
          getWorkdaysForBonusMonth(month),
        ]);
        if (cancelled) return;
        setItems(rows ?? []);
        setDeductionsTotal(Number(summary?.total ?? 0));
        setRates(r);
        setWorkdays(w ?? []);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load chapter bonus");
        setItems([]);
        setDeductionsTotal(0);
        setRates(null);
        setWorkdays([]);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router.isReady, month]);

  const totals = React.useMemo(() => {
    const revenue = (workdays ?? []).reduce((sum, w) => sum + Number(w?.summary?.earnings_total ?? 0), 0);
    const deductions = Number(deductionsTotal ?? 0);
    const rawProfit = revenue - deductions;
    return {
      revenue,
      deductions,
      rawProfit,
      profitFloor: Math.max(0, rawProfit),
    };
  }, [workdays, deductionsTotal]);

  const attendanceTotals = React.useMemo(() => {
    const sums = {
      active_present: 0,
      active_late: 0,
      active_coveralls: 0,
      active_coveralls_nametag: 0,
      pledge_present: 0,
      pledge_late: 0,
      total: 0,
    };
    for (const w of workdays ?? []) {
      const c = w?.summary?.attended_counts;
      if (!c) continue;
      sums.active_present += Number(c.active_present ?? 0);
      sums.active_late += Number(c.active_late ?? 0);
      sums.active_coveralls += Number(c.active_coveralls ?? 0);
      sums.active_coveralls_nametag += Number(c.active_coveralls_nametag ?? 0);
      sums.pledge_present += Number(c.pledge_present ?? 0);
      sums.pledge_late += Number(c.pledge_late ?? 0);
      sums.total += Number(c.total ?? 0);
    }
    return sums;
  }, [workdays]);

  React.useEffect(() => {
    if (!autoprint) return;
    if (loading) return;
    if (error) return;
    let cancelled = false;

    async function waitForImages(maxWaitMs: number) {
      const start = Date.now();
      while (!cancelled && Date.now() - start < maxWaitMs) {
        const imgs = Array.from(document.images ?? []);
        const pending = imgs.filter((img) => !img.complete);
        if (pending.length === 0) return;
        await new Promise((r) => setTimeout(r, 150));
      }
    }

    (async () => {
      // Give the browser time to fetch/paint images before triggering print.
      await waitForImages(2500);
      if (cancelled) return;
      setTimeout(() => window.print(), 150);
    })();

    return () => {
      cancelled = true;
    };
  }, [autoprint, loading, error]);

  if (!router.isReady || loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;

  const monthLabel = dayjs(`${month}-01`).format("MMMM YYYY");

  return (
    <>
      <Head>
        <title>{`PKS - Chapter Bonus (${month})`}</title>
        <meta name="color-scheme" content="light" />
        <style>{`
          @page { size: A4; margin: 12mm; }
          html, body { background: #fff; color: #111; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          a { color: #111; text-decoration: none; }
        `}</style>
      </Head>

      <Box sx={{ maxWidth: 900, mx: "auto", p: 2, bgcolor: "#fff", color: "#111" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1 }}>
          <img src="/alphabeta.png" alt="Alpha Beta" style={{ width: 72, height: 72, objectFit: "contain" }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>
              Phi Kappa Sigma — Alpha Beta
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Chapter Bonus
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {monthLabel}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Summary
        </Typography>
        <Box sx={{ mt: 1, fontSize: 14 }}>
          <Typography variant="body2">
            Total revenue: <b>${formatMoney(totals.revenue)}</b>
          </Typography>
          <Typography variant="body2">
            Total deductions: <b>${formatMoney(totals.deductions)}</b>
          </Typography>
          <Typography variant="body2">
            Total profit: <b>${formatMoney(totals.profitFloor)}</b>
            {totals.rawProfit < 0 ? (
              <span style={{ color: "#b71c1c", marginLeft: 8, fontSize: 12 }}>{`(-$${formatMoney(Math.abs(totals.rawProfit))})`}</span>
            ) : null}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Workday earning rates
        </Typography>
        <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", mt: 1, fontSize: 14 }}>
          <Box component="thead">
            <Box component="tr">
              <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid #ddd", py: 1, pr: 2 }}>
                Rate
              </Box>
              <Box component="th" sx={{ textAlign: "right", borderBottom: "1px solid #ddd", py: 1, width: 140 }}>
                Amount
              </Box>
            </Box>
          </Box>
          <Box component="tbody">
            {[
              ["Active present", rates?.active_present_rate],
              ["Active late", rates?.active_late_rate],
              ["Active coveralls", rates?.active_coveralls_rate],
              ["Active coveralls + nametag", rates?.active_coveralls_nametag_rate],
              ["Pledge present", rates?.pledge_present_rate],
              ["Pledge late", rates?.pledge_late_rate],
            ].map(([label, value]) => (
              <Box component="tr" key={String(label)}>
                <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 1, pr: 2 }}>
                  {label}
                </Box>
                <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 1, textAlign: "right" }}>
                  ${formatMoney(Number(value ?? 0))}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Workdays (counts for this bonus month)
        </Typography>
        {workdays.length === 0 ? (
          <Typography variant="body2" sx={{ mt: 1 }}>
            —
          </Typography>
        ) : (
          <>
            <Typography variant="subtitle2" sx={{ fontWeight: 900, mt: 1 }}>
              Attendance totals (month)
            </Typography>
            <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", mt: 0.5, fontSize: 13 }}>
              <Box component="thead">
                <Box component="tr">
                  <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid #ddd", py: 1, pr: 2 }}>
                    Category
                  </Box>
                  <Box component="th" sx={{ textAlign: "right", borderBottom: "1px solid #ddd", py: 1, width: 140 }}>
                    Total
                  </Box>
                </Box>
              </Box>
              <Box component="tbody">
                {[
                  ["Active present", attendanceTotals.active_present],
                  ["Active late", attendanceTotals.active_late],
                  ["Active coveralls", attendanceTotals.active_coveralls],
                  ["Active coveralls + nametag", attendanceTotals.active_coveralls_nametag],
                  ["Pledge present", attendanceTotals.pledge_present],
                  ["Pledge late", attendanceTotals.pledge_late],
                  ["All attended", attendanceTotals.total],
                ].map(([label, val]) => (
                  <Box component="tr" key={String(label)}>
                    <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 0.75, pr: 2 }}>
                      {label}
                    </Box>
                    <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 0.75, textAlign: "right" }}>
                      {Number(val ?? 0)}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>

            <Typography variant="subtitle2" sx={{ fontWeight: 900, mt: 2 }}>
              Workdays breakdown
            </Typography>
            <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", mt: 0.5, fontSize: 12.5 }}>
              <Box component="thead">
                <Box component="tr">
                  <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid #ddd", py: 1, pr: 2, width: 140 }}>
                    Date
                  </Box>
                  <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid #ddd", py: 1, pr: 2 }}>
                    Attendance breakdown
                  </Box>
                  <Box component="th" sx={{ textAlign: "right", borderBottom: "1px solid #ddd", py: 1, width: 120 }}>
                    Earnings
                  </Box>
                </Box>
              </Box>
              <Box component="tbody">
                {workdays.map((w) => {
                  const d = w.workday_date ? dayjs(w.workday_date).format("MMM D, YYYY") : "—";
                  const c = w?.summary?.attended_counts ?? {};
                  const aP = Number(c.active_present ?? 0);
                  const aL = Number(c.active_late ?? 0);
                  const aC = Number(c.active_coveralls ?? 0);
                  const aCT = Number(c.active_coveralls_nametag ?? 0);
                  const pP = Number(c.pledge_present ?? 0);
                  const pL = Number(c.pledge_late ?? 0);
                  const totalAttended = Number(c.total ?? 0);
                  const earnings = Number(w?.summary?.earnings_total ?? 0);
                  return (
                    <Box component="tr" key={w.id ?? `${w.workday_date}-${w.bonus_month}`}>
                      <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 1, pr: 2, verticalAlign: "top" }}>
                        {d}
                      </Box>
                      <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 1, pr: 2 }}>
                        <div style={{ whiteSpace: "normal" }}>
                          <div>
                            <b>Active</b>: P {aP} • L {aL} • C {aC} • C+T {aCT}
                          </div>
                          <div>
                            <b>Pledge</b>: P {pP} • L {pL} &nbsp; <b>Total</b>: {totalAttended}
                          </div>
                        </div>
                      </Box>
                      <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 1, textAlign: "right", verticalAlign: "top" }}>
                        ${formatMoney(earnings)}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Deductions
        </Typography>
        {items.length === 0 ? (
          <Typography variant="body2" sx={{ mt: 1 }}>
            —
          </Typography>
        ) : (
          <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", mt: 1, fontSize: 13 }}>
            <Box component="thead">
              <Box component="tr">
                <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid #ddd", py: 1, pr: 2 }}>
                  Violation
                </Box>
                <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid #ddd", py: 1, pr: 2 }}>
                  Comments
                </Box>
                <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid #ddd", py: 1, pr: 2, width: 200 }}>
                  Photo
                </Box>
                <Box component="th" sx={{ textAlign: "right", borderBottom: "1px solid #ddd", py: 1, width: 140 }}>
                  Amount
                </Box>
              </Box>
            </Box>
            <Box component="tbody">
              {items.map((d) => (
                <Box component="tr" key={d.id ?? `${d.violation_type}-${d.created_at}-${d.amount}`}>
                  <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 1, pr: 2 }}>
                    {d.violation_type}
                  </Box>
                  <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 1, pr: 2 }}>
                    {(d.comments ?? "").trim() ? d.comments : "—"}
                  </Box>
                  <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 1, pr: 2 }}>
                    {d.photo_url ? (
                      <div
                        style={{
                          width: 180,
                          height: 120,
                          borderRadius: 8,
                          border: "1px solid #e0e0e0",
                          background: "#fafafa",
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <img
                          src={resolveApiUrl(d.photo_url)}
                          alt="Deduction photo"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            display: "block",
                          }}
                        />
                      </div>
                    ) : (
                      "—"
                    )}
                  </Box>
                  <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 1, textAlign: "right" }}>
                    ${formatMoney(Number(d.amount ?? 0))}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </>
  );
}


