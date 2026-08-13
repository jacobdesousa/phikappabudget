import { useEffect, useState } from "react";
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
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { IBondState } from "../../interfaces/api.interface";
import { formatMoney } from "../../utils/money";
import { getBondState, updateBond } from "../../services/donationsService";

interface Props {
  brotherId: number;
  brotherName: string;
  onClose: () => void;
  onSaved: () => void;
}

// Bonds are normally opened by the first donation at whatever the config price
// is. This exists for the exceptions: a bond bought years ago at an older
// price, or one that needs opening before any money arrives.
export default function BondDialog(props: Props) {
  const [state, setState] = useState<IBondState | null>(null);
  const [bondPrice, setBondPrice] = useState("");
  const [openedOn, setOpenedOn] = useState("");
  const [bondNumber, setBondNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBondState(props.brotherId)
      .then((s) => {
        if (cancelled) return;
        setState(s);
        setBondPrice(String(s.bond_price));
        setOpenedOn(s.opened_on ?? "");
        setBondNumber(s.bond_number ?? "");
        setNotes(s.notes ?? "");
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message ?? "Could not load the bond.");
      });
    return () => {
      cancelled = true;
    };
  }, [props.brotherId]);

  async function handleSubmit() {
    const price = Number(bondPrice);
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a bond price.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await updateBond(props.brotherId, {
        bond_price: price,
        opened_on: openedOn || null,
        bond_number: bondNumber.trim() || null,
        notes: notes || null,
      });
      props.onSaved();
    } catch (e: any) {
      setError(e?.message ?? "Could not save the bond.");
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onClose={props.onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pr: 6 }}>
        Bond — {props.brotherName}
        <IconButton onClick={props.onClose} sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {state ? (
            <Typography variant="body2" color="text.secondary">
              ${formatMoney(state.bond_paid)} paid · ${formatMoney(state.bond_outstanding)} owing
              {state.has_bond ? "" : " · no bond opened yet"}
            </Typography>
          ) : null}
          <TextField
            label="Bond price"
            type="number"
            value={bondPrice}
            onChange={(e) => setBondPrice(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            helperText="Snapshot for this brother. Changing the config price does not touch it."
            fullWidth
          />
          <TextField
            label="Opened on"
            type="date"
            value={openedOn}
            onChange={(e) => setOpenedOn(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Bond number"
            value={bondNumber}
            onChange={(e) => setBondNumber(e.target.value)}
            helperText={
              state && state.bond_outstanding > 0
                ? "Issued when the bond is paid off — leave blank until then."
                : "The certificate number for this bond."
            }
            fullWidth
          />
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting || !state}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
