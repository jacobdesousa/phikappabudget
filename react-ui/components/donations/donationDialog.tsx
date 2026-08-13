import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import dayjs from "dayjs";
import {
  IBondState,
  IBrother,
  IDonation,
  IDonationCampaign,
} from "../../interfaces/api.interface";
import { formatMoney, roundMoney } from "../../utils/money";
import {
  createDonation,
  getBondState,
  updateDonation,
} from "../../services/donationsService";

interface Props {
  brothers: IBrother[];
  campaigns: IDonationCampaign[];
  // Edit mode touches one stored row; the bond split is not recomputed.
  existing?: IDonation;
  defaultBrotherId?: number | null;
  onClose: () => void;
  onSaved: () => void;
}

function brotherLabel(b: IBrother) {
  const name = `${b.last_name ?? ""}, ${b.first_name ?? ""}`.replace(/^, |, $/g, "");
  return b.pledge_class ? `${name} (${b.pledge_class})` : name;
}

export default function DonationDialog(props: Props) {
  const existing = props.existing;

  const [brotherId, setBrotherId] = useState<number | null>(
    existing?.brother_id ?? props.defaultBrotherId ?? null
  );
  const [donatedOn, setDonatedOn] = useState(
    existing?.donated_on ?? dayjs().format("YYYY-MM-DD")
  );
  const [amount, setAmount] = useState(existing ? String(Number(existing.amount)) : "");
  const [campaignId, setCampaignId] = useState<string>(
    existing?.campaign_id ? String(existing.campaign_id) : ""
  );
  const [note, setNote] = useState(existing?.note ?? "");
  const [applyToBond, setApplyToBond] = useState(true);
  // Blank means "use the whole outstanding bond"; typed means an override.
  const [bondOverride, setBondOverride] = useState("");
  const [bond, setBond] = useState<IBondState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedBrother = useMemo(
    () => props.brothers.find((b) => b.id === brotherId) ?? null,
    [props.brothers, brotherId]
  );

  // The split proposal comes from the server's view of the bond, so it stays
  // right even if someone else entered a donation a minute ago.
  useEffect(() => {
    if (existing || !brotherId) {
      setBond(null);
      return;
    }
    let cancelled = false;
    getBondState(brotherId)
      .then((state) => {
        if (!cancelled) setBond(state);
      })
      .catch(() => {
        if (!cancelled) setBond(null);
      });
    return () => {
      cancelled = true;
    };
  }, [brotherId, existing]);

  const amountNum = Number(amount);
  const validAmount = Number.isFinite(amountNum) && amountNum > 0;

  // Mirrors createDonation on the server: as much of the gift as the bond still
  // owes, unless overridden, and never more than the outstanding balance.
  const ceiling = bond ? roundMoney(Math.min(validAmount ? amountNum : 0, bond.bond_outstanding)) : 0;
  const overrideNum = Number(bondOverride);
  const bondPortion = !applyToBond
    ? 0
    : bondOverride !== "" && Number.isFinite(overrideNum)
    ? roundMoney(Math.min(Math.max(0, overrideNum), ceiling))
    : ceiling;
  const generalPortion = validAmount ? roundMoney(amountNum - bondPortion) : 0;
  const allToBond = bondPortion > 0 && generalPortion === 0;

  async function handleSubmit() {
    if (!brotherId) {
      setError("Pick a brother. They must be on the roster first.");
      return;
    }
    if (!validAmount) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (existing) {
        await updateDonation(existing.id, {
          donated_on: donatedOn,
          amount: amountNum,
          campaign_id: existing.kind === "bond" ? null : campaignId ? Number(campaignId) : null,
          note: note || null,
        });
      } else {
        await createDonation({
          brother_id: brotherId,
          donated_on: donatedOn,
          amount: amountNum,
          campaign_id: allToBond || !campaignId ? null : Number(campaignId),
          note: note || null,
          apply_to_bond: applyToBond,
          bond_amount: applyToBond && bondOverride !== "" ? overrideNum : null,
        });
      }
      props.onSaved();
    } catch (e: any) {
      setError(e?.message ?? "Could not save the donation.");
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pr: 6 }}>
        {existing ? "Edit donation" : "New donation"}
        <IconButton onClick={props.onClose} sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <Autocomplete
            options={props.brothers}
            value={selectedBrother}
            disabled={Boolean(existing)}
            getOptionLabel={brotherLabel}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            onChange={(_, val) => {
              setBrotherId(val?.id ?? null);
              setBondOverride("");
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Brother"
                helperText={
                  existing
                    ? "The donor cannot be changed; delete and re-enter instead."
                    : "The donor must already be on the roster."
                }
              />
            )}
          />

          <TextField
            label="Date"
            type="date"
            value={donatedOn}
            onChange={(e) => setDonatedOn(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />

          <TextField
            label="Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            fullWidth
          />

          {existing ? null : (
            <>
              <Divider />
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={applyToBond}
                      onChange={(e) => {
                        setApplyToBond(e.target.checked);
                        setBondOverride("");
                      }}
                    />
                  }
                  label="Apply to bond first"
                />
                <Typography variant="body2" color="text.secondary">
                  {bond === null
                    ? "Pick a brother to see their bond."
                    : bond.bond_outstanding <= 0
                    ? bond.has_bond
                      ? `Bond paid off ($${formatMoney(bond.bond_price)}). The whole gift is a donation.`
                      : "No bond outstanding. The whole gift is a donation."
                    : `${bond.has_bond ? "Bond" : "Bond opens at"} $${formatMoney(
                        bond.bond_price
                      )} · $${formatMoney(bond.bond_outstanding)} still owing.`}
                </Typography>
                {validAmount && bond ? (
                  <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 700 }}>
                    ${formatMoney(bondPortion)} to bond · ${formatMoney(generalPortion)} general
                  </Typography>
                ) : null}
              </Box>

              {applyToBond && bond && bond.bond_outstanding > 0 ? (
                <TextField
                  label="Bond portion (override)"
                  type="number"
                  value={bondOverride}
                  onChange={(e) => setBondOverride(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                  helperText={`Leave blank to apply the usual $${formatMoney(
                    ceiling
                  )}. Cannot exceed what the bond still owes.`}
                  fullWidth
                />
              ) : null}
              <Divider />
            </>
          )}

          <TextField
            select
            label="Campaign"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            disabled={existing ? existing.kind === "bond" : allToBond}
            helperText={
              (existing ? existing.kind === "bond" : allToBond)
                ? "Bond money is a debt being retired, not a campaign gift."
                : "Optional. Leave blank for an unattached donation."
            }
            fullWidth
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {props.campaigns.map((c) => (
              <MenuItem key={c.id} value={String(c.id)}>
                {c.name}
                {c.is_active ? "" : " (closed)"}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {existing ? "Save" : "Record"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
