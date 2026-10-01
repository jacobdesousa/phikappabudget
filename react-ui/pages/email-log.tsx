import * as React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useAuth } from "../context/authContext";
import PageLoader from "../components/PageLoader";
import {
  getEmailLog,
  getEmailLogEntry,
  type EmailStatus,
  type IEmailLogEntry,
  type IEmailLogRow,
} from "../services/emailLogService";

const STATUS_COLOR: Record<EmailStatus, "success" | "error" | "warning" | "default"> = {
  sent: "success",
  failed: "error",
  pending: "warning",
  dev: "default",
};

// Kinds are open-ended on the server (an untagged sender lands as "other"), so
// this list is only the filter's suggestions, not a constraint.
const KINDS = [
  { value: "", label: "All kinds" },
  { value: "invite", label: "Invite" },
  { value: "password_reset", label: "Password reset" },
  { value: "meeting_minutes", label: "Meeting minutes" },
  { value: "weekly_digest", label: "Weekly digest" },
  { value: "dues_due", label: "Dues" },
  { value: "house_fee_due", label: "House fees" },
  { value: "other", label: "Other" },
];

function fmtWhen(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function recipientName(row: IEmailLogRow) {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ");
  return name || null;
}

export default function EmailLogPage() {
  const { can } = useAuth();
  const canRead = can("admin.users");

  const [rows, setRows] = React.useState<IEmailLogRow[]>([]);
  const [counts, setCounts] = React.useState<Partial<Record<EmailStatus, number>>>({});
  const [nextCursor, setNextCursor] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [kind, setKind] = React.useState("");
  const [status, setStatus] = React.useState<EmailStatus | "">("");
  const [search, setSearch] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const [expanded, setExpanded] = React.useState<number | null>(null);
  const [entry, setEntry] = React.useState<IEmailLogEntry | null>(null);
  const [entryLoading, setEntryLoading] = React.useState(false);

  const filters = React.useMemo(
    () => ({
      kind: kind || undefined,
      status: (status || undefined) as EmailStatus | undefined,
      q: search.trim() || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [kind, status, search, from, to]
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await getEmailLog(filters);
      setRows(page.rows);
      setCounts(page.counts);
      setNextCursor(page.next_cursor);
    } catch (e) {
      setError((e as Error)?.message ?? "Could not load the email log.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Typing in the search box shouldn't fire a request per keystroke.
  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    const t = setTimeout(() => void load(), 300);
    return () => clearTimeout(t);
  }, [load, canRead]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await getEmailLog({ ...filters, cursor: nextCursor });
      setRows((prev) => [...prev, ...page.rows]);
      setNextCursor(page.next_cursor);
    } catch (e) {
      setError((e as Error)?.message ?? "Could not load more.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggleRow(id: number) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    setEntry(null);
    setEntryLoading(true);
    try {
      setEntry(await getEmailLogEntry(id));
    } catch (e) {
      setError((e as Error)?.message ?? "Could not load that email.");
    } finally {
      setEntryLoading(false);
    }
  }

  if (!canRead) {
    return <Alert severity="error">You don&apos;t have permission to view the email log.</Alert>;
  }

  const failed = counts.failed ?? 0;

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ sm: "center" }}
          spacing={1}
        >
          <Box>
            <Typography variant="h5">Email Log</Typography>
            <Typography variant="body2" color="text.secondary">
              Every email the platform has sent, including the ones that failed.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {failed > 0 && (
              <Chip label={`${failed} failed`} color="error" size="small" />
            )}
            {counts.sent != null && (
              <Chip label={`${counts.sent} sent`} color="success" size="small" variant="outlined" />
            )}
            {counts.dev != null && (
              <Tooltip title="Logged but never sent — the mailer was in dev mode">
                <Chip label={`${counts.dev} dev`} size="small" variant="outlined" />
              </Tooltip>
            )}
            <Tooltip title="Refresh">
              <IconButton onClick={() => void load()} aria-label="refresh">
                <RefreshOutlinedIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <TextField
            size="small"
            placeholder="Recipient or subject"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} /> }}
            sx={{ flexGrow: 1, minWidth: 220 }}
          />
          <TextField
            select
            size="small"
            label="Kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            sx={{ minWidth: 170 }}
          >
            {KINDS.map((k) => (
              <MenuItem key={k.value} value={k.value}>
                {k.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as EmailStatus | "")}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="sent">Sent</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="dev">Dev</MenuItem>
          </TextField>
          <TextField
            size="small"
            type="date"
            label="From"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            size="small"
            type="date"
            label="To"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <PageLoader />
      ) : (
        <Paper elevation={0} sx={{ p: 0, border: "1px solid", borderColor: "divider" }}>
          {rows.length === 0 ? (
            <Box sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary">
                No emails match these filters.
              </Typography>
            </Box>
          ) : (
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 150 }}>Sent</TableCell>
                    <TableCell sx={{ width: 230 }}>To</TableCell>
                    <TableCell sx={{ width: 150 }}>Kind</TableCell>
                    <TableCell>Subject</TableCell>
                    <TableCell sx={{ width: 110 }}>Status</TableCell>
                    <TableCell sx={{ width: 50 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const open = expanded === row.id;
                    return (
                      <React.Fragment key={row.id}>
                        <TableRow
                          hover
                          onClick={() => void toggleRow(row.id)}
                          sx={{ cursor: "pointer" }}
                        >
                          <TableCell sx={{ whiteSpace: "nowrap" }}>
                            {fmtWhen(row.sent_at ?? row.created_at)}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{row.to_email}</Typography>
                            {recipientName(row) && (
                              <Typography variant="caption" color="text.secondary">
                                {recipientName(row)}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip label={row.kind} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>{row.subject}</TableCell>
                          <TableCell>
                            <Chip
                              label={row.status}
                              size="small"
                              color={STATUS_COLOR[row.status] ?? "default"}
                            />
                          </TableCell>
                          <TableCell>
                            {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ py: 0, border: 0 }} colSpan={6}>
                            <Collapse in={open} unmountOnExit>
                              <Box sx={{ py: 2 }}>
                                {entryLoading || !entry ? (
                                  <PageLoader py={2} />
                                ) : (
                                  <Stack spacing={1.5}>
                                    {entry.error && (
                                      <Alert severity="error">{entry.error}</Alert>
                                    )}
                                    <Stack
                                      direction="row"
                                      spacing={3}
                                      flexWrap="wrap"
                                      useFlexGap
                                      sx={{ color: "text.secondary" }}
                                    >
                                      <Typography variant="caption">
                                        Queued {fmtWhen(entry.created_at)}
                                      </Typography>
                                      {entry.attachments && (
                                        <Typography variant="caption">
                                          Attachments: {entry.attachments}
                                        </Typography>
                                      )}
                                      {entry.actor_email && (
                                        <Typography variant="caption">
                                          Triggered by {entry.actor_email}
                                        </Typography>
                                      )}
                                      {entry.provider_message_id && (
                                        <Typography variant="caption">
                                          SES id {entry.provider_message_id}
                                        </Typography>
                                      )}
                                    </Stack>
                                    <Divider />
                                    <Box
                                      component="pre"
                                      sx={{
                                        m: 0,
                                        p: 1.5,
                                        bgcolor: "action.hover",
                                        borderRadius: 1,
                                        fontSize: 12.5,
                                        whiteSpace: "pre-wrap",
                                        wordBreak: "break-word",
                                        fontFamily:
                                          "ui-monospace, SFMono-Regular, Menlo, monospace",
                                      }}
                                    >
                                      {entry.body_text || "(no plain-text body recorded)"}
                                    </Box>
                                  </Stack>
                                )}
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {nextCursor && (
            <Box sx={{ p: 2, textAlign: "center" }}>
              <Button onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </Box>
          )}
        </Paper>
      )}
    </Stack>
  );
}
