import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import dayjs from "dayjs";
import { IHouseAccountAdjustment } from "../../interfaces/api.interface";
import {
  createAccountAdjustment,
  updateAccountAdjustment,
} from "../../services/houseAccountService";

interface Props {
  year: number;
  existing?: IHouseAccountAdjustment;
  onClose: () => void;
  onSaved: () => void;
}

export default function AccountAdjustmentDialog(props: Props) {
  const existing = props.existing;

  const [occurredOn, setOccurredOn] = useState(
    existing?.occurred_on ?? dayjs().format("YYYY-MM-DD")
  );
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (amount === "") {
      setError("Enter an amount.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const payload: any = {
      occurred_on: occurredOn,
      amount: Number(amount),
      description: description || null,
      school_year: props.year,
    };
    try {
      if (existing) await updateAccountAdjustment(existing.id, payload);
      else await createAccountAdjustment(payload);
      props.onSaved();
    } catch (e: any) {
      setError(e?.message ?? "Could not save the adjustment.");
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onClose={props.onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pr: 6 }}>
        {existing ? "Edit adjustment" : "New adjustment"}
        <IconButton onClick={props.onClose} sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField
            label="Date"
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            helperText="Negative for money leaving the account, e.g. bank fees."
            fullWidth
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {existing ? "Save" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
