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
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { addPayment } from "../../services/duesPaymentsService";
import { schoolYearLabel, schoolYearStartForDate } from "../../utils/schoolYear";
import CloseIcon from "@mui/icons-material/Close";
import { normalizeMoneyInput } from "../../utils/money";

interface Props {
  brotherId: number;
  brotherName: string;
  duesYear?: number;
  onClose: () => void;
  onCreated?: () => void;
}

export default function AddPaymentModal(props: Props) {
  const [paidAt, setPaidAt] = useState(dayjs(new Date()));
  const [amount, setAmount] = useState<string>("");
  const [memo, setMemo] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const amountNumber = useMemo(() => Number(amount), [amount]);
  const effectiveYearStart = props.duesYear ?? schoolYearStartForDate(new Date());

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(undefined);

    const result = await addPayment({
      brother_id: props.brotherId,
      paid_at: paidAt.toDate(),
      amount: amountNumber,
      memo: memo || null,
      dues_year: effectiveYearStart,
    });

    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error?.message ?? "Could not add payment.");
      return;
    }

    props.onCreated?.();
    props.onClose();
  }

  const disableSubmit = submitting || !paidAt || Number.isNaN(amountNumber) || amountNumber === 0;

  return (
    <Dialog open onClose={props.onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        Add Payment
        <IconButton onClick={props.onClose} aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {submitError && <Alert severity="error">{submitError}</Alert>}

          <TextField label="Brother" value={props.brotherName} disabled fullWidth />
          <TextField label="School year" value={schoolYearLabel(effectiveYearStart)} disabled fullWidth />

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
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  );
}


