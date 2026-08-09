import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import dayjs from "dayjs";
import {
  HouseSessionType,
  IHouseDisbursement,
  IHousePayee,
  IHouseSecuritySnapshot,
} from "../../interfaces/api.interface";
import { createDisbursement, updateDisbursement } from "../../services/houseAccountService";
import { formatMoney, roundMoney } from "../../utils/money";
import { sessionLabel } from "../../utils/house";

interface Props {
  year: number;
  session: HouseSessionType;
  payees: IHousePayee[];
  // Live deposit figures, used to prefill the two security lines.
  security: IHouseSecuritySnapshot;
  nextSeq: number;
  existing?: IHouseDisbursement;
  onClose: () => void;
  onSaved: () => void;
}

const ORDINALS = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth"];

// The sheet labels disbursements "First (September)". The month drifts year to
// year, so this is only a starting point — the field stays editable.
function suggestLabel(seq: number, date: string): string {
  const ordinal = ORDINALS[seq - 1] ?? `${seq}th`;
  const month = dayjs(date).isValid() ? dayjs(date).format("MMMM") : "";
  return month ? `${ordinal} (${month})` : ordinal;
}

export default function DisbursementDialog(props: Props) {
  const existing = props.existing;

  const [date, setDate] = useState(existing?.disbursed_on ?? dayjs().format("YYYY-MM-DD"));
  const [status, setStatus] = useState(existing?.status ?? "estimated");
  const [seq, setSeq] = useState(String(existing?.seq ?? props.nextSeq));
  const [label, setLabel] = useState(
    existing?.label ?? suggestLabel(props.nextSeq, dayjs().format("YYYY-MM-DD"))
  );
  const [bankBalance, setBankBalance] = useState(
    existing ? String(existing.bank_balance) : ""
  );
  const [toRefund, setToRefund] = useState(
    String(existing ? existing.security_to_refund : props.security.to_refund)
  );
  const [onAccount, setOnAccount] = useState(
    String(existing ? existing.security_on_account : props.security.on_account)
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Percentages are frozen onto the shares at creation, so an edit must preview
  // the split using the disbursement's own pct, not the current config.
  const splitBasis = existing?.shares.length
    ? existing.shares.map((s) => ({ payee: s.payee, pct: Number(s.pct) }))
    : props.payees.map((p) => ({ payee: p.payee, pct: Number(p.pct) }));

  const subTotal = roundMoney(
    (Number(bankBalance) || 0) - (Number(toRefund) || 0) - (Number(onAccount) || 0)
  );
  const preview = splitBasis.map((p) => ({
    ...p,
    amount: roundMoney((subTotal * p.pct) / 100),
  }));

  const securityMatchesLive =
    roundMoney(Number(toRefund) || 0) === roundMoney(props.security.to_refund) &&
    roundMoney(Number(onAccount) || 0) === roundMoney(props.security.on_account);

  async function handleSubmit() {
    if (bankBalance === "") {
      setError("Enter the bank balance.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const payload: any = {
      school_year: props.year,
      session_type: props.session,
      seq: seq === "" ? null : Number(seq),
      label: label || null,
      disbursed_on: date || null,
      status,
      bank_balance: Number(bankBalance),
      security_to_refund: Number(toRefund) || 0,
      security_on_account: Number(onAccount) || 0,
      notes: notes || null,
    };
    try {
      if (existing) await updateDisbursement(existing.id, payload);
      else await createDisbursement(payload);
      props.onSaved();
    } catch (e: any) {
      setError(e?.message ?? "Could not save the disbursement.");
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pr: 6 }}>
        {existing ? "Edit disbursement" : "New disbursement"}
        <Typography variant="body2" color="text.secondary">
          {sessionLabel(props.year, props.session)}
        </Typography>
        <IconButton onClick={props.onClose} sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Sequence"
              type="number"
              value={seq}
              onChange={(e) => setSeq(e.target.value)}
              sx={{ width: { sm: 120 } }}
            />
            <TextField
              label="Label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              fullWidth
              helperText="e.g. First (September)"
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                // Only re-suggest while the label is still untouched boilerplate.
                if (!existing && label === suggestLabel(Number(seq) || props.nextSeq, date)) {
                  setLabel(suggestLabel(Number(seq) || props.nextSeq, e.target.value));
                }
              }}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as "estimated" | "disbursed")}
              fullWidth
            >
              <MenuItem value="estimated">Estimated</MenuItem>
              <MenuItem value="disbursed">Disbursed</MenuItem>
            </TextField>
          </Stack>

          <TextField
            label="Bank balance"
            type="number"
            value={bankBalance}
            onChange={(e) => setBankBalance(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            fullWidth
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Less security to refund"
              type="number"
              value={toRefund}
              onChange={(e) => setToRefund(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              fullWidth
            />
            <TextField
              label="Less security on account"
              type="number"
              value={onAccount}
              onChange={(e) => setOnAccount(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              fullWidth
            />
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Live deposits: ${formatMoney(props.security.to_refund)} to refund, $
              {formatMoney(props.security.on_account)} on account (
              {props.security.deposits_held_count} held).
            </Typography>
            {securityMatchesLive ? null : (
              <Button
                size="small"
                onClick={() => {
                  setToRefund(String(props.security.to_refund));
                  setOnAccount(String(props.security.on_account));
                }}
              >
                Reset
              </Button>
            )}
          </Stack>

          <Divider />

          <Stack spacing={0.5}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" fontWeight={700}>
                Sub-total
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                ${formatMoney(subTotal)}
              </Typography>
            </Stack>
            {preview.length === 0 ? (
              <Alert severity="warning">
                No payees are configured for {props.year}. Set the split on the House Config page
                first.
              </Alert>
            ) : (
              preview.map((p) => (
                <Stack key={p.payee} direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    {p.payee} ({p.pct}%)
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ${formatMoney(p.amount)}
                  </Typography>
                </Stack>
              ))
            )}
          </Stack>

          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={2}
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
