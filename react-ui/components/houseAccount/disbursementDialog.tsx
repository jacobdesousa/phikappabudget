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
import { sessionLabel, sessionTypeForDate } from "../../utils/house";
import { schoolYearStartForDate } from "../../utils/schoolYear";

interface Props {
  payees: IHousePayee[];
  // Live deposit figures, used to prefill the two deposit lines.
  security: IHouseSecuritySnapshot;
  // Balance derived from recorded payments, deposits and past disbursements.
  // Prefills the bank balance; the treasurer overrides it if the statement
  // disagrees, and that difference is what adjustments are for.
  derivedBalance: number;
  existing?: IHouseDisbursement;
  onClose: () => void;
  onSaved: () => void;
}

export default function DisbursementDialog(props: Props) {
  const existing = props.existing;

  const [date, setDate] = useState(existing?.disbursed_on ?? dayjs().format("YYYY-MM-DD"));
  const [bankBalance, setBankBalance] = useState(
    String(existing ? existing.bank_balance : props.derivedBalance)
  );
  const [toRefund, setToRefund] = useState(
    String(existing ? existing.security_to_refund : props.security.to_refund)
  );
  const [onAccount, setOnAccount] = useState(
    String(existing ? existing.security_on_account : props.security.held)
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Percentages are frozen onto the shares at creation, so an edit must preview
  // the split using the disbursement's own pct, not the current config.
  const splitBasis = existing?.shares.length
    ? existing.shares.map((s) => ({ payee: s.payee, pct: Number(s.pct) }))
    : props.payees.map((p) => ({ payee: p.payee, pct: Number(p.pct) }));

  // One cheque per payee, keyed by name so it survives reordering.
  const [cheques, setCheques] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      splitBasis.map((p) => [
        p.payee,
        existing?.shares.find((s) => s.payee === p.payee)?.cheque_number ?? "",
      ])
    )
  );

  const subTotal = roundMoney(
    (Number(bankBalance) || 0) - (Number(toRefund) || 0) - (Number(onAccount) || 0)
  );
  const preview = splitBasis.map((p) => ({
    ...p,
    amount: roundMoney((subTotal * p.pct) / 100),
  }));

  const securityMatchesLive =
    roundMoney(Number(toRefund) || 0) === roundMoney(props.security.to_refund) &&
    roundMoney(Number(onAccount) || 0) === roundMoney(props.security.held);

  const balanceMatchesDerived =
    roundMoney(Number(bankBalance) || 0) === roundMoney(props.derivedBalance);

  async function handleSubmit() {
    if (bankBalance === "") {
      setError("Enter the bank balance.");
      return;
    }
    setSubmitting(true);
    setError(null);
    // school_year and session_type are derived from the date on the server.
    const payload: any = {
      disbursed_on: date,
      bank_balance: Number(bankBalance),
      security_to_refund: Number(toRefund) || 0,
      security_on_account: Number(onAccount) || 0,
      notes: notes || null,
      cheques: splitBasis.map((p) => ({
        payee: p.payee,
        cheque_number: cheques[p.payee]?.trim() || null,
      })),
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
          {/* Year and session follow the date, so the title states what will
              be recorded rather than asking for it. */}
          {sessionLabel(
            schoolYearStartForDate(new Date(`${date}T00:00:00`)),
            sessionTypeForDate(date)
          )}
        </Typography>
        <IconButton onClick={props.onClose} sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <TextField
            label="Date disbursed"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />

          <TextField
            label="Bank balance"
            type="number"
            value={bankBalance}
            onChange={(e) => setBankBalance(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            helperText={
              balanceMatchesDerived
                ? "Calculated from recorded payments, deposits and past disbursements. Change it if the bank statement says otherwise."
                : `Calculated balance is $${formatMoney(props.derivedBalance)}. The $${formatMoney(
                    Math.abs((Number(bankBalance) || 0) - props.derivedBalance)
                  )} difference will be recorded as an adjustment automatically.`
            }
            fullWidth
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Less deposits to refund"
              type="number"
              value={toRefund}
              onChange={(e) => setToRefund(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              fullWidth
            />
            <TextField
              label="Less current deposits held"
              type="number"
              value={onAccount}
              onChange={(e) => setOnAccount(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              fullWidth
            />
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Deposits on hand: ${formatMoney(props.security.to_refund)} owed back to{" "}
              {props.security.to_refund_count} past resident
              {props.security.to_refund_count === 1 ? "" : "s"}, $
              {formatMoney(props.security.held)} held for {props.security.held_count} current
              resident{props.security.held_count === 1 ? "" : "s"}.
            </Typography>
            {securityMatchesLive ? null : (
              <Button
                size="small"
                onClick={() => {
                  setToRefund(String(props.security.to_refund));
                  setOnAccount(String(props.security.held));
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
                No payees are configured for {schoolYearStartForDate(new Date(`${date}T00:00:00`))}. Set the split on the
                House Config page first.
              </Alert>
            ) : (
              preview.map((p) => (
                <Stack
                  key={p.payee}
                  direction="row"
                  spacing={2}
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Typography variant="body2" color="text.secondary">
                    {p.payee} ({p.pct}%)
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    {/* Each payee is paid by its own cheque, so the number is
                        captured per share rather than per disbursement. */}
                    <TextField
                      label="Cheque #"
                      size="small"
                      value={cheques[p.payee] ?? ""}
                      onChange={(e) =>
                        setCheques((prev) => ({ ...prev, [p.payee]: e.target.value }))
                      }
                      sx={{ width: 120 }}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 90, textAlign: "right" }}>
                      ${formatMoney(p.amount)}
                    </Typography>
                  </Stack>
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
