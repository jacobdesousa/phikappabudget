import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import dayjs from "dayjs";
import {
  HouseDepositStatus,
  IHouseDeposit,
  IHouseDepositDeduction,
} from "../../interfaces/api.interface";
import { createHouseDeposit, updateHouseDeposit } from "../../services/houseService";
import { formatMoney, roundMoney } from "../../utils/money";
import { DEPOSIT_STATUSES, deductionsTotal, depositStatusLabel } from "../../utils/house";

interface Props {
  brotherId: number;
  brotherName: string;
  defaultAmount?: number;
  existing?: IHouseDeposit;
  onClose: () => void;
  onSaved: () => void;
}

export default function HouseDepositDialog(props: Props) {
  const [amount, setAmount] = useState(
    props.existing ? String(props.existing.amount) : String(props.defaultAmount ?? 500)
  );
  const [receivedAt, setReceivedAt] = useState(
    props.existing?.received_at ?? dayjs().format("YYYY-MM-DD")
  );
  // A deposit starts owed at room allocation; it becomes Received when it lands.
  const [status, setStatus] = useState<HouseDepositStatus>(props.existing?.status ?? "outstanding");
  const [releasedAt, setReleasedAt] = useState(props.existing?.released_at ?? "");
  const [refundCheque, setRefundCheque] = useState(props.existing?.refund_cheque_number ?? "");
  const [note, setNote] = useState(props.existing?.note ?? "");
  const [deductions, setDeductions] = useState<IHouseDepositDeduction[]>(
    props.existing?.deductions ?? []
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Money that never arrived can't be deducted from, so deductions appear as
  // soon as the deposit is received — charges get logged as damage happens,
  // well before the refund is issued at move-out.
  const isOutstanding = status === "outstanding";
  const isRefunded = status === "refunded";
  const showDeductions = !isOutstanding;

  const withheld = roundMoney(deductionsTotal(deductions));
  const net = roundMoney(Math.max(Number(amount || 0) - withheld, 0));

  function patchDeduction(idx: number, patch: Partial<IHouseDepositDeduction>) {
    setDeductions((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const payload: any = {
      brother_id: props.brotherId,
      amount: Number(amount),
      received_at: isOutstanding ? null : receivedAt || null,
      status,
      // Anything closed out has left the account, so it needs a date.
      released_at: isRefunded ? releasedAt || dayjs().format("YYYY-MM-DD") : null,
      refund_cheque_number: isRefunded ? refundCheque.trim() || null : null,
      note: note || null,
      deductions: showDeductions ? deductions.filter((d) => Number(d.amount) > 0) : [],
    };
    try {
      if (props.existing) {
        await updateHouseDeposit(props.existing.id, payload);
      } else {
        await createHouseDeposit(payload);
      }
      props.onSaved();
    } catch (e: any) {
      setError(e?.message ?? "Could not save the deposit.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onClose={props.onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {props.existing ? "Edit Deposit" : "Record Deposit"} — {props.brotherName}
        <IconButton onClick={props.onClose} aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputProps={{ step: "0.01" }}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            fullWidth
          />

          <FormControl fullWidth>
            <InputLabel id="deposit-status-label">Status</InputLabel>
            <Select
              labelId="deposit-status-label"
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as HouseDepositStatus)}
            >
              {DEPOSIT_STATUSES.map((s) => (
                <MenuItem key={s} value={s}>{depositStatusLabel(s)}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {!isOutstanding && (
            <TextField
              label="Received"
              type="date"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          )}

          {isRefunded && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Refunded on"
                type="date"
                value={releasedAt}
                onChange={(e) => setReleasedAt(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              {/* The refund leaves the residence account by cheque, so the
                  number makes it traceable in the account's transactions. */}
              <TextField
                label="Cheque #"
                value={refundCheque}
                onChange={(e) => setRefundCheque(e.target.value)}
                fullWidth
              />
            </Stack>
          )}

          {showDeductions && (
            <>
              <Divider />
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle2">Deductions</Typography>
                <Typography variant="caption" color="text.secondary">
                  Damages, cleaning, unpaid charges
                </Typography>
              </Stack>

              {deductions.map((d, idx) => (
                <Stack key={idx} direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small"
                    label="Description"
                    value={d.description ?? ""}
                    onChange={(e) => patchDeduction(idx, { description: e.target.value })}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    label="Amount"
                    type="number"
                    value={d.amount}
                    onChange={(e) => patchDeduction(idx, { amount: Number(e.target.value) })}
                    inputProps={{ step: "0.01", style: { textAlign: "right" } }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                    sx={{ width: 150, flexShrink: 0 }}
                  />
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => setDeductions((prev) => prev.filter((_x, i) => i !== idx))}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}

              <Box>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() =>
                    setDeductions((prev) => [...prev, { description: "", amount: 0 }])
                  }
                >
                  Add deduction
                </Button>
              </Box>

              <Typography variant="body2" color="text.secondary">
                ${formatMoney(Number(amount || 0))}
                {withheld > 0 ? ` − $${formatMoney(withheld)} withheld` : ""} ={" "}
                <strong>${formatMoney(net)}</strong>{" "}
                {isRefunded ? "returned to the resident" : "to refund at move-out"}
              </Typography>
            </>
          )}

          <TextField label="Note" value={note} onChange={(e) => setNote(e.target.value)} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={props.onClose}>Cancel</Button>
        <Button variant="contained" disabled={submitting} onClick={handleSubmit}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
