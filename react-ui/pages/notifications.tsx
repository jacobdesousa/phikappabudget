import * as React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import { useRouter } from "next/router";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import MarkEmailUnreadOutlinedIcon from "@mui/icons-material/MarkEmailUnreadOutlined";
import PaymentsIcon from "@mui/icons-material/Payments";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import ConstructionIcon from "@mui/icons-material/Construction";
import BuildIcon from "@mui/icons-material/Build";
import CleaningServicesOutlinedIcon from "@mui/icons-material/CleaningServicesOutlined";
import AssignmentLateIcon from "@mui/icons-material/AssignmentLate";
import {
  getEmailPrefs,
  getNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
  updateEmailPrefs,
  type FeedItem,
  type FeedKind,
  type IEmailPrefs,
  type INotifications,
} from "../services/notificationsService";
import { formatDateOnly } from "../utils/date";
import PageLoader from "../components/PageLoader";

const KIND_ICON: Record<FeedKind, React.ReactNode> = {
  dues_due: <PaymentsIcon fontSize="small" />,
  house_fee_due: <AccountBalanceWalletOutlinedIcon fontSize="small" />,
  shift: <ConstructionIcon fontSize="small" />,
  workday: <BuildIcon fontSize="small" />,
  chore_duty: <CleaningServicesOutlinedIcon fontSize="small" />,
  makeup: <AssignmentLateIcon fontSize="small" />,
};

const SEVERITY_COLOR = {
  urgent: "error",
  warning: "warning",
  info: "default",
} as const;

