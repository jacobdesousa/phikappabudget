import * as React from "react";
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
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { ConfigEmpty, ConfigPageLayout, ConfigSection } from "../components/config/configLayout";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import CloseIcon from "@mui/icons-material/Close";
import type { IChapterBonusRule } from "../interfaces/api.interface";
import { deleteBonusRule, getBonusRules, upsertBonusRule } from "../services/chapterBonusService";
import { normalizeMoneyInput } from "../utils/money";

type TierDraft = { tier_number: number; amount: string };

export default function ChapterBonusConfigPage() {

  const [loading, setLoading] = React.useState(true);
  const [rules, setRules] = React.useState<IChapterBonusRule[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<IChapterBonusRule | null>(null);
  const [violationType, setViolationType] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [tiers, setTiers] = React.useState<TierDraft[]>([{ tier_number: 1, amount: "25.00" }]);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<IChapterBonusRule | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBonusRules();
      setRules(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load rules.");
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  function openNew() {
    setEditing(null);
    setViolationType("");
    setDescription("");
    setTiers([{ tier_number: 1, amount: "25.00" }]);
    setOpen(true);
  }

  function openEdit(rule: IChapterBonusRule) {
    setEditing(rule);
    setViolationType(rule.violation_type);
    setDescription(rule.description ?? "");
    setTiers(
      (rule.tiers ?? [])
        .slice()
        .sort((a, b) => a.tier_number - b.tier_number)
        .map((t) => ({ tier_number: t.tier_number, amount: String(t.amount) }))
    );
    setOpen(true);
  }

  return (
    <ConfigPageLayout
      title="Chapter Bonus Config"
      description="Violation penalties, including stacking tiers — 1st, 2nd, 3rd in the same month."
      error={error}
      actions={
        <Button size="small" variant="contained" startIcon={<AddOutlinedIcon />} onClick={openNew}>
          Add rule
        </Button>
      }
    >
      {loading ? (
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress />
        </Stack>
      ) : (
        <ConfigSection title="Rules">
          {rules.length === 0 ? (
            <ConfigEmpty>No rules yet. Add one to enable auto-calculated deductions.</ConfigEmpty>
          ) : (
            <Stack spacing={1}>
              {rules.map((r) => (
                <Paper key={r.id ?? r.violation_type} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 800 }}>{r.violation_type}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {r.description?.trim() ? r.description : "—"}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        Tiers:{" "}
                        {(r.tiers ?? [])
                          .slice()
                          .sort((a, b) => a.tier_number - b.tier_number)
                          .map((t) => `${t.tier_number}: $${normalizeMoneyInput(String(t.amount))}`)
                          .join(" • ")}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                      <Button size="small" variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => openEdit(r)}>
                        Edit
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteOutlineIcon />}
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(r);
                          setDeleteOpen(true);
                        }}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </ConfigSection>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {editing ? "Edit rule" : "Add rule"}
          <IconButton onClick={() => setOpen(false)} aria-label="close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              size="small"
              label="Violation type"
              value={violationType}
              onChange={(e) => setViolationType(e.target.value)}
              placeholder="e.g., Smoking"
              fullWidth
              required
              disabled={Boolean(editing)} // key is violation_type (unique)
            />
            <TextField size="small" label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth />

            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Penalty tiers (stacking within the month)
            </Typography>
            <Stack spacing={1}>
              {tiers
                .slice()
                .sort((a, b) => a.tier_number - b.tier_number)
                .map((t, idx) => (
                  <Stack key={t.tier_number} direction="row" spacing={1} alignItems="center">
                    <TextField size="small" label="Tier" type="number" value={t.tier_number} disabled sx={{ width: 110 }} />
                    <TextField
                      size="small"
                      label="Amount"
                      type="number"
                      value={t.amount}
                      onChange={(e) =>
                        setTiers((prev) => prev.map((x) => (x.tier_number === t.tier_number ? { ...x, amount: e.target.value } : x)))
                      }
                      onBlur={() =>
                        setTiers((prev) =>
                          prev.map((x) => (x.tier_number === t.tier_number ? { ...x, amount: normalizeMoneyInput(x.amount) } : x))
                        )
                      }
                      inputProps={{ step: "0.01" }}
                      fullWidth
                    />
                    <IconButton
                      size="small"
                      aria-label="remove tier"
                      color="error"
                      disabled={tiers.length <= 1}
                      onClick={() => setTiers((prev) => prev.filter((x) => x.tier_number !== t.tier_number))}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
            </Stack>

            <Button
              size="small"
              variant="outlined"
              startIcon={<AddOutlinedIcon />}
              sx={{ alignSelf: "flex-start" }}
              onClick={() => {
                const nextTier = Math.max(...tiers.map((t) => t.tier_number)) + 1;
                setTiers((prev) => [...prev, { tier_number: nextTier, amount: "0.00" }]);
              }}
            >
              Add tier
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button size="small" variant="outlined" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<SaveOutlinedIcon />}
            onClick={async () => {
              setError(null);
              const res = await upsertBonusRule({
                violation_type: violationType.trim(),
                description: description.trim() ? description.trim() : null,
                tiers: tiers.map((t) => ({ tier_number: t.tier_number, amount: Number(normalizeMoneyInput(t.amount)) })),
              });
              if (!res.ok) {
                setError(res.error);
                return;
              }
              setOpen(false);
              await refresh();
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          Delete rule
          <IconButton onClick={() => setDeleteOpen(false)} aria-label="close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {deleteError ? <Alert severity="error">{deleteError}</Alert> : null}
          <Typography sx={{ mt: deleteError ? 2 : 0 }}>
            Are you sure you want to delete <b>{deleteTarget?.violation_type}</b>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will remove its stacking tiers. Existing deductions won’t change.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button size="small" variant="outlined" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            disabled={!deleteTarget?.id}
            onClick={async () => {
              if (!deleteTarget?.id) return;
              setDeleteError(null);
              const res = await deleteBonusRule(deleteTarget.id);
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
    </ConfigPageLayout>
  );
}


