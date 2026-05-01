import Button from "@mui/material/Button";
import {
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { IDuesPayment } from "../../interfaces/api.interface";
import { updatePayment } from "../../services/duesPaymentsService";
import { normalizeMoneyInput } from "../../utils/money";

interface Props {
  payment: IDuesPayment;
  onClose: () => void;
  onUpdated?: () => void;
}

export default function EditPaymentDialog(props: Props) {
  const [paidAt, setPaidAt] = useState(dayjs(props.payment.paid_at));
  const [amount, setAmount] = useState<string>(String(props.payment.amount ?? ""));
  const [memo, setMemo] = useState<string>(String(props.payment.memo ?? ""));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const amountNumber = useMemo(() => Number(amount), [amount]);
  const disableSubmit =
    submitting || !props.payment.id || Number.isNaN(amountNumber) || amountNumber === 0;

  async function handleSubmit() {
    if (!props.payment.id) return;
    setSubmitting(true);
    setSubmitError(undefined);

    const result = await updatePayment(props.payment.id, {
      paid_at: paidAt.toDate(),
      amount: amountNumber,
      memo: memo || null,
    });

    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error?.message ?? "Could not update payment.");
      return;
    }

    props.onUpdated?.();
    props.onClose();
  }

  return (
    <Dialog open onClose={props.onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        Edit Payment
        <IconButton onClick={props.onClose} aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {submitError && <Alert severity="error">{submitError}</Alert>}

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              value={paidAt}
              onChange={(newDate) => setPaidAt(newDate ? newDate : dayjs(new Date()))}
              format="MM/DD/YYYY"
              label="Payment date"
              slotProps={{ textField: { fullWidth: true } }}
            />
          </LocalizationProvider>

          <TextField
            required
            fullWidth
            label="Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => setAmount(normalizeMoneyInput(amount))}
            inputProps={{ step: "0.01" }}
          />

          <TextField
            fullWidth
            label="Memo (optional)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={props.onClose}>
          Cancel
        </Button>
        <Button variant="contained" disabled={disableSubmit} onClick={handleSubmit}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}


