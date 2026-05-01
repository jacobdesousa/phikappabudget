import * as React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import dayjs from "dayjs";
import { Alert, Box, CircularProgress, Divider, Typography } from "@mui/material";
import type { IBrother, IMeetingMinutes, IVoteResult } from "../../../interfaces/api.interface";
import { getAllBrothers } from "../../../services/brotherService";
import { getMeeting } from "../../../services/meetingsService";
import { listVotesForMeeting, getVoteResults } from "../../../services/votesService";
import { schoolYearLabel, schoolYearStartForDate } from "../../../utils/schoolYear";

function formatArrivalTime(hhmm?: string | null): string {
  if (!hhmm) return "";
  const d = dayjs(`1970-01-01 ${hhmm}`);
  if (!d.isValid()) return hhmm;
  return d.format("h:mm A");
}

const OFFICER_LABELS: Record<string, string> = {
  Alpha: "Alpha",
  Beta: "Beta",
  Pi: "Pi",
  Sigma: "Sigma",
  Tau: "Tau",
  Chi: "Chi",
  Gamma: "Gamma",
  Psi: "Psi",
  Theta: "Theta",
  Iota: "Iota",
  Upsilon: "Upsilon",
  Phi: "Phi",
  Omega: "Omega",
  Rho: "Rho",
  Omicron: "Omicron",
  Zeta: "Zeta",
  ChapterAdvisor: "Chapter Advisor",
  AlumniPresident: "Alumni President",
};

