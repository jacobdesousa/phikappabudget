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
import { IRevenue } from "../../interfaces/api.interface";
import { deleteRevenue } from "../../services/revenueService";
import { formatMoney } from "../../utils/money";

interface Props {
  revenue: IRevenue;
  onClose: () => void;
  onDeleted?: () => void;
}

export default function ConfirmDeleteRevenueDialog(props: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function onDelete() {
    if (!props.revenue.id) return;
    setSubmitting(true);
    setError(undefined);
    const res = await deleteRevenue(props.revenue.id);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error?.message ?? "Could not delete revenue entry.");
      return;
    }
    props.onDeleted?.();
    props.onClose();
  }

  return (
    <Dialog open onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        Delete revenue entry
        <IconButton onClick={props.onClose} aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error">{error}</Alert>}
        <Typography sx={{ mt: error ? 2 : 0 }}>
          Are you sure you want to delete <b>{props.revenue.description}</b>?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {`Date: ${new Date(props.revenue.date).toDateString()} • Total: $${formatMoney(props.revenue.amount ?? 0)}`}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={props.onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="contained" color="error" onClick={onDelete} disabled={submitting || !props.revenue.id}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}


