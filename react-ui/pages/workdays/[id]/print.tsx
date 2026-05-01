import * as React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import dayjs from "dayjs";
import { Alert, Box, CircularProgress, Divider, Typography } from "@mui/material";
import type { IWorkday } from "../../../interfaces/api.interface";
import { getWorkday } from "../../../services/workdaysService";

export default function WorkdayPrintPage() {
  const router = useRouter();
  const id = Number(router.query.id);
  const autoprint = router.query.autoprint === "1";

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [workday, setWorkday] = React.useState<IWorkday | null>(null);

  React.useEffect(() => {
    if (!router.isReady) return;
    if (!Number.isFinite(id) || id <= 0) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const w = await getWorkday(id);
        if (cancelled) return;
        setWorkday(w);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load workday");
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router.isReady, id]);

  React.useEffect(() => {
    if (!autoprint) return;
    if (loading) return;
    if (!workday) return;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [autoprint, loading, workday]);

  if (!router.isReady || loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!workday) return <Alert severity="error">Workday not found.</Alert>;

  const workdayDate = workday.workday_date ? dayjs(workday.workday_date).format("MMMM D, YYYY") : "—";
  const bonusMonthLabel = workday.bonus_month ? dayjs(`${workday.bonus_month}-01`).format("MMMM YYYY") : null;

  const attendanceRows = (workday.attendance ?? []).slice().sort((a, b) => {
    const aName = a.last_name ? `${a.first_name ?? ""} ${a.last_name}`.trim() : `Brother #${a.brother_id}`;
    const bName = b.last_name ? `${b.first_name ?? ""} ${b.last_name}`.trim() : `Brother #${b.brother_id}`;
    return aName.localeCompare(bName);
  });

  return (
    <>
      <Head>
        <title>{`PKS - Workday (${dayjs(workday.workday_date).format("YYYY-MM-DD")})`}</title>
        <meta name="color-scheme" content="light" />
        <style>{`
          @page { size: A4; margin: 14mm; }
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
              Workday Attendance
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {workdayDate}
              {bonusMonthLabel ? ` • Counts for ${bonusMonthLabel} Bonus` : ""}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" sx={{ fontWeight: 900, mt: 1 }}>
          Attendance
        </Typography>
        <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", mt: 1, fontSize: 14 }}>
          <Box component="thead">
            <Box component="tr">
              <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid #ddd", py: 1, pr: 2 }}>
                Brother
              </Box>
              <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid #ddd", py: 1, width: 120 }}>
                Type
              </Box>
              <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid #ddd", py: 1, width: 160 }}>
                Status
              </Box>
              <Box component="th" sx={{ textAlign: "center", borderBottom: "1px solid #ddd", py: 1, width: 110 }}>
                Coveralls
              </Box>
              <Box component="th" sx={{ textAlign: "center", borderBottom: "1px solid #ddd", py: 1, width: 110 }}>
                Nametag
              </Box>
              <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid #ddd", py: 1, width: 170 }}>
                Makeup completed
              </Box>
            </Box>
          </Box>
          <Box component="tbody">
            {attendanceRows.map((a) => {
              const isPledge = (a.brother_status_at_workday ?? "Active") === "Pledge";
              const coverallApplicable = !isPledge && (a.status === "Present" || a.status === "Late");
              const makeupApplicable = a.status === "Missing" || a.status === "Excused";
              const makeupVal = a.makeup_completed_at ? dayjs(a.makeup_completed_at).format("MMM D, YYYY") : "—";

              return (
                <Box component="tr" key={a.id ?? a.brother_id}>
                  <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 1, pr: 2 }}>
                    {a.first_name || a.last_name ? `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() : `Brother #${a.brother_id}`}
                  </Box>
                  <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 1 }}>
                    {a.brother_status_at_workday ?? "Active"}
                  </Box>
                  <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 1 }}>
                    {a.status}
                  </Box>
                  <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 1, textAlign: "center" }}>
                    {coverallApplicable ? (a.coveralls ? "Yes" : "No") : "—"}
                  </Box>
                  <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 1, textAlign: "center" }}>
                    {coverallApplicable ? (a.nametag ? "Yes" : "No") : "—"}
                  </Box>
                  <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 1 }}>
                    {makeupApplicable ? makeupVal : "—"}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Summary
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          Total attended: <b>{workday.summary?.attended_counts?.total ?? 0}</b>
        </Typography>
      </Box>
    </>
  );
}