export default function MeetingMinutesPrintPage() {
  const router = useRouter();
  const id = Number(router.query.id);
  const autoprint = router.query.autoprint === "1";

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [meeting, setMeeting] = React.useState<IMeetingMinutes | null>(null);
  const [brothers, setBrothers] = React.useState<IBrother[]>([]);
  const [voteResults, setVoteResults] = React.useState<IVoteResult[]>([]);

  const nameById = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const b of brothers) {
      if (!b.id) continue;
      map.set(b.id, `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim());
    }
    return map;
  }, [brothers]);

  React.useEffect(() => {
    if (!router.isReady) return;
    if (!Number.isFinite(id) || id <= 0) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [m, b, votes] = await Promise.all([getMeeting(id), getAllBrothers(), listVotesForMeeting(id)]);
        if (cancelled) return;
        setMeeting(m);
        setBrothers(b);
        // Fetch results for all votes
        if (votes.length > 0) {
          const results = await Promise.all(votes.map((v) => getVoteResults(v.id).catch(() => null)));
          if (!cancelled) setVoteResults(results.filter(Boolean) as IVoteResult[]);
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to load meeting minutes");
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
    if (!meeting) return;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [autoprint, loading, meeting]);

  if (!router.isReady || loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!meeting) return <Alert severity="error">Meeting not found.</Alert>;

  const meetingDate = dayjs(meeting.meeting_date).format("MMMM D, YYYY");
  const schoolYear = schoolYearLabel(meeting.school_year ?? schoolYearStartForDate(dayjs(meeting.meeting_date).toDate()));

  const acceptMoved = meeting.motion_accept_moved_by_brother_id
    ? nameById.get(meeting.motion_accept_moved_by_brother_id) ?? "________"
    : "________";
  const acceptSeconded = meeting.motion_accept_seconded_by_brother_id
    ? nameById.get(meeting.motion_accept_seconded_by_brother_id) ?? "________"
    : "________";
  const endMoved = meeting.motion_end_moved_by_brother_id ? nameById.get(meeting.motion_end_moved_by_brother_id) ?? "________" : "________";
  const endSeconded = meeting.motion_end_seconded_by_brother_id
    ? nameById.get(meeting.motion_end_seconded_by_brother_id) ?? "________"
    : "________";

  const attendanceRows = (meeting.attendance ?? []).slice().sort((a, b) => {
    const aName = a.last_name ? `${a.first_name ?? ""} ${a.last_name}`.trim() : a.member_name ?? "";
    const bName = b.last_name ? `${b.first_name ?? ""} ${b.last_name}`.trim() : b.member_name ?? "";
    return aName.localeCompare(bName);
  });

  const officerRows = (meeting.officer_notes ?? [])
    .filter((n) => (n.notes ?? "").trim())
    .slice()
    .sort((a, b) => (a.officer_key ?? "").localeCompare(b.officer_key ?? ""));

  return (
    <>
      <Head>
        <title>{`PKS - Meeting Minutes (${dayjs(meeting.meeting_date).format("YYYY-MM-DD")})`}</title>
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
              {meeting.title?.trim() ? meeting.title : "Chapter Meeting Minutes"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {meetingDate} • {schoolYear}
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
                Member
              </Box>
              <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid #ddd", py: 1, width: 180 }}>
                Status
              </Box>
              <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid #ddd", py: 1 }}>
                Details
              </Box>
            </Box>
          </Box>
          <Box component="tbody">
            {attendanceRows.map((r) => (
              <Box component="tr" key={r.id ?? `${r.brother_id ?? "x"}-${r.member_name ?? "y"}-${r.status}`}>
                <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 1, pr: 2 }}>
                  {r.brother_id ? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() : r.member_name}
                </Box>
                <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 1 }}>
                  {r.status}
                </Box>
                <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 1 }}>
                  {r.status === "Late" && r.late_arrival_time ? `Arrived ${formatArrivalTime(r.late_arrival_time)}` : null}
                  {r.status === "Excused" && r.excused_reason ? r.excused_reason : null}
                  {r.status !== "Late" && r.status !== "Excused" ? "—" : null}
                  {(r.status === "Late" && !r.late_arrival_time) || (r.status === "Excused" && !r.excused_reason) ? "—" : null}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Opening
        </Typography>
        <Typography variant="body1" sx={{ mt: 1 }}>
          Motion to accept previous week&apos;s minutes by <b>{acceptMoved}</b>, seconded by <b>{acceptSeconded}</b>.
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Communications / Committees
        </Typography>
        <Typography variant="body1" sx={{ mt: 1, whiteSpace: "pre-wrap" }}>
          {meeting.communications?.trim() ? meeting.communications : "—"}
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Officer reports
        </Typography>
        {officerRows.length === 0 ? (
          <Typography variant="body1" sx={{ mt: 1 }}>
            —
          </Typography>
        ) : (
          <Box sx={{ mt: 1 }}>
            {officerRows.map((n) => (
              <Box key={n.id ?? n.officer_key} sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  {OFFICER_LABELS[n.officer_key] ?? n.officer_key}
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
                  {n.notes}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Old business
        </Typography>
        <Typography variant="body1" sx={{ mt: 1, whiteSpace: "pre-wrap" }}>
          {meeting.old_business?.trim() ? meeting.old_business : "—"}
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          New business
        </Typography>
        <Typography variant="body1" sx={{ mt: 1, whiteSpace: "pre-wrap" }}>
          {meeting.new_business?.trim() ? meeting.new_business : "—"}
        </Typography>

        {voteResults.length > 0 ? (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Votes
            </Typography>
            {voteResults.map((result) => {
              const totalVotes = result.voters
                ? new Set(result.voters.map((v) => v.user_id)).size
                : result.options.reduce((s, o) => s + o.count, 0);
              return (
                <Box key={result.vote_id} sx={{ mt: 2, mb: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {result.question}
                    {result.is_anonymous ? " (Secret vote)" : ""}
                    {" · "}{totalVotes} {totalVotes === 1 ? "response" : "responses"}
                  </Typography>
                  <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", mt: 1, fontSize: 13 }}>
                    <Box component="thead">
                      <Box component="tr">
                        <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid #ddd", py: 0.5, pr: 2 }}>Option</Box>
                        <Box component="th" sx={{ textAlign: "right", borderBottom: "1px solid #ddd", py: 0.5, width: 60 }}>Votes</Box>
                        {!result.is_anonymous && <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid #ddd", py: 0.5, pl: 2 }}>Members</Box>}
                      </Box>
                    </Box>
                    <Box component="tbody">
                      {result.options.map((opt) => {
                        const voters = result.voters?.filter((v) => v.option_id === opt.id) ?? [];
                        return (
                          <Box component="tr" key={opt.id}>
                            <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 0.5, pr: 2 }}>{opt.option_text}</Box>
                            <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 0.5, textAlign: "right" }}>{opt.count}</Box>
                            {!result.is_anonymous && (
                              <Box component="td" sx={{ borderBottom: "1px solid #f0f0f0", py: 0.5, pl: 2 }}>
                                {voters.map((v) => [v.first_name, v.last_name].filter(Boolean).join(" ") || v.email).join(", ") || "—"}
                              </Box>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </>
        ) : null}

        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Closing
        </Typography>
        <Typography variant="subtitle2" sx={{ fontWeight: 900, mt: 1 }}>
          Betterment
        </Typography>
        <Typography variant="body1" sx={{ mt: 1, whiteSpace: "pre-wrap" }}>
          {meeting.betterment?.trim() ? meeting.betterment : "—"}
        </Typography>
        <Typography variant="body1" sx={{ mt: 1 }}>
          Motion to end meeting by <b>{endMoved}</b>, seconded by <b>{endSeconded}</b>.
        </Typography>
      </Box>
    </>
  );
}


