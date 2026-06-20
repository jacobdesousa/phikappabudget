import * as React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import dayjs from "dayjs";
import { Alert, Box, CircularProgress, Divider, Typography } from "@mui/material";
import type { IRoomDrawStanding } from "../../interfaces/api.interface";
import { getStandings } from "../../services/roomDrawService";

export default function RoomDrawPrintPage() {
  const router = useRouter();
  const detailed = router.query.detailed === "1";
  const autoprint = router.query.autoprint === "1";

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [standings, setStandings] = React.useState<IRoomDrawStanding[]>([]);

  React.useEffect(() => {
    if (!router.isReady) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await getStandings();
        if (cancelled) return;
        setStandings(rows ?? []);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load room draw standings");
        setStandings([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router.isReady]);

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

  // Bypasses (alpha/beta/pi) first, then regular, then over-graduation
  const bypasses = standings.filter((s) => s.bypasses_ranking);
  const normal = standings.filter((s) => !s.bypasses_ranking);
  const regular = normal.filter((s) => !s.over_graduation);
  const overGrad = normal.filter((s) => s.over_graduation);
  const ordered = [...bypasses, ...regular, ...overGrad];

  let rankCounter = 0;
  function rankFor(s: IRoomDrawStanding) {
    if (s.bypasses_ranking) return "—";
    rankCounter++;
    return String(rankCounter);
  }

  return (
    <>
      <Head>
        <title>{`PKS - Room Draw Standings${detailed ? " (Detailed)" : ""}`}</title>
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
              Room Draw Standings{detailed ? " — Detailed" : ""}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {dayjs().format("MMMM D, YYYY")}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {bypasses.length > 0 && (
          <>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <b>{bypasses.map((s) => `${s.first_name} ${s.last_name}`).join(", ")}</b> choose their rooms first (Alpha → Beta → Pi), superseding the points system.
            </Typography>
            <Divider sx={{ my: 2 }} />
          </>
        )}

        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Standings
        </Typography>
        <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", mt: 1, fontSize: 13 }}>
          <Box component="thead">
            <Box component="tr">
              <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid #ddd", py: 1, width: 36 }}>#</Box>
              <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid #ddd", py: 1, pr: 2 }}>Brother</Box>
              <Box component="th" sx={{ textAlign: "right", borderBottom: "1px solid #ddd", py: 1, width: 100 }}>Points</Box>
              <Box component="th" sx={{ textAlign: "right", borderBottom: "1px solid #ddd", py: 1, width: 120 }}>Active Until</Box>
            </Box>
          </Box>
          <Box component="tbody">
            {ordered.map((s) => (
              <Box component="tr" key={s.brother_id}>
                <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 0.75 }}>{rankFor(s)}</Box>
                <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 0.75, pr: 2 }}>
                  {s.first_name} {s.last_name}
                  {s.over_graduation ? " ⚠" : ""}
                </Box>
                <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 0.75, textAlign: "right" }}>
                  {s.points_stripped ? "Stripped" : s.total.toFixed(2)}
                </Box>
                <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 0.75, textAlign: "right", color: "#666" }}>
                  {s.accumulation_end ? dayjs(s.accumulation_end).format("MMM YYYY") : "—"}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {detailed && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Detailed Breakdown
            </Typography>
            {ordered.map((s) => (
              <Box key={s.brother_id} sx={{ mt: 2, pageBreakInside: "avoid" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  {s.first_name} {s.last_name} — {s.points_stripped ? "Stripped" : s.total.toFixed(2)} pts
                </Typography>

                <Box sx={{ fontSize: 13, mt: 0.5 }}>
                  <Typography variant="body2">Semesters as active brother: <b>+{s.breakdown.past_brother}</b></Typography>
                  <Typography variant="body2">Past office points: <b>+{s.breakdown.past_office}</b></Typography>
                  <Typography variant="body2">Incoming election points: <b>+{s.breakdown.incoming}</b></Typography>
                  <Typography variant="body2">Missed meetings: <b>{s.breakdown.meeting_deductions.toFixed(2)}</b></Typography>
                  <Typography variant="body2">Missed workdays: <b>{s.breakdown.workday_deductions.toFixed(2)}</b></Typography>
                  <Typography variant="body2">
                    Legacy adjustments: <b>{s.breakdown.legacy > 0 ? `+${s.breakdown.legacy}` : s.breakdown.legacy.toFixed(2)}</b>
                  </Typography>
                </Box>

                {s.details.active_semesters.length > 0 && (
                  <Box sx={{ mt: 0.75 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      Active semesters counted ({s.details.active_semesters.length}):
                    </Typography>{" "}
                    <Typography variant="caption">{s.details.active_semesters.join(", ")}</Typography>
                  </Box>
                )}

                {s.details.office_terms.length > 0 && (
                  <Box sx={{ mt: 0.75 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, display: "block" }}>
                      Offices &amp; terms:
                    </Typography>
                    {s.details.office_terms.map((t, i) => (
                      <Typography variant="caption" key={`${t.office_key}-${t.start_date}-${i}`} sx={{ display: "block", pl: 1 }}>
                        {t.display_name} ({dayjs(t.start_date).format("MMM YYYY")} – {t.end_date ? dayjs(t.end_date).format("MMM YYYY") : "Present"})
                        {t.semesters.length > 0 ? ` · ${t.semesters.join(", ")}` : ""}
                        {t.past_points > 0 ? ` · +${t.past_points} past` : ""}
                        {t.incoming_points > 0 ? ` · +${t.incoming_points} incoming` : ""}
                      </Typography>
                    ))}
                  </Box>
                )}

                <Divider sx={{ mt: 1.5 }} />
              </Box>
            ))}
          </>
        )}
      </Box>
    </>
  );
}
