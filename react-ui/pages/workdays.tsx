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
import type { IWorkdayListItem } from "../interfaces/api.interface";
import { createWorkday, deleteWorkday, getWorkdays } from "../services/workdaysService";
import { useAuth } from "../context/authContext";

function todayIso(): string {
  return dayjs().format("YYYY-MM-DD");
}

export default function WorkdaysPage() {
  const router = useRouter();
  const { can } = useAuth();
  const canWrite = can("workdays.write");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<IWorkdayListItem[]>([]);

  const [addOpen, setAddOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [workdayDate, setWorkdayDate] = React.useState(todayIso());

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<IWorkdayListItem | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWorkdays();
      setRows(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load workdays.");
      setRows([]);
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
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ sm: "center" }}>
          <Box>
            <Typography variant="h5">Workdays</Typography>
            <Typography variant="body2" color="text.secondary">
              Create workdays and track attendance (drives initial earnings).
            </Typography>
          </Box>
          {canWrite ? (
            <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setAddOpen(true)}>
              New workday
            </Button>
          ) : null}
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {loading ? (
        <CircularProgress />
      ) : (
        <Stack spacing={1}>
          {rows.length === 0 ? (
            <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
              <Typography variant="body2" color="text.secondary">
                No workdays yet. Create one to start tracking attendance.
              </Typography>
            </Paper>
          ) : null}

          {rows.map((w) => {
            const d = w.workday_date ? dayjs(w.workday_date).format("MMM D, YYYY") : "—";
            const countsFor = w.bonus_month ? dayjs(`${w.bonus_month}-01`).format("MMM YYYY") : null;
            return (
              <Paper
                key={w.id ?? `${w.workday_date}-${w.title}`}
                elevation={0}
                sx={{
                  p: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  cursor: w.id ? "pointer" : "default",
                  "&:hover": { borderColor: "text.secondary" },
                }}
                onClick={() => {
                  if (!w.id) return;
                  void router.push(`/workdays/${w.id}`);
                }}
              >
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ sm: "center" }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {d}
                    </Typography>
                    {countsFor ? (
                      <Typography variant="body2" color="text.secondary">
                        Counts for {countsFor} Bonus
                      </Typography>
                    ) : null}
                  </Box>
                  {canWrite ? (
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteOutlineIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteError(null);
                        setDeleteTarget(w);
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

      <Dialog open={addOpen && canWrite} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          New workday
          <IconButton onClick={() => setAddOpen(false)} aria-label="close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField label="Date" type="date" value={workdayDate} onChange={(e) => setWorkdayDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setAddOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              setError(null);
              const res = await createWorkday({ workday_date: workdayDate, title: null });
              setSubmitting(false);
              if (!res.ok) {
                setError(res.error);
                return;
              }
              setAddOpen(false);
              await router.push(`/workdays/${res.id}`);
            }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen && canWrite} onClose={() => setDeleteOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          Delete workday
          <IconButton onClick={() => setDeleteOpen(false)} aria-label="close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {deleteError ? <Alert severity="error">{deleteError}</Alert> : null}
          <Typography sx={{ mt: deleteError ? 2 : 0 }}>
            Are you sure you want to delete the workday on{" "}
            <b>{deleteTarget?.workday_date ? dayjs(deleteTarget.workday_date).format("MMM D, YYYY") : "—"}</b>?
          </Typography>
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
              setDeleteError(null);
              setDeleting(true);
              const res = await deleteWorkday(deleteTarget.id);
              setDeleting(false);
              if (!res.ok) {
                setDeleteError(res.error);
                return;
              }
              setDeleteOpen(false);
              setDeleteTarget(null);
              await refresh();
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}


