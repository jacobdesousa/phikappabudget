import { useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import { IExpense } from "../../interfaces/api.interface";
import { deleteExpense } from "../../services/expensesService";
import { formatMoney } from "../../utils/money";

interface Props {
  expense: IExpense;
  onClose: () => void;
  onDeleted?: () => void;
}

export default function ConfirmDeleteExpenseDialog(props: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function onDelete() {
    if (!props.expense.id) return;
    setSubmitting(true);
    setError(undefined);
    const res = await deleteExpense(props.expense.id);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error?.message ?? "Could not delete expense.");
      return;
    }
    props.onDeleted?.();
    props.onClose();
  }

  return (
    <Dialog open onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        Delete expense
        <IconButton onClick={props.onClose} aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error">{error}</Alert>}
        <Typography sx={{ mt: error ? 2 : 0 }}>
          Are you sure you want to delete <b>{props.expense.description}</b>?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {`Date: ${new Date(props.expense.date).toDateString()} • Amount: $${formatMoney(props.expense.amount ?? 0)}`}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={props.onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="contained" color="error" onClick={onDelete} disabled={submitting || !props.expense.id}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}


