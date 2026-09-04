import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import type { ICategoryYearRow, ICategoryYearState } from "../../interfaces/api.interface";
import SchoolYearSelector from "../SchoolYearSelector";
import { schoolYearLabel, schoolYearStartForDate } from "../../utils/schoolYear";
import { formatMoney } from "../../utils/money";

type Result = { ok: boolean; error?: { message?: string } };

interface Props {
  title: string;
  description: string;
  // The ledger's own name, for the copy that has to say which entries move.
  entryNoun: string;
  fetchYear: (year: number) => Promise<ICategoryYearState>;
  addToYear: (id: number, year: number) => Promise<Result>;
  removeFromYear: (id: number, year: number) => Promise<Result>;
  importYear: (fromYear: number, toYear: number) => Promise<Result>;
  createCategory: (name: string, year: number) => Promise<Result>;
  renameCategory: (id: number, name: string) => Promise<Result>;
  deleteCategory: (id: number) => Promise<Result>;
}

const MISC = "Misc";

// Per-year category configuration, shared by the revenue and expenses config
// pages — the two ledgers already carry two copies of the same category CRUD
// and this would have been the third and fourth.
//
// A category exists globally and forever; this page controls which years offer
// it. Removing one from a year is a real edit, not a filter: that year's
// entries move to Misc, which is why each row shows what it is carrying before
// anything is clicked.
export default function CategoryYearConfig(props: Props) {
  const [schoolYear, setSchoolYear] = useState(schoolYearStartForDate(new Date()));
  const [state, setState] = useState<ICategoryYearState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ICategoryYearRow | null>(null);
  const [removing, setRemoving] = useState<ICategoryYearRow | null>(null);
  const [deleting, setDeleting] = useState<ICategoryYearRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFrom, setImportFrom] = useState<number | "">("");
  const [name, setName] = useState("");

  const load = useCallback(
    async (year: number) => {
      setLoading(true);
      try {
        setState(await props.fetchYear(year));
        setError(undefined);
      } catch {
        setState(null);
        setError("Could not load categories.");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    load(schoolYear);
  }, [load, schoolYear]);

  async function run(action: () => Promise<Result>, fallback: string) {
    setError(undefined);
    const res = await action();
    if (!res.ok) {
      setError(res.error?.message ?? fallback);
      return false;
    }
    await load(schoolYear);
    return true;
  }

  const rows = state?.categories ?? [];
  const offered = rows.filter((c) => c.in_year || c.name === MISC);
  // Import sources: any other year that already has a list.
  const importYears = (state?.years ?? []).filter((y) => y !== schoolYear);

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between">
          <Stack spacing={0.5}>
            <Typography variant="h5">{props.title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {props.description}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <SchoolYearSelector value={schoolYear} onChange={setSchoolYear} />
            <Button
              variant="outlined"
              startIcon={<DownloadOutlinedIcon />}
              disabled={importYears.length === 0}
              onClick={() => {
                setImportFrom(importYears[0] ?? "");
                setImportOpen(true);
              }}
            >
              Import
            </Button>
            <Button
              variant="contained"
              startIcon={<AddOutlinedIcon />}
              onClick={() => {
                setName("");
                setError(undefined);
                setAddOpen(true);
              }}
            >
              Add category
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <CircularProgress />
      ) : (
        <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="h6">Categories for {schoolYearLabel(schoolYear)}</Typography>
            <Typography variant="caption" color="text.secondary">
              {offered.length} of {rows.length} offered
            </Typography>
          </Stack>

          {rows.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No categories yet.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {rows.map((c) => {
                const isMisc = c.name === MISC;
                const inYear = c.in_year || isMisc;
                return (
                  <Paper key={c.id} variant="outlined" sx={{ p: 1.25, opacity: inYear ? 1 : 0.6 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Tooltip
                        title={
                          isMisc
                            ? "Misc is the fallback category and is offered every year"
                            : inYear
                              ? "Offered this year"
                              : "Not offered this year"
                        }
                      >
                        <span>
                          <Checkbox
                            size="small"
                            sx={{ p: 0.5 }}
                            checked={inYear}
                            disabled={isMisc}
                            onChange={() => {
                              if (c.in_year) setRemoving(c);
                              else run(() => props.addToYear(c.id, schoolYear), "Could not add category to this year.");
                            }}
                          />
                        </span>
                      </Tooltip>
                      <Typography sx={{ fontWeight: 600 }}>{c.name}</Typography>

                      {/* What this category is carrying in the selected year —
                          the numbers that move if it is removed. */}
                      {c.entry_count > 0 && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`${c.entry_count} ${props.entryNoun}${c.entry_count === 1 ? "" : "s"} · $${formatMoney(Number(c.entry_total))}`}
                        />
                      )}
                      {Number(c.budgeted_amount) !== 0 && (
                        <Chip
                          size="small"
                          variant="outlined"
                          color="primary"
                          label={`$${formatMoney(Number(c.budgeted_amount))} budgeted`}
                        />
                      )}

                      <span style={{ flex: 1 }} />
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Rename">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setError(undefined);
                                setEditing(c);
                                setName(c.name);
                              }}
                            >
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={isMisc ? "The fallback category can't be deleted" : "Delete from every year"}>
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              disabled={isMisc}
                              onClick={() => {
                                setError(undefined);
                                setDeleting(c);
                              }}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Paper>
      )}

      {/* Add */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add category</DialogTitle>
        <DialogContent dividers>
          <DialogContentText sx={{ mb: 2, fontSize: "0.875rem" }}>
            Added to {schoolYearLabel(schoolYear)}. Other years are unaffected.
          </DialogContentText>
          <TextField label="Category name" value={name} onChange={(e) => setName(e.target.value)} fullWidth required />
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!name.trim()}
            onClick={async () => {
              if (await run(() => props.createCategory(name.trim(), schoolYear), "Could not add category.")) {
                setAddOpen(false);
                setName("");
              }
            }}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename */}
      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle>Rename category</DialogTitle>
        <DialogContent dividers>
          <DialogContentText sx={{ mb: 2, fontSize: "0.875rem" }}>
            The name changes everywhere, in every year.
          </DialogContentText>
          <TextField label="Category name" value={name} onChange={(e) => setName(e.target.value)} fullWidth required />
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setEditing(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!name.trim()}
            onClick={async () => {
              if (!editing) return;
              if (await run(() => props.renameCategory(editing.id, name.trim()), "Could not rename category.")) {
                setEditing(null);
                setName("");
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remove from this year */}
      <Dialog open={Boolean(removing)} onClose={() => setRemoving(null)} fullWidth maxWidth="sm">
        <DialogTitle>Remove from {schoolYearLabel(schoolYear)}?</DialogTitle>
        <DialogContent dividers>
          <DialogContentText sx={{ fontSize: "0.875rem" }}>
            {removing?.name} stays available in other years.
          </DialogContentText>
          {removing && removing.entry_count > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {removing.entry_count} {props.entryNoun}
              {removing.entry_count === 1 ? "" : "s"} totalling $
              {formatMoney(Number(removing.entry_total))} move to {MISC} for this year. Adding the
              category back does not bring them out again.
            </Alert>
          )}
          {removing && Number(removing.budgeted_amount) !== 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              The ${formatMoney(Number(removing.budgeted_amount))} budgeted here is dropped, so the
              budgeted total for the year falls by that much until it is re-budgeted.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setRemoving(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={async () => {
              if (!removing) return;
              if (await run(() => props.removeFromYear(removing.id, schoolYear), "Could not remove category.")) {
                setRemoving(null);
              }
            }}
          >
            Remove from this year
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete everywhere */}
      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} fullWidth maxWidth="sm">
        <DialogTitle>Delete {deleting?.name}?</DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning">
            Deletes the category from every year. Every {props.entryNoun} still pointing at it, in any
            year, moves to {MISC}. To retire it from {schoolYearLabel(schoolYear)} alone, untick it
            instead.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDeleting(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={async () => {
              if (!deleting) return;
              if (await run(() => props.deleteCategory(deleting.id), "Could not delete category.")) {
                setDeleting(null);
              }
            }}
          >
            Delete everywhere
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import a year's list */}
      <Dialog open={importOpen} onClose={() => setImportOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Import categories</DialogTitle>
        <DialogContent dividers>
          <DialogContentText sx={{ mb: 2, fontSize: "0.875rem" }}>
            Copies the category list from another year into {schoolYearLabel(schoolYear)}. Categories
            already offered here are left alone, and nothing is removed.
          </DialogContentText>
          <TextField
            select
            label="Copy from"
            value={importFrom}
            onChange={(e) => setImportFrom(Number(e.target.value))}
            fullWidth
          >
            {importYears.map((y) => (
              <MenuItem key={y} value={y}>
                {schoolYearLabel(y)}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setImportOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={importFrom === ""}
            onClick={async () => {
              if (importFrom === "") return;
              if (await run(() => props.importYear(Number(importFrom), schoolYear), "Could not import categories.")) {
                setImportOpen(false);
              }
            }}
          >
            Import
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