// "In 3 days" reads better than a date you have to subtract from today, but the
// date still matters for anything more than a week out.
function whenLabel(item: FeedItem) {
  const d = item.days_until;
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  if (d < 0) return `${Math.abs(d)} days ago`;
  if (d <= 7) return `In ${d} days`;
  return formatDateOnly(item.date, { weekday: "short", month: "short", day: "numeric" });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [data, setData] = React.useState<INotifications | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [prefs, setPrefs] = React.useState<IEmailPrefs | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      setData(await getNotifications());
    } catch (e) {
      setError((e as Error)?.message ?? "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
    // Preferences are independent of the feed, so a failure here leaves the
    // switches hidden rather than breaking the page.
    getEmailPrefs()
      .then((d) => setPrefs(d.prefs))
      .catch(() => {});
  }, [load]);

  // Optimistic: a switch should move the moment it is clicked.
  async function togglePref(kind: keyof IEmailPrefs, enabled: boolean) {
    const before = prefs;
    setPrefs((p) => (p ? { ...p, [kind]: enabled } : p));
    try {
      const d = await updateEmailPrefs({ [kind]: enabled });
      setPrefs(d.prefs);
    } catch (e) {
      setPrefs(before);
      setError((e as Error)?.message ?? "Could not save that preference.");
    }
  }

  // Optimistic: the row should settle the moment it is clicked, not after a
  // round trip. A failed call puts it back.
  async function setRead(keys: string[], read: boolean) {
    if (keys.length === 0) return;
    const before = data;
    setData((prev) => {
      if (!prev) return prev;
      const items = prev.items.map((i) => (keys.includes(i.key) ? { ...i, read } : i));
      return { ...prev, items, counts: { ...prev.counts, unread: items.filter((i) => !i.read).length } };
    });
    try {
      await markNotificationsRead(keys, read);
    } catch (e) {
      setData(before);
      setError((e as Error)?.message ?? "Could not update that notification.");
    }
  }

  async function markAll() {
    setBusy(true);
    try {
      await markAllNotificationsRead();
      await load();
    } catch (e) {
      setError((e as Error)?.message ?? "Could not mark everything read.");
    } finally {
      setBusy(false);
    }
  }

  // Opening an item is the same as reading it.
  function openItem(item: FeedItem) {
    if (!item.read) void setRead([item.key], true);
    void router.push(item.href);
  }

  const items = data?.items ?? [];
  const unread = data?.counts.unread ?? 0;

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
            <Typography variant="h5">Notifications</Typography>
            <Typography variant="body2" color="text.secondary">
              Shifts, workdays, chore duty, makeups and money — everything that needs you.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {unread > 0 && <Chip label={`${unread} unread`} color="primary" size="small" />}
            <Button
              size="small"
              startIcon={<DoneAllIcon />}
              onClick={() => void markAll()}
              disabled={busy || unread === 0}
            >
              Mark all read
            </Button>
            <Tooltip title="Refresh">
              <IconButton onClick={() => void load()} aria-label="refresh">
                <RefreshOutlinedIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <PageLoader />
      ) : data?.brother_id == null ? (
        <Alert severity="info">
          Your account isn&apos;t linked to a brother record yet, so there is nothing to show here.
          Ask the Tau to link it.
        </Alert>
      ) : items.length === 0 ? (
        <Paper elevation={0} sx={{ p: 4, border: "1px solid", borderColor: "divider" }}>
          <Typography variant="body1" sx={{ textAlign: "center" }}>
            You&apos;re all caught up.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 0.5 }}>
            Nothing due, nothing owed, nothing scheduled in the next two weeks.
          </Typography>
        </Paper>
      ) : (
        <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
          <Stack divider={<Divider />}>
            {items.map((item) => (
              <Stack
                key={item.key}
                direction="row"
                spacing={1.5}
                alignItems="flex-start"
                onClick={() => openItem(item)}
                sx={{
                  px: 2,
                  py: 1.5,
                  cursor: "pointer",
                  // Unread rows carry a little more weight and a marker; read
                  // rows stay legible rather than greying out entirely.
                  bgcolor: item.read ? "transparent" : "action.hover",
                  "&:hover": { bgcolor: "action.selected" },
                }}
              >
                <Box
                  sx={{
                    mt: 0.5,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    flexShrink: 0,
                    bgcolor: item.read ? "transparent" : "primary.main",
                  }}
                />
                <Box sx={{ color: "text.secondary", mt: 0.25, display: "flex" }}>
                  {KIND_ICON[item.kind]}
                </Box>

                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: item.read ? 500 : 700 }}>
                    {item.title}
                  </Typography>
                  {item.detail && (
                    <Typography variant="body2" color="text.secondary">
                      {item.detail}
                    </Typography>
                  )}
                </Box>

                <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                  <Chip
                    label={whenLabel(item)}
                    size="small"
                    color={SEVERITY_COLOR[item.severity]}
                    variant={item.severity === "info" ? "outlined" : "filled"}
                  />
                  <Tooltip title={item.read ? "Mark as unread" : "Mark as read"}>
                    <IconButton
                      size="small"
                      aria-label={item.read ? "mark as unread" : "mark as read"}
                      onClick={(e) => {
                        e.stopPropagation();
                        void setRead([item.key], !item.read);
                      }}
                    >
                      {item.read ? (
                        <MarkEmailUnreadOutlinedIcon fontSize="small" />
                      ) : (
                        <DoneAllIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}

      {prefs && (
        <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            Email reminders
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Everything above also goes out by email. Turn off anything you&apos;d rather not get.
          </Typography>
          <Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={prefs.weekly_digest && prefs.all}
                  disabled={!prefs.all}
                  onChange={(e) => void togglePref("weekly_digest", e.target.checked)}
                />
              }
              label="Weekly digest — shifts, workdays, chores and makeups, every Monday"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={prefs.dues_due && prefs.all}
                  disabled={!prefs.all}
                  onChange={(e) => void togglePref("dues_due", e.target.checked)}
                />
              }
              label="Dues — when an instalment is coming up or outstanding"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={prefs.house_fee_due && prefs.all}
                  disabled={!prefs.all}
                  onChange={(e) => void togglePref("house_fee_due", e.target.checked)}
                />
              }
              label="Residence fees — when an instalment is coming up or outstanding"
            />
            <Divider sx={{ my: 1 }} />
            <FormControlLabel
              control={
                <Switch
                  checked={!prefs.all}
                  onChange={(e) => void togglePref("all", !e.target.checked)}
                />
              }
              label="Pause all reminder emails"
            />
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
