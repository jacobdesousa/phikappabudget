import * as React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import dayjs from "dayjs";
import { Alert, Box, CircularProgress, Divider, Typography } from "@mui/material";
import type { IBudgetSummary } from "../../interfaces/api.interface";
import { getBudgetSummary } from "../../services/budgetService";
import { formatMoney } from "../../utils/money";
import { schoolYearLabel } from "../../utils/schoolYear";

const th: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "2px solid #bbb",
  padding: "3px 6px",
  fontWeight: 700,
  fontSize: 10.5,
  whiteSpace: "nowrap",
};
const thR: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = {
  borderBottom: "1px solid #eee",
  padding: "2px 6px",
  fontSize: 10.5,
};
const tdR: React.CSSProperties = { ...td, textAlign: "right" };
const tdTotal: React.CSSProperties = {
  ...td,
  borderTop: "2px solid #bbb",
  borderBottom: "none",
  fontWeight: 700,
  paddingTop: 4,
};
const tdTotalR: React.CSSProperties = { ...tdTotal, textAlign: "right" };
const tdSub: React.CSSProperties = { ...td, paddingLeft: 18, fontSize: 10, color: "#666", borderBottom: "1px solid #f5f5f5" };
const tdSubR: React.CSSProperties = { ...tdSub, textAlign: "right" };

