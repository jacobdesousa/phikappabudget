import Button from "@mui/material/Button";
import {
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useState } from "react";
import { IDuesPayment } from "../../interfaces/api.interface";
import { deletePayment } from "../../services/duesPaymentsService";

interface Props {
  brotherId: number;
  brotherName: string;
  payment: IDuesPayment;
  onClose: () => void;
  onDeleted?: () => void;
}

export default function ConfirmDeletePaymentDialog(props: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function handleDelete() {
    if (!props.payment.id) return;
    setSubmitting(true);
    setError(undefined);

    const res = await deletePayment(props.payment.id);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error?.message ?? "Could not delete payment.");
      return;
    }

    props.onDeleted?.();
    props.onClose();
  }

  return (
    <Dialog open onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        Delete Payment
        <IconButton onClick={props.onClose} aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error">{error}</Alert>}
        <Typography sx={{ mt: error ? 2 : 0 }}>
          Are you sure you want to delete this payment for <b>{props.brotherName}</b>?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {`Date: ${new Date(props.payment.paid_at).toDateString()} • Amount: $${props.payment.amount}`}
          {props.payment.memo ? ` • Memo: ${props.payment.memo}` : ""}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={props.onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleDelete}
          disabled={submitting || !props.payment.id}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}


