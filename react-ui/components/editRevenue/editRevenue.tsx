import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { IRevenue, IRevenueCategory } from "../../interfaces/api.interface";
import { updateRevenue } from "../../services/revenueService";
import { formatMoney, normalizeMoneyInput } from "../../utils/money";

interface Props {
  revenue: IRevenue;
  categories: IRevenueCategory[];
  onClose: () => void;
  onUpdated?: () => void;
}

export default function EditRevenueDialog(props: Props) {
  const [description, setDescription] = useState(props.revenue.description ?? "");
  const [date, setDate] = useState<string>(() => new Date(props.revenue.date).toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState<number | "">(props.revenue.category_id ?? "");

  const [cash, setCash] = useState<string>(String(props.revenue.cash_amount ?? 0));
  const [square, setSquare] = useState<string>(String(props.revenue.square_amount ?? 0));
  const [etransfer, setEtransfer] = useState<string>(String(props.revenue.etransfer_amount ?? 0));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const total = useMemo(() => {
    const c = Number(cash || 0);
    const s = Number(square || 0);
    const e = Number(etransfer || 0);
    return (Number.isFinite(c) ? c : 0) + (Number.isFinite(s) ? s : 0) + (Number.isFinite(e) ? e : 0);
  }, [cash, square, etransfer]);

  async function onSave() {
    if (!props.revenue.id) return;
    setError(undefined);

    const c = Number(cash);
    const s = Number(square);
    const e = Number(etransfer);
    if (!description || !date || !categoryId || Number.isNaN(c) || Number.isNaN(s) || Number.isNaN(e)) {
      setError("Please fill out description, category, date, and valid amounts.");
      return;
    }

    setSubmitting(true);
    const res = await updateRevenue(props.revenue.id, {
      description,
      date,
      category_id: Number(categoryId),
      cash_amount: c,
      square_amount: s,
      etransfer_amount: e,
      amount: total,
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error?.message ?? "Could not update revenue entry.");
      return;
    }

    props.onUpdated?.();
    props.onClose();
  }

  return (
    <Dialog open onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit revenue</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2}>
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            required
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControl fullWidth required>
              <InputLabel id="rev-edit-cat-label">Category</InputLabel>
              <Select
                labelId="rev-edit-cat-label"
                label="Category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value as any)}
              >
                {props.categories.map((c) => (
                  <MenuItem key={c.id ?? c.name} value={c.id ?? ""}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />
          </Stack>

          <Typography variant="subtitle2" color="text.secondary">
            Payment streams
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Cash"
              type="number"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              onBlur={() => setCash(normalizeMoneyInput(cash))}
              fullWidth
              inputProps={{ step: "0.01" }}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            />
            <TextField
              label="Square"
              type="number"
              value={square}
              onChange={(e) => setSquare(e.target.value)}
              onBlur={() => setSquare(normalizeMoneyInput(square))}
              fullWidth
              inputProps={{ step: "0.01" }}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            />
            <TextField
              label="E-transfer"
              type="number"
              value={etransfer}
              onChange={(e) => setEtransfer(e.target.value)}
              onBlur={() => setEtransfer(normalizeMoneyInput(etransfer))}
              fullWidth
              inputProps={{ step: "0.01" }}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            />
          </Stack>

          <TextField
            label="Total"
            value={formatMoney(total)}
            fullWidth
            disabled
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={props.onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="contained" onClick={onSave} disabled={submitting || !props.revenue.id}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}


