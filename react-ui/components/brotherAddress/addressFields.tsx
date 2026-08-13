import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { IBrother, IBrotherAddress } from "../../interfaces/api.interface";

export const EMPTY_ADDRESS: IBrotherAddress = {
  email_secondary: "",
  address_line1: "",
  address_line2: "",
  city: "",
  province: "",
  postal_code: "",
  country: "",
};

// A brother record's address, as the forms hold it: blanks rather than nulls,
// so the object spreads straight into a payload.
export function addressFromBrother(brother: Partial<IBrother> | null | undefined): IBrotherAddress {
  return {
    email_secondary: brother?.email_secondary ?? "",
    address_line1: brother?.address_line1 ?? "",
    address_line2: brother?.address_line2 ?? "",
    city: brother?.city ?? "",
    province: brother?.province ?? "",
    postal_code: brother?.postal_code ?? "",
    country: brother?.country ?? "",
  };
}

export function hasAddress(address: IBrotherAddress): boolean {
  return Object.values(address).some((v) => String(v ?? "").trim() !== "");
}

// One-line summary for the collapsed header, so a filled-in address is visible
// without opening the section.
function summarize(address: IBrotherAddress): string {
  const parts = [address.address_line1, address.city, address.province, address.country]
    .map((p) => String(p ?? "").trim())
    .filter(Boolean);
  if (parts.length) return parts.join(", ");
  const second = String(address.email_secondary ?? "").trim();
  return second ? second : "Optional — none on file";
}

interface Props {
  value: IBrotherAddress;
  onChange: (next: IBrotherAddress) => void;
  // Open on mount when the record already has one, so an edit doesn't hide it.
  defaultExpanded?: boolean;
}

// Collapsed by default: the address is six fields that most records leave
// empty, and unfolded it doubles the height of the brother modals.
export default function BrotherAddressFields(props: Props) {
  const a = props.value;

  function patch(field: keyof IBrotherAddress, v: string) {
    props.onChange({ ...a, [field]: v });
  }

  return (
    <Accordion
      defaultExpanded={props.defaultExpanded ?? false}
      disableGutters
      elevation={0}
      sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, "&:before": { display: "none" } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack>
          <Typography sx={{ fontWeight: 600 }}>Home address &amp; second email</Typography>
          <Typography variant="caption" color="text.secondary">
            {summarize(a)}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          <TextField
            fullWidth
            label="Second email"
            value={a.email_secondary}
            onChange={(e) => patch("email_secondary", e.target.value)}
          />
          <TextField
            fullWidth
            label="Address line 1"
            value={a.address_line1}
            onChange={(e) => patch("address_line1", e.target.value)}
          />
          <TextField
            fullWidth
            label="Address line 2"
            value={a.address_line2}
            onChange={(e) => patch("address_line2", e.target.value)}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              fullWidth
              label="City"
              value={a.city}
              onChange={(e) => patch("city", e.target.value)}
            />
            <TextField
              fullWidth
              label="Province / State"
              value={a.province}
              onChange={(e) => patch("province", e.target.value)}
            />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              fullWidth
              label="Postal / ZIP code"
              value={a.postal_code}
              onChange={(e) => patch("postal_code", e.target.value)}
            />
            <TextField
              fullWidth
              label="Country"
              value={a.country}
              onChange={(e) => patch("country", e.target.value)}
            />
          </Stack>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