export default function BudgetPrintPage() {
  const router = useRouter();
  const autoprint = router.query.autoprint === "1";

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<IBudgetSummary | null>(null);

  React.useEffect(() => {
    if (!router.isReady) return;
    let cancelled = false;
    const y = router.query.year ? Number(router.query.year) : undefined;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getBudgetSummary(y);
        if (!cancelled) setSummary(data);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router.isReady, router.query.year]);

  React.useEffect(() => {
    if (!autoprint) return;
    if (loading || !summary) return;
    let cancelled = false;

    async function waitForImages(maxWaitMs: number) {
      const start = Date.now();
      while (!cancelled && Date.now() - start < maxWaitMs) {
        const imgs = Array.from(document.images ?? []);
        if (imgs.every((img) => img.complete)) return;
        await new Promise((r) => setTimeout(r, 150));
      }
    }

    (async () => {
      await waitForImages(2500);
      if (cancelled) return;
      setTimeout(() => window.print(), 150);
    })();

    return () => { cancelled = true; };
  }, [autoprint, loading, summary]);

  if (!router.isReady || loading) return <CircularProgress />;
  if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  if (!summary) return null;

  const { expense_rows, revenue_rows, reconciliation, totals, outstanding_disbursements, dues_config } = summary;
  const yearLabel = schoolYearLabel(summary.year);
  const printedOn = dayjs().format("MMMM D, YYYY");

  const pinOrder = (r: typeof revenue_rows[0]) => (r.is_dues ? 0 : r.is_chapter_bonus ? 1 : 2);
  const sortedRevenue = [...revenue_rows].sort((a, b) => pinOrder(a) - pinOrder(b));

  return (
    <>
      <Head>
        <title>{`PKS - Budget ${yearLabel}`}</title>
        <meta name="color-scheme" content="light" />
        <style>{`
          @page { size: A4 portrait; margin: 8mm; }
          html, body { background: #fff; color: #111; margin: 0; padding: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: Arial, sans-serif; }
          a { color: #111; text-decoration: none; }
        `}</style>
      </Head>

      <Box sx={{ p: "6px 8px", bgcolor: "#fff", color: "#111" }}>

        {/* ── Header ── */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <img src="/alphabeta.png" alt="" style={{ width: 52, height: 52, objectFit: "contain" }} />
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: 16, lineHeight: 1.2 }}>
                Phi Kappa Sigma — Alpha Beta
              </Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 12 }}>Annual Budget Report</Typography>
              <Typography sx={{ fontSize: 10, color: "#666" }}>{yearLabel} · Printed {printedOn}</Typography>
            </Box>
          </Box>

          {/* Reconciliation summary in header */}
          <Box sx={{ display: "flex", gap: 3, alignItems: "flex-end" }}>
            {[
              { label: "CASH ON HAND", value: `$${formatMoney(reconciliation.cash_amount)}`, color: reconciliation.cash_amount < 0 ? "#b71c1c" : "#111", bold: true },
              { label: "EMERGENCY RESERVE", value: `$${formatMoney(reconciliation.emergency_reserve)}`, color: "#b45309" },
              { label: "BANK BALANCE", value: `$${formatMoney(reconciliation.bank_balance)}`, color: "#111", bold: true },
              { label: "ACCTS RECEIVABLE", value: `$${formatMoney(reconciliation.accounts_receivable)}`, color: reconciliation.accounts_receivable > 0 ? "#b45309" : "#111" },
            ].map(({ label, value, color, bold }) => (
              <Box key={label} sx={{ textAlign: "right" }}>
                <Typography sx={{ fontSize: 8.5, color: "#666", fontWeight: 700, letterSpacing: 0.3 }}>{label}</Typography>
                <Typography sx={{ fontSize: bold ? 15 : 12, fontWeight: bold ? 900 : 600, color }}>{value}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Divider sx={{ mb: 0.75 }} />

        {/* ── Tables ── */}
        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>

          {/* Revenue */}
          <Box sx={{ flex: "0 0 36%" }}>
            <Typography sx={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: "#555", mb: 0.5 }}>REVENUE</Typography>
            <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
              <Box component="thead">
                <Box component="tr">
                  <Box component="th" style={th}>Category</Box>
                  <Box component="th" style={thR}>Budgeted</Box>
                  <Box component="th" style={thR}>Actual</Box>
                </Box>
              </Box>
              <Box component="tbody">
                {sortedRevenue.map((r) => (
                  <React.Fragment key={r.category_id}>
                    <Box component="tr">
                      <Box component="td" style={td}>
                        {r.category_name}
                        {(r.is_dues || r.is_chapter_bonus) && <span style={{ fontSize: 9, color: "#aaa", marginLeft: 3 }}>✦</span>}
                      </Box>
                      <Box component="td" style={tdR}>${formatMoney(r.budgeted_amount)}</Box>
                      <Box component="td" style={tdR}>${formatMoney(r.actual_amount)}</Box>
                    </Box>
                    {r.is_dues && (
                      <>
                        <Box component="tr">
                          <Box component="td" style={tdSub}>Actives ({dues_config.active_count} × ${formatMoney(dues_config.dues_rate_active)})</Box>
                          <Box component="td" style={tdSubR}>${formatMoney(dues_config.active_count * dues_config.dues_rate_active)}</Box>
                          <Box component="td" style={{ ...tdSubR, color: "#ccc" }}>—</Box>
                        </Box>
                        <Box component="tr">
                          <Box component="td" style={tdSub}>Pledges (est. {dues_config.estimated_pledges} × ${formatMoney(dues_config.dues_rate_pledge)})</Box>
                          <Box component="td" style={tdSubR}>${formatMoney(dues_config.estimated_pledges * dues_config.dues_rate_pledge)}</Box>
                          <Box component="td" style={{ ...tdSubR, color: "#ccc" }}>—</Box>
                        </Box>
                      </>
                    )}
                    {r.is_chapter_bonus && (
                      <Box component="tr">
                        <Box component="td" style={tdSub}>8 months × ${formatMoney(dues_config.chapter_bonus_monthly_rate)}/mo</Box>
                        <Box component="td" style={{ ...tdSubR, color: "#ccc" }}>—</Box>
                        <Box component="td" style={{ ...tdSubR, color: "#ccc" }}>—</Box>
                      </Box>
                    )}
                  </React.Fragment>
                ))}
              </Box>
              <Box component="tfoot">
                <Box component="tr">
                  <Box component="td" style={tdTotal}>TOTAL</Box>
                  <Box component="td" style={tdTotalR}>${formatMoney(totals.revenue.budgeted)}</Box>
                  <Box component="td" style={tdTotalR}>${formatMoney(totals.revenue.actual)}</Box>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Expenses */}
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: "#555", mb: 0.5 }}>EXPENSES</Typography>
            <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
              <Box component="thead">
                <Box component="tr">
                  <Box component="th" style={th}>Category</Box>
                  <Box component="th" style={thR}>Prior Yr</Box>
                  <Box component="th" style={thR}>Budgeted</Box>
                  <Box component="th" style={thR}>Actual</Box>
                  <Box component="th" style={thR}>Remaining</Box>
                </Box>
              </Box>
              <Box component="tbody">
                {expense_rows.map((r) => (
                  <Box component="tr" key={r.category_id}>
                    <Box component="td" style={td}>{r.category_name}</Box>
                    <Box component="td" style={{ ...tdR, color: "#aaa" }}>${formatMoney(r.prior_year_actual)}</Box>
                    <Box component="td" style={tdR}>${formatMoney(r.budgeted_amount)}</Box>
                    <Box component="td" style={tdR}>${formatMoney(r.actual_amount)}</Box>
                    <Box component="td" style={{ ...tdR, color: r.remaining < 0 ? "#b71c1c" : "inherit", fontWeight: r.remaining < 0 ? 700 : "inherit" }}>
                      ${formatMoney(r.remaining)}
                    </Box>
                  </Box>
                ))}
              </Box>
              <Box component="tfoot">
                <Box component="tr">
                  <Box component="td" style={tdTotal}>TOTAL</Box>
                  <Box component="td" style={tdTotal} />
                  <Box component="td" style={tdTotalR}>${formatMoney(totals.expense.budgeted)}</Box>
                  <Box component="td" style={tdTotalR}>${formatMoney(totals.expense.actual)}</Box>
                  <Box component="td" style={{ ...tdTotalR, color: totals.expense.remaining < 0 ? "#b71c1c" : "#1b5e20" }}>
                    ${formatMoney(totals.expense.remaining)}
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* ── Footer ── */}
        <Box sx={{ mt: 0.75, pt: 0.5, borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography sx={{ fontSize: 9, color: "#aaa" }}>
            ✦ auto-calculated &nbsp;·&nbsp; Dues: actives × rate + est. pledges × pledge rate &nbsp;·&nbsp; Chapter Bonus: 8 months × monthly rate &nbsp;·&nbsp; Bank Balance = Cash on Hand + Emergency Reserve
          </Typography>
          {outstanding_disbursements.count > 0 && (
            <Typography sx={{ fontSize: 9, color: "#b45309", fontStyle: "italic" }}>
              ⚠ {outstanding_disbursements.count} approved expense{outstanding_disbursements.count !== 1 ? "s" : ""} (${formatMoney(outstanding_disbursements.total)}) not yet disbursed
            </Typography>
          )}
        </Box>
      </Box>
    </>
  );
}
