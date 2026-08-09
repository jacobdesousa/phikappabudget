import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import dayjs from "dayjs";
import {
  HouseSessionType,
  IHouseAssignment,
  IHousePayment,
  IHouseSession,
} from "../../interfaces/api.interface";
import {
  createHousePayment,
  updateAssignment,
  updateHousePayment,
} from "../../services/houseService";
import { formatMoney, roundMoney } from "../../utils/money";

interface Props {
  year: number;
  session: HouseSessionType;
  brotherId: number;
  brotherName: string;
  // The resident's assignments for this session — needed to apply the
  // pre-payment discount when they settle up in one go.
  assignments?: IHouseAssignment[];
  sessionConfig?: IHouseSession | null;
  existing?: IHousePayment;
  onClose: () => void;
  onSaved: () => void;
}

export default function HousePaymentDialog(props: Props) {
  const assignments = props.assignments ?? [];
  const prepayPct = Number(props.sessionConfig?.prepay_discount_pct ?? 0);
  const alreadyPrepaid = assignments.length > 0 && assignments.every((a) => a.prepay_discount);
  // Editing an existing payment shouldn't re-open the discount decision.
  const canPrepay = !props.existing && prepayPct > 0 && assignments.length > 0;

  const [paidAt, setPaidAt] = useState(props.existing?.paid_at ?? dayjs().format("YYYY-MM-DD"));
  const [amount, setAmount] = useState(props.existing ? String(props.existing.amount) : "");
  const [memo, setMemo] = useState(props.existing?.memo ?? "");
  const [payInFull, setPayInFull] = useState(alreadyPrepaid);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What the session costs once the discount lands, so the amount to collect is
  // visible before it's typed.
  const discountedTotal = roundMoney(
    assignments.reduce((sum, a) => {
      const undiscounted = a.prepay_discount
        ? a.total_owed / (1 - prepayPct / 100)
        : a.total_owed;
      return sum + undiscounted * (1 - prepayPct / 100);
    }, 0)
  );

  async function handleSubmit() {
    if (!amount) {
      setError("Enter an amount.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const payload: any = {
      brother_id: props.brotherId,
      school_year: props.year,
      session_type: props.session,
      paid_at: paidAt,
      amount: Number(amount),
      memo: memo || null,
    };
    try {
      if (props.existing) {
        await updateHousePayment(props.existing.id, payload);
      } else {
        await createHousePayment(payload);
      }
      // The discount lives on the assignment, so paying in full updates every
      // assignment the resident holds this session.
      if (canPrepay && payInFull !== alreadyPrepaid) {
        await Promise.all(
          assignments.map((a) => updateAssignment(a.id, { prepay_discount: payInFull } as any))
        );
      }
      props.onSaved();
    } catch (e: any) {
      setError(e?.message ?? "Could not save the payment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onClose={props.onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {props.existing ? "Edit payment" : "Record payment"} — {props.brotherName}
        <IconButton onClick={props.onClose} aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Date"
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputProps={{ step: "0.01" }}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            fullWidth
          />
          <TextField label="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} fullWidth />

          {canPrepay && (
            <>
              <Divider />
              <FormControlLabel
                control={
                  <Checkbox checked={payInFull} onChange={(e) => setPayInFull(e.target.checked)} />
                }
                label={`Paid in full — apply the ${prepayPct}% pre-payment discount`}
              />
              <Typography variant="caption" color="text.secondary">
                {payInFull
                  ? `Session total becomes $${formatMoney(discountedTotal)}.`
                  : `Discount not applied.`}
                {props.sessionConfig?.prepay_deadline
                  ? ` Due in full by ${props.sessionConfig.prepay_deadline}.`
                  : ""}
              </Typography>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={props.onClose}>Cancel</Button>
        <Button variant="contained" disabled={submitting} onClick={handleSubmit}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
