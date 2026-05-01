import * as React from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import {
    Alert,
    AppBar,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    CircularProgress,
    FormControlLabel,
    LinearProgress,
    Radio,
    Stack,
    Toolbar,
    Typography,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import { useAuth } from "../../context/authContext";
import { getVote, getVoteResults, submitVoteResponse } from "../../services/votesService";
import type { IVote, IVoteResult } from "../../interfaces/api.interface";

export default function VotingPage() {
    const router = useRouter();
    const voteId = Number(router.query.voteId);
    const { user, loading: authLoading } = useAuth();

    const [vote, setVote] = React.useState<IVote | null>(null);
    const [results, setResults] = React.useState<IVoteResult | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [selected, setSelected] = React.useState<number[]>([]);
    const [submitting, setSubmitting] = React.useState(false);
    const [submitError, setSubmitError] = React.useState<string | null>(null);
    const [submitted, setSubmitted] = React.useState(false);

    // Redirect to login if not authenticated
    React.useEffect(() => {
        if (authLoading) return;
        if (!user) {
            const next = router.asPath;
            router.replace(`/login?reason=unauthorized&next=${encodeURIComponent(next)}`);
        }
    }, [authLoading, user, router]);

    React.useEffect(() => {
        if (!router.isReady || !Number.isFinite(voteId) || voteId <= 0) return;
        if (!user) return;

        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const v = await getVote(voteId);
                if (cancelled) return;
                setVote(v);
                // Pre-select the user's existing response if they already voted
                if (v.my_response?.option_ids?.length) {
                    setSelected(v.my_response.option_ids);
                    setSubmitted(true);
                }
                if (v.results_visible) {
                    const r = await getVoteResults(voteId);
                    if (!cancelled) setResults(r);
                }
            } catch (e: any) {
                if (!cancelled) setError(e?.message ?? "Failed to load vote");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [router.isReady, voteId, user]);

    // Poll for results_visible changing (sigma can show/hide results at any time).
    React.useEffect(() => {
        if (!vote || !user) return;
        if (vote.results_visible && results) return; // already showing results, no need to poll
        let cancelled = false;
        const interval = setInterval(async () => {
            try {
                const v = await getVote(voteId);
                if (cancelled) return;
                setVote(v);
                if (v.results_visible && !results) {
                    const r = await getVoteResults(voteId);
                    if (!cancelled) setResults(r);
                }
            } catch { /* ignore */ }
        }, 5000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [vote?.results_visible, results, voteId, user]);

    async function handleSubmit() {
        if (!vote || selected.length === 0) return;
        setSubmitting(true);
        setSubmitError(null);
        const result = await submitVoteResponse(voteId, selected);
        if (!result.ok) {
            setSubmitting(false);
            setSubmitError(result.error);
            return;
        }
        setSubmitting(false);
        setSubmitted(true);
    }

    function toggleOption(optId: number) {
        if (!vote) return;
        if (vote.allow_multiple) {
            setSelected((prev) =>
                prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId]
            );
        } else {
            setSelected([optId]);
        }
    }

    const totalVotes = React.useMemo(() => {
        if (!results) return 0;
        if (!vote?.is_anonymous && results.voters) {
            return new Set(results.voters.map((v) => v.user_id)).size;
        }
        if (!vote?.allow_multiple) {
            return results.options.reduce((s, o) => s + o.count, 0);
        }
        return results.options.reduce((s, o) => s + o.count, 0);
    }, [results, vote]);

    if (authLoading || (loading && !error)) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!user) return null; // redirecting

    return (
        <>
            <Head>
                <title>PKS – Meeting Vote</title>
            </Head>
            <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
                <AppBar position="static" elevation={1} color="default">
                    <Toolbar>
                        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
                            PKS&nbsp;<Typography component="span" variant="body1" color="text.secondary">| Meeting Vote</Typography>
                        </Typography>
                    </Toolbar>
                </AppBar>

                <Box sx={{ display: "flex", justifyContent: "center", p: 2, pt: 4 }}>
                    <Card sx={{ width: "100%", maxWidth: 480 }} elevation={2}>
                        <CardContent>
                            {error ? (
                                <Alert severity="error">{error}</Alert>
                            ) : !vote ? (
                                <CircularProgress />
                            ) : (
                                <Stack spacing={2}>
                                    <Stack direction="row" spacing={1} flexWrap="wrap">
                                        <Chip
                                            label={vote.status === "open" ? "Open" : "Closed"}
                                            color={vote.status === "open" ? "success" : "default"}
                                            size="small"
                                        />
                                        {vote.is_anonymous && (
                                            <Chip icon={<LockIcon />} label="Secret vote" size="small" variant="outlined" />
                                        )}
                                    </Stack>

                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        {vote.question}
                                    </Typography>

                                    {vote.allow_multiple && !submitted && vote.status === "open" && (
                                        <Typography variant="body2" color="text.secondary">
                                            You may select multiple options.
                                        </Typography>
                                    )}

                                    {/* Voting form — shown when vote is open and user hasn't voted yet */}
                                    {vote.status === "open" && !submitted ? (
                                        <>
                                            <Stack spacing={0.5}>
                                                {vote.options.map((opt) =>
                                                    vote.allow_multiple ? (
                                                        <FormControlLabel
                                                            key={opt.id}
                                                            sx={{ ml: 0, alignItems: "center" }}
                                                            control={
                                                                <Checkbox
                                                                    checked={selected.includes(opt.id)}
                                                                    onChange={() => toggleOption(opt.id)}
                                                                    sx={{ mr: 1 }}
                                                                />
                                                            }
                                                            label={opt.option_text}
                                                        />
                                                    ) : (
                                                        <FormControlLabel
                                                            key={opt.id}
                                                            sx={{ ml: 0, alignItems: "center" }}
                                                            control={
                                                                <Radio
                                                                    checked={selected.includes(opt.id)}
                                                                    onChange={() => toggleOption(opt.id)}
                                                                    sx={{ mr: 1 }}
                                                                />
                                                            }
                                                            label={opt.option_text}
                                                        />
                                                    )
                                                )}
                                            </Stack>
                                            {submitError ? <Alert severity="error">{submitError}</Alert> : null}
                                            <Button
                                                variant="contained"
                                                fullWidth
                                                disabled={selected.length === 0 || submitting}
                                                onClick={handleSubmit}
                                            >
                                                {submitting ? "Submitting…" : "Submit Vote"}
                                            </Button>
                                        </>
                                    ) : null}

                                    {/* Post-vote message */}
                                    {submitted && vote.status === "open" ? (
                                        <Alert severity="success">Your vote has been recorded.</Alert>
                                    ) : null}

                                    {/* Results — only shown when sigma has toggled them visible */}
                                    {vote.results_visible && results ? (
                                        <Stack spacing={1}>
                                            <Typography variant="subtitle2" color="text.secondary">
                                                Results · {totalVotes} {totalVotes === 1 ? "response" : "responses"}
                                            </Typography>
                                            {results.options.map((opt) => {
                                                const pct = totalVotes > 0 ? Math.round((opt.count / totalVotes) * 100) : 0;
                                                const isSelected = selected.includes(opt.id);
                                                return (
                                                    <Box key={opt.id}>
                                                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                                                            <Typography variant="body2" sx={{ fontWeight: isSelected ? 700 : 400 }}>
                                                                {opt.option_text}
                                                                {isSelected ? " ✓" : ""}
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary">
                                                                {opt.count} ({pct}%)
                                                            </Typography>
                                                        </Stack>
                                                        <LinearProgress
                                                            variant="determinate"
                                                            value={pct}
                                                            sx={{ height: 8, borderRadius: 4 }}
                                                            color={isSelected ? "primary" : "inherit"}
                                                        />
                                                    </Box>
                                                );
                                            })}
                                        </Stack>
                                    ) : null}

                                    {vote.results_visible && !results ? (
                                        <CircularProgress size={24} />
                                    ) : null}
                                </Stack>
                            )}
                        </CardContent>
                    </Card>
                </Box>
            </Box>
        </>
    );
}
