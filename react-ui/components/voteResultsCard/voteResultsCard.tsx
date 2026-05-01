import * as React from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    Collapse,
    Divider,
    IconButton,
    LinearProgress,
    Paper,
    Snackbar,
    Stack,
    Tooltip,
    Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LockIcon from "@mui/icons-material/Lock";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import type { IVote, IVoteResult } from "../../interfaces/api.interface";
import { closeVote, deleteVote, getVoteResults, setVoteResultsVisible } from "../../services/votesService";

type Props = {
    vote: IVote;
    canManage: boolean;
    onClosed: (voteId: number) => void;
    onDeleted: (voteId: number) => void;
    onUpdated: (updated: Partial<IVote> & { id: number }) => void;
};

export default function VoteResultsCard({ vote, canManage, onClosed, onDeleted, onUpdated }: Props) {
    const [results, setResults] = React.useState<IVoteResult | null>(null);
    const [resultsError, setResultsError] = React.useState<string | null>(null);
    const [actionError, setActionError] = React.useState<string | null>(null);
    const [closing, setClosing] = React.useState(false);
    const [togglingVisible, setTogglingVisible] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);
    const [copied, setCopied] = React.useState(false);
    const [expanded, setExpanded] = React.useState<Record<number, boolean>>({});

    const appUrl = typeof window !== "undefined"
        ? `${window.location.protocol}//${window.location.host}`
        : (process.env.NEXT_PUBLIC_APP_URL ?? "");
    const voteLink = `${appUrl}/votes/${vote.id}`;

    // Fetch results immediately, then poll every 5s while the vote is open.
    React.useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const r = await getVoteResults(vote.id);
                if (!cancelled) { setResults(r); setResultsError(null); }
            } catch {
                if (!cancelled) setResultsError("Failed to load results");
            }
        }
        load();
        if (vote.status !== "open") return;
        const interval = setInterval(load, 5000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [vote.id, vote.status]);

    const totalVotes = React.useMemo(() => {
        if (!results) return 0;
        // total unique voters = max count per option when allow_multiple, or sum when single
        // use voter list length if non-anonymous, else sum of counts / max depending on allow_multiple
        if (!vote.is_anonymous && results.voters) {
            return new Set(results.voters.map((v) => v.user_id)).size;
        }
        if (!vote.allow_multiple) {
            return results.options.reduce((s, o) => s + o.count, 0);
        }
        // For multiple-select we can't easily deduplicate without voter data
        return results.options.reduce((s, o) => s + o.count, 0);
    }, [results, vote.is_anonymous, vote.allow_multiple]);

    async function handleClose() {
        setClosing(true);
        setActionError(null);
        const r = await closeVote(vote.id);
        setClosing(false);
        if (!r.ok) { setActionError(r.error); return; }
        onClosed(vote.id);
    }

    async function handleToggleResultsVisible() {
        setTogglingVisible(true);
        setActionError(null);
        const r = await setVoteResultsVisible(vote.id, !vote.results_visible);
        setTogglingVisible(false);
        if (!r.ok) { setActionError(r.error); return; }
        onUpdated({ id: vote.id, results_visible: !vote.results_visible });
    }

    async function handleDelete() {
        setDeleting(true);
        setActionError(null);
        const r = await deleteVote(vote.id);
        setDeleting(false);
        if (!r.ok) { setActionError(r.error); return; }
        onDeleted(vote.id);
    }

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(voteLink);
            setCopied(true);
        } catch {
            // fallback: select input
        }
    }

    function toggleExpand(optId: number) {
        setExpanded((prev) => ({ ...prev, [optId]: !prev[optId] }));
    }

    return (
        <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                    <Stack spacing={0.5} flex={1}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Chip
                                label={vote.status === "open" ? "Open" : "Closed"}
                                color={vote.status === "open" ? "success" : "default"}
                                size="small"
                            />
                            {vote.is_anonymous && (
                                <Chip icon={<LockIcon />} label="Secret vote" size="small" variant="outlined" />
                            )}
                            {vote.allow_multiple && (
                                <Chip label="Multiple selections" size="small" variant="outlined" />
                            )}
                        </Stack>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {vote.question}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {totalVotes} {totalVotes === 1 ? "response" : "responses"}
                        </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} flexShrink={0}>
                        <Tooltip title="Copy voting link">
                            <IconButton size="small" onClick={handleCopy}>
                                <ContentCopyIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        {canManage && (
                            <Tooltip title="Delete vote">
                                <IconButton size="small" color="error" disabled={deleting} onClick={handleDelete}>
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Stack>
                </Stack>

                {actionError ? <Alert severity="error" sx={{ py: 0 }}>{actionError}</Alert> : null}

                {resultsError ? (
                    <Alert severity="warning" sx={{ py: 0 }}>{resultsError}</Alert>
                ) : results ? (
                    <Stack spacing={1}>
                        {results.options.map((opt) => {
                            const pct = totalVotes > 0 ? Math.round((opt.count / totalVotes) * 100) : 0;
                            const voters = results.voters?.filter((v) => v.option_id === opt.id) ?? [];
                            const hasVoters = !vote.is_anonymous && voters.length > 0;
                            return (
                                <Box key={opt.id}>
                                    <Stack direction="row" alignItems="center" spacing={1}>
                                        <Typography variant="body2" sx={{ minWidth: 120, flex: 1 }}>
                                            {opt.option_text}
                                        </Typography>
                                        <Box sx={{ flex: 2 }}>
                                            <LinearProgress
                                                variant="determinate"
                                                value={pct}
                                                sx={{ height: 10, borderRadius: 5 }}
                                            />
                                        </Box>
                                        <Typography variant="body2" sx={{ minWidth: 56, textAlign: "right" }}>
                                            {opt.count} ({pct}%)
                                        </Typography>
                                        {/* Fixed-width slot keeps bar width uniform across all options */}
                                        <IconButton
                                            size="small"
                                            onClick={() => toggleExpand(opt.id)}
                                            sx={{ visibility: hasVoters ? "visible" : "hidden" }}
                                        >
                                            {expanded[opt.id] ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                        </IconButton>
                                    </Stack>
                                    <Collapse in={Boolean(expanded[opt.id])}>
                                        <Box sx={{ pl: 2, pt: 0.5 }}>
                                            {voters.map((v) => (
                                                <Typography key={v.user_id} variant="body2" color="text.secondary">
                                                    {[v.first_name, v.last_name].filter(Boolean).join(" ") || v.email}
                                                </Typography>
                                            ))}
                                        </Box>
                                    </Collapse>
                                </Box>
                            );
                        })}
                        {/* Anonymous vote: show who voted as a flat list, not tied to any option */}
                        {vote.is_anonymous && (results.voters_anon?.length ?? 0) > 0 && (
                            <Box>
                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                                        Voted:
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {results.voters_anon!.map((v) =>
                                            [v.first_name, v.last_name].filter(Boolean).join(" ") || v.email
                                        ).join(", ")}
                                    </Typography>
                                </Stack>
                            </Box>
                        )}
                    </Stack>
                ) : (
                    <LinearProgress />
                )}

                <Divider />
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="body2" color="text.secondary" sx={{ flex: 1, wordBreak: "break-all" }}>
                        {voteLink}
                    </Typography>
                    {canManage ? (
                        <>
                            <Button
                                size="small"
                                variant="outlined"
                                disabled={togglingVisible}
                                onClick={handleToggleResultsVisible}
                            >
                                {togglingVisible ? "…" : vote.results_visible ? "Hide Results" : "Show Results"}
                            </Button>
                            {vote.status === "open" ? (
                                <Button size="small" variant="outlined" color="warning" disabled={closing} onClick={handleClose}>
                                    {closing ? "Closing…" : "Close Vote"}
                                </Button>
                            ) : null}
                        </>
                    ) : null}
                </Stack>
            </Stack>

            <Snackbar
                open={copied}
                onClose={() => setCopied(false)}
                autoHideDuration={2000}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                message="Link copied to clipboard"
            />
        </Paper>
    );
}
