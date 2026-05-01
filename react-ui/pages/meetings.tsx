import * as React from "react";
import { useRouter } from "next/router";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import dayjs from "dayjs";
import { createMeeting, deleteMeeting, getMeetings } from "../services/meetingsService";
import type { IMeetingMinutesListItem } from "../interfaces/api.interface";
import { schoolYearLabel, schoolYearStartForDate } from "../utils/schoolYear";
import { useAuth } from "../context/authContext";

export default function MeetingsPage() {
  const router = useRouter();
  const { can } = useAuth();
  const canWrite = can("meetings.write");
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<IMeetingMinutesListItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [newDate, setNewDate] = React.useState(dayjs().format("YYYY-MM-DD"));
  const [newTitle, setNewTitle] = React.useState<string>("");
  const [creating, setCreating] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<IMeetingMinutesListItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMeetings();
      setItems(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load meetings");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
          <Box>
            <Typography variant="h5">Meetings</Typography>
            <Typography variant="body2" color="text.secondary">
              Record attendance and officer reports for each weekly chapter meeting.
            </Typography>
          </Box>
          {canWrite ? (
            <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setCreateOpen(true)}>
              New meeting
            </Button>
          ) : null}
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {loading ? (
        <CircularProgress />
      ) : (
        <Stack spacing={1}>
          {items.length === 0 ? (
            <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
              <Typography variant="body2" color="text.secondary">
                No meetings yet. Create one to start taking minutes.
              </Typography>
            </Paper>
          ) : null}

          {items.map((m) => {
            const d = m.meeting_date ? dayjs(m.meeting_date).format("MMM D, YYYY") : "—";
            const sy = m.school_year
              ? schoolYearLabel(m.school_year)
              : schoolYearLabel(schoolYearStartForDate(dayjs(m.meeting_date).toDate()));
            return (
              <Paper
                key={m.id}
                elevation={0}
                sx={{
                  p: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  cursor: "pointer",
                  "&:hover": { borderColor: "text.secondary" },
                }}
                onClick={() => router.push(`/meetings/${m.id}`)}
              >
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ sm: "center" }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {m.title?.trim() ? m.title : `Meeting Minutes — ${d}`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {d} • {sy}
                    </Typography>
                  </Box>
                  {canWrite ? (
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteOutlineIcon />}
                      onClick={async (e) => {
                        e.stopPropagation();
                        setDeleteError(null);
                        setDeleteTarget(m);
                        setDeleteOpen(true);
                      }}
                    >
                      Delete
                    </Button>
                  ) : null}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      <Dialog open={deleteOpen && canWrite} onClose={() => setDeleteOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          Delete meeting minutes
          <IconButton onClick={() => setDeleteOpen(false)} aria-label="close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {deleteError ? <Alert severity="error">{deleteError}</Alert> : null}
          <Typography sx={{ mt: deleteError ? 2 : 0 }}>
            Are you sure you want to delete{" "}
            <b>
              {deleteTarget?.title?.trim()
                ? deleteTarget.title
                : deleteTarget?.meeting_date
                  ? `Meeting Minutes — ${dayjs(deleteTarget.meeting_date).format("MMM D, YYYY")}`
                  : "these meeting minutes"}
            </b>
            ?
          </Typography>
          {deleteTarget?.meeting_date ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {`Date: ${dayjs(deleteTarget.meeting_date).format("MMMM D, YYYY")}`}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDeleteOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            disabled={deleting || !deleteTarget?.id}
            onClick={async () => {
              if (!deleteTarget?.id) return;
              setDeleting(true);
              setDeleteError(null);
              const result = await deleteMeeting(deleteTarget.id);
              setDeleting(false);
              if (!result.ok) {
                setDeleteError(result.error ?? "Could not delete meeting minutes.");
                return;
              }
              setDeleteOpen(false);
              setDeleteTarget(null);
              void refresh();
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createOpen && canWrite} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New meeting</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="Meeting date"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Title (optional)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g., Chapter Meeting Minutes"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setCreateOpen(false)} disabled={creating}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            disabled={creating}
            onClick={async () => {
              setCreating(true);
              setError(null);
              const dateObj = dayjs(newDate).toDate();

              // Start with an empty attendance list; the editor will populate from brothers.
              const result = await createMeeting({
                meeting_date: dateObj,
                title: newTitle?.trim() ? newTitle.trim() : null,
                attendance: [],
                officer_notes: [],
              });

              setCreating(false);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setCreateOpen(false);
              await router.push(`/meetings/${result.id}`);
            }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}


