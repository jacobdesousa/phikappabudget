import { useEffect, useState } from "react";
import {
  Alert,
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
  Tooltip,
  Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  addRevenueCategory,
  deleteRevenueCategory,
  getRevenueCategories,
  updateRevenueCategory,
} from "../services/revenueCategoryService";
import { IRevenueCategory } from "../interfaces/api.interface";

export default function RevenueConfigPage() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<IRevenueCategory[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<IRevenueCategory | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<IRevenueCategory | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  async function load() {
    setLoading(true);
    setError(undefined);
    try {
      const rows = await getRevenueCategories();
      setCategories(rows);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd() {
    setError(undefined);
    if (!name.trim()) {
      setError("Category name is required.");
      return;
    }
    const status = await addRevenueCategory({ name: name.trim() });
    if (status >= 400) {
      setError("Could not add category.");
      return;
    }
    setAddOpen(false);
    setName("");
    await load();
  }

  async function handleEditSave() {
    if (!editing?.id) return;
    setError(undefined);
    if (!name.trim()) {
      setError("Category name is required.");
      return;
    }
    const res = await updateRevenueCategory(editing.id, { name: name.trim() });
    if (!res.ok) {
      setError(res.error?.message ?? "Could not update category.");
      return;
    }
    setEditOpen(false);
    setEditing(null);
    setName("");
    await load();
  }

  async function handleDeleteConfirm() {
    if (!deleting?.id) return;
    setError(undefined);
    const res = await deleteRevenueCategory(deleting.id);
    if (!res.ok) {
      setError(res.error?.message ?? "Could not delete category.");
      return;
    }
    setDeleteOpen(false);
    setDeleting(null);
    await load();
  }

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between">
          <Stack spacing={0.5}>
            <Typography variant="h5">Revenue Config</Typography>
            <Typography variant="body2" color="text.secondary">
              Manage revenue categories (used when creating revenue entries).
            </Typography>
          </Stack>
          <Button variant="contained" startIcon={<AddOutlinedIcon />} sx={{ minWidth: 160 }} onClick={() => setAddOpen(true)}>
            Add category
          </Button>
        </Stack>
      </Paper>

      {loading ? (
        <CircularProgress />
      ) : (
        <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Typography variant="h6" sx={{ mb: 1 }}>
            Categories
          </Typography>
          {categories.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No categories yet.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {categories.map((c) => (
                <Paper key={c.id ?? c.name} variant="outlined" sx={{ p: 1.25 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ fontWeight: 600 }}>{c.name}</Typography>
                    <span style={{ flex: 1 }} />
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Edit">
                        <span>
                          <IconButton
                            size="small"
                            disabled={!c.id}
                            onClick={() => {
                              setError(undefined);
                              setEditing(c);
                              setName(c.name);
                              setEditOpen(true);
                            }}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={!c.id}
                            onClick={() => {
                              setError(undefined);
                              setDeleting(c);
                              setDeleteOpen(true);
                            }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add revenue category</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            label="Category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
          />
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" sx={{ minWidth: 120 }} onClick={() => setAddOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" startIcon={<AddOutlinedIcon />} sx={{ minWidth: 120 }} onClick={handleAdd}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit revenue category</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            label="Category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
          />
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            sx={{ minWidth: 120 }}
            onClick={() => {
              setEditOpen(false);
              setEditing(null);
              setName("");
            }}
          >
            Cancel
          </Button>
          <Button variant="contained" startIcon={<SaveOutlinedIcon />} sx={{ minWidth: 120 }} onClick={handleEditSave} disabled={!editing?.id}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Delete revenue category</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Typography>
            Are you sure you want to delete <b>{deleting?.name}</b>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            You can’t delete categories that are already used by revenue entries.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            sx={{ minWidth: 120 }}
            onClick={() => {
              setDeleteOpen(false);
              setDeleting(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            sx={{ minWidth: 120 }}
            onClick={handleDeleteConfirm}
            disabled={!deleting?.id}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}


