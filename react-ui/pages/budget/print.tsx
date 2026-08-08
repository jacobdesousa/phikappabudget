import * as React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Alert, Box, CircularProgress, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import type { IBudgetSummary } from "../../interfaces/api.interface";
import { getBudgetSummary } from "../../services/budgetService";
import { formatMoney } from "../../utils/money";
import { schoolYearLabel } from "../../utils/schoolYear";

const CELL = { fontSize: "0.7rem", py: "2px", px: "5px", border: "1px solid #ccc" };
const HEAD = { ...CELL, fontWeight: 700, backgroundColor: "#f0f0f0" };
const TOTAL = { ...CELL, fontWeight: 700, borderTop: "2px solid #999" };

export default function BudgetPrintPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<IBudgetSummary | null>(null);

  React.useEffect(() => {
    if (!router.isReady) return;
    let cancelled = false;
    const y = router.query.year ? Number(router.query.year) : undefined;
    (async () => {
      setLoading(true);
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
    if (!loading && summary) window.print();
  }, [loading, summary]);

  if (loading) return <Box p={4}><CircularProgress /></Box>;
  if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  if (!summary) return null;

  const { expense_rows, revenue_rows, reconciliation, totals, outstanding_disbursements } = summary;
  const yearLabel = schoolYearLabel(summary.year);
  const totalKnown = reconciliation.bank_balance + reconciliation.cash_amount + reconciliation.accounts_receivable;

  return (
    <>
      <Head>
        <title>Budget {yearLabel} — Print</title>
        <style>{`
          @media print {
            @page { margin: 12mm; }
            body { font-size: 10px; }
          }
          body { font-family: Arial, sans-serif; }
        `}</style>
      </Head>
      <Box p={2}>
        <Typography variant="h6" fontWeight={700} mb={1}>
          PKS AB Budget {yearLabel}
        </Typography>

        <Stack direction="row" spacing={2} alignItems="flex-start">
          {/* Revenue */}
          <Box flex="1">
            <Typography variant="caption" fontWeight={700} display="block" mb={0.5} sx={{ letterSpacing: 1 }}>
              REVENUE
            </Typography>
            <Table size="small" sx={{ tableLayout: "fixed", border: "1px solid #ccc" }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={HEAD}>Category</TableCell>
                  <TableCell align="right" sx={{ ...HEAD, width: 65 }}>Prior Yr</TableCell>
                  <TableCell align="right" sx={{ ...HEAD, width: 65 }}>Budgeted</TableCell>
                  <TableCell align="right" sx={{ ...HEAD, width: 65 }}>Actual</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {revenue_rows.map((r) => (
                  <TableRow key={r.category_id}>
                    <TableCell sx={CELL}>{r.category_name}</TableCell>
                    <TableCell align="right" sx={{ ...CELL, color: "#666" }}>${formatMoney(r.prior_year_actual)}</TableCell>
                    <TableCell align="right" sx={CELL}>${formatMoney(r.budgeted_amount)}</TableCell>
                    <TableCell align="right" sx={CELL}>${formatMoney(r.actual_amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell sx={TOTAL}>TOTAL</TableCell>
                  <TableCell sx={{ ...TOTAL, width: 65 }} />
                  <TableCell align="right" sx={{ ...TOTAL, width: 65 }}>${formatMoney(totals.revenue.budgeted)}</TableCell>
                  <TableCell align="right" sx={{ ...TOTAL, width: 65 }}>${formatMoney(totals.revenue.actual)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Box>

          {/* Expenses */}
          <Box flex="1.4">
            <Typography variant="caption" fontWeight={700} display="block" mb={0.5} sx={{ letterSpacing: 1 }}>
              EXPENSES
            </Typography>
            <Table size="small" sx={{ tableLayout: "fixed", border: "1px solid #ccc" }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={HEAD}>Category</TableCell>
                  <TableCell align="right" sx={{ ...HEAD, width: 60 }}>Prior Yr</TableCell>
                  <TableCell align="right" sx={{ ...HEAD, width: 65 }}>Budgeted</TableCell>
                  <TableCell align="right" sx={{ ...HEAD, width: 60 }}>Actual</TableCell>
                  <TableCell align="right" sx={{ ...HEAD, width: 65 }}>Remaining</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {expense_rows.map((r) => (
                  <TableRow key={r.category_id}>
                    <TableCell sx={CELL}>{r.category_name}</TableCell>
                    <TableCell align="right" sx={{ ...CELL, color: "#666" }}>${formatMoney(r.prior_year_actual)}</TableCell>
                    <TableCell align="right" sx={CELL}>${formatMoney(r.budgeted_amount)}</TableCell>
                    <TableCell align="right" sx={CELL}>${formatMoney(r.actual_amount)}</TableCell>
                    <TableCell
                      align="right"
                      sx={{ ...CELL, color: r.remaining < 0 ? "red" : "inherit", fontWeight: r.remaining < 0 ? 700 : "inherit" }}
                    >
                      ${formatMoney(r.remaining)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell sx={TOTAL}>TOTAL</TableCell>
                  <TableCell sx={{ ...TOTAL, width: 60 }} />
                  <TableCell align="right" sx={{ ...TOTAL, width: 65 }}>${formatMoney(totals.expense.budgeted)}</TableCell>
                  <TableCell align="right" sx={{ ...TOTAL, width: 60 }}>${formatMoney(totals.expense.actual)}</TableCell>
                  <TableCell
                    align="right"
                    sx={{ ...TOTAL, width: 65, color: totals.expense.remaining < 0 ? "red" : "inherit" }}
                  >
                    ${formatMoney(totals.expense.remaining)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Box>
        </Stack>

        {/* Reconciliation */}
        <Box mt={2}>
          <Typography variant="caption" fontWeight={700} display="block" mb={0.5} sx={{ letterSpacing: 1 }}>
            RECONCILIATION
          </Typography>
          <Table size="small" sx={{ tableLayout: "fixed", maxWidth: 500, border: "1px solid #ccc" }}>
            <TableBody>
              <TableRow>
                <TableCell sx={CELL}>Cash on Hand</TableCell>
                <TableCell align="right" sx={CELL}>${formatMoney(reconciliation.cash_amount)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={CELL}>Emergency Reserve</TableCell>
                <TableCell align="right" sx={CELL}>${formatMoney(reconciliation.emergency_reserve)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={CELL}>Bank Balance</TableCell>
                <TableCell align="right" sx={CELL}>${formatMoney(reconciliation.bank_balance)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={CELL}>Accounts Receivable</TableCell>
                <TableCell align="right" sx={CELL}>${formatMoney(reconciliation.accounts_receivable)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={TOTAL}>Total Known Money</TableCell>
                <TableCell align="right" sx={TOTAL}>${formatMoney(totalKnown)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ ...TOTAL, color: totals.net >= 0 ? "green" : "red" }}>
                  Net (Revenue − Expenses)
                </TableCell>
                <TableCell align="right" sx={{ ...TOTAL, color: totals.net >= 0 ? "green" : "red" }}>
                  {totals.net >= 0 ? "+" : ""}${formatMoney(totals.net)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>

        {outstanding_disbursements.count > 0 && (
          <Box mt={1.5}>
            <Typography variant="caption" color="text.secondary">
              Note: {outstanding_disbursements.count} approved expense
              {outstanding_disbursements.count !== 1 ? "s" : ""} totalling $
              {formatMoney(outstanding_disbursements.total)} not yet disbursed (not included in actuals above).
            </Typography>
          </Box>
        )}

        <Box mt={2}>
          <Typography variant="caption" color="text.secondary">
            Printed {new Date().toLocaleDateString()}
          </Typography>
        </Box>
      </Box>
    </>
  );
}
