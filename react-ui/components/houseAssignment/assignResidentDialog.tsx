import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {
  HouseOccupancy,
  HouseSessionType,
  IBrother,
  IHouseAssignment,
  IHouseRosterRoom,
  IHouseSession,
} from "../../interfaces/api.interface";
import { createAssignment, updateAssignment } from "../../services/houseService";
import { formatMoney, roundMoney } from "../../utils/money";
import { rateForOccupancy, roomTypeLabel } from "../../utils/house";

interface Props {
  year: number;
  session: HouseSessionType;
  sessionConfig: IHouseSession | null;
  room: IHouseRosterRoom;
  bed: number;
  brothers: IBrother[];
  existing?: IHouseAssignment;
  onClose: () => void;
  onSaved: () => void;
}

function rateFor(room: IHouseRosterRoom, occupancy: HouseOccupancy): number | null {
  return rateForOccupancy(room.rate_per_person, room.capacity, occupancy);
}

export default function AssignResidentDialog(props: Props) {
  const { room, sessionConfig } = props;

  const [brotherId, setBrotherId] = useState<number | null>(props.existing?.brother_id ?? null);
  const [occupancy, setOccupancy] = useState<HouseOccupancy>(props.existing?.occupancy ?? "standard");
  const [startDate, setStartDate] = useState(props.existing?.start_date ?? sessionConfig?.start_date ?? "");
  const [endDate, setEndDate] = useState(props.existing?.end_date ?? sessionConfig?.end_date ?? "");
  const [override, setOverride] = useState(
    props.existing?.amount_override != null ? String(props.existing.amount_override) : ""
  );
  const [overrideNote, setOverrideNote] = useState(props.existing?.override_note ?? "");
  const [memberDiscount, setMemberDiscount] = useState(props.existing?.member_discount ?? false);
  const [doubleRebate, setDoubleRebate] = useState(props.existing?.double_rebate ?? false);
  const [prepayDiscount, setPrepayDiscount] = useState(props.existing?.prepay_discount ?? false);
  const [notes, setNotes] = useState(props.existing?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedBrother = props.brothers.find((b) => b.id === brotherId);

  // Active members get the rebate; boarders and alumni don't. Only auto-set on
  // a new assignment, so an existing override isn't clobbered.
  useEffect(() => {
    if (props.existing || !selectedBrother) return;
    setMemberDiscount(selectedBrother.status === "Active");
  }, [selectedBrother, props.existing]);

  // Only a buy-out can claim the rebate on more than one bed.
  const canDoubleRebate = occupancy === "full_room" && room.capacity > 1;

  // Rates and the rebate are both per 4-month term; winter is two terms.
  const terms = Math.max(Number(sessionConfig?.terms) || 1, 1);

  const preview = useMemo(() => {
    const termRate = rateFor(room, occupancy) ?? 0;
    // An override is entered as a session figure, not a per-term one.
    const base = override !== "" ? Number(override) : roundMoney(termRate * terms);
    const perTerm = Number(sessionConfig?.member_rebate ?? 0);
    const beds = canDoubleRebate && doubleRebate ? room.capacity : 1;
    const rebate = memberDiscount ? roundMoney(perTerm * beds * terms) : 0;
    const afterRebate = base - rebate;
    const pct = prepayDiscount ? Number(sessionConfig?.prepay_discount_pct ?? 0) : 0;
    return {
      termRate,
      base,
      rebate,
      beds,
      pct,
      total: roundMoney(pct ? afterRebate * (1 - pct / 100) : afterRebate),
    };
  }, [override, room, occupancy, terms, memberDiscount, doubleRebate, canDoubleRebate, prepayDiscount, sessionConfig]);

  // A buy-out only means something in a room with more than one bed.
  const occupancyOptions: { value: HouseOccupancy; label: string; rate: number | null }[] = [
    {
      value: "standard",
      label: room.capacity > 1 ? "Standard (per person)" : "Standard",
      rate: rateFor(room, "standard"),
    },
    ...(room.capacity > 1
      ? [
          {
            value: "full_room" as HouseOccupancy,
            label: "Buy-out (whole room)",
            rate: rateFor(room, "full_room"),
          },
        ]
      : []),
  ];

  async function handleSubmit() {
    if (!brotherId) {
      setError("Pick a resident.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const payload: any = {
      school_year: props.year,
      session_type: props.session,
      room_id: room.id,
      bed: props.bed,
      brother_id: brotherId,
      occupancy,
      start_date: startDate || null,
      end_date: endDate || null,
      base_amount: rateFor(room, occupancy),
      amount_override: override === "" ? null : Number(override),
      override_note: overrideNote || null,
      member_discount: memberDiscount,
      double_rebate: canDoubleRebate && doubleRebate,
      prepay_discount: prepayDiscount,
      notes: notes || null,
    };

    try {
      if (props.existing) {
        await updateAssignment(props.existing.id, payload);
      } else {
        await createAssignment(payload);
      }
      props.onSaved();
    } catch (e: any) {
      setError(e?.message ?? "Could not save the assignment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onClose={props.onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {props.existing ? "Edit assignment" : "Assign resident"} — {room.room_code}{" "}
        {roomTypeLabel(room.capacity)}
        {room.capacity > 1 ? ` · bed ${props.bed}` : ""}
        <IconButton onClick={props.onClose} aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Autocomplete
            options={props.brothers}
            value={selectedBrother ?? null}
            onChange={(_e, v) => setBrotherId(v?.id ?? null)}
            getOptionLabel={(b) => `${b.first_name} ${b.last_name}${b.status === "Boarder" ? " (boarder)" : ""}`}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => <TextField {...params} label="Resident" required />}
          />

          <FormControl fullWidth>
            <InputLabel id="occupancy-label">Occupancy</InputLabel>
            <Select
              labelId="occupancy-label"
              label="Occupancy"
              value={occupancy}
              onChange={(e) => setOccupancy(e.target.value as HouseOccupancy)}
            >
              {occupancyOptions.map((o) => (
                <MenuItem key={o.value} value={o.value} disabled={o.rate == null}>
                  {o.label}
                  {o.rate == null ? " — no rate configured" : ` — $${formatMoney(o.rate)}/term`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Start date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="End date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControlLabel
              control={<Checkbox checked={memberDiscount} onChange={(e) => setMemberDiscount(e.target.checked)} />}
              label={`Member rebate ($${formatMoney(sessionConfig?.member_rebate ?? 0)}/term)`}
            />
            <FormControlLabel
              control={<Checkbox checked={prepayDiscount} onChange={(e) => setPrepayDiscount(e.target.checked)} />}
              label={`Pre-payment discount (${Number(sessionConfig?.prepay_discount_pct ?? 0)}%)`}
            />
          </Stack>

          {/* A buy-out pays for both beds, so the Co-op may grant the rebate
              on each — its call, per resident. */}
          {canDoubleRebate && (
            <FormControlLabel
              disabled={!memberDiscount}
              control={
                <Checkbox checked={doubleRebate} onChange={(e) => setDoubleRebate(e.target.checked)} />
              }
              label={`Apply the rebate to both beds (${room.capacity} × $${formatMoney(
                sessionConfig?.member_rebate ?? 0
              )}/term)`}
            />
          )}

          <Divider />

          {/* Mid-session moves are priced by hand rather than prorated. */}
          <TextField
            label="Override amount"
            type="number"
            value={override}
            onChange={(e) => setOverride(e.target.value)}
            inputProps={{ step: "0.01" }}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            helperText="Leave blank to charge the configured rate. Entered as a whole-session amount — use this for mid-session move-ins and move-outs."
            fullWidth
          />
          {override !== "" && (
            <TextField
              label="Reason for override"
              value={overrideNote}
              onChange={(e) => setOverrideNote(e.target.value)}
              fullWidth
            />
          )}

          <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth />

          <Typography variant="body2" color="text.secondary">
            {override === "" && terms > 1
              ? `$${formatMoney(preview.termRate)}/term × ${terms} terms = $${formatMoney(preview.base)}`
              : `$${formatMoney(preview.base)}`}
            {preview.rebate
              ? ` − $${formatMoney(preview.rebate)} rebate${preview.beds > 1 ? ` (${preview.beds} beds)` : ""}`
              : ""}
            {preview.pct ? ` − ${preview.pct}% pre-payment` : ""} = <strong>${formatMoney(preview.total)}</strong> for
            the session.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={props.onClose}>Cancel</Button>
        <Button variant="contained" disabled={submitting} onClick={handleSubmit}>
          {props.existing ? "Save" : "Assign"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
