import { Alert, FormControl, InputLabel, MenuItem, Select, Stack } from "@mui/material";
import { schoolYearLabel, schoolYearStartForDate } from "../utils/schoolYear";

interface Props {
  value: number;
  onChange: (year: number) => void;
  // The entry's own date. Drives the default and the mismatch warning.
  date?: string;
  label?: string;
  warning?: string;
  disabled?: boolean;
}

// Which school year an entry counts toward. The date normally settles it, so
// this field follows the date on its own — but the Sept 1 cutover means money
// received in August belongs to the year that just ended, which is not always
// what the treasurer means. Overriding is allowed, and says so out loud rather
// than letting a deliberate-looking mismatch pass unremarked.
export default function SchoolYearFilingSelect({
  value,
  onChange,
  date,
  label = "School Year",
  warning = "Warning: You are adding a revenue item to a school year that does not correspond with the indicated date.",
  disabled,
}: Props) {
  const derived = date ? schoolYearStartForDate(date) : null;
  const mismatched = derived !== null && derived !== value;

  // A year either side of both the current filing and the one the date implies,
  // so the two stay reachable however far apart they drift.
  const years = new Set<number>();
  for (const anchor of [value, derived]) {
    if (anchor === null) continue;
    for (let y = anchor - 1; y <= anchor + 1; y += 1) years.add(y);
  }
  const options = Array.from(years).sort((a, b) => a - b);

  const labelId = `filing-year-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <Stack spacing={1}>
      <FormControl fullWidth disabled={disabled}>
        <InputLabel id={labelId}>{label}</InputLabel>
        <Select
          labelId={labelId}
          label={label}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        >
          {options.map((y) => (
            <MenuItem key={y} value={y}>
              {schoolYearLabel(y)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {mismatched && (
        <Alert severity="warning" sx={{ py: 0.25, fontSize: "0.8rem" }}>
          {warning}
        </Alert>
      )}
    </Stack>
  );
}
