import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { schoolYearLabel, schoolYearStartForDate } from "../utils/schoolYear";

interface Props {
  value: number;
  onChange: (year: number) => void;
  // The entry's own date, used to flag which option the Sept 1 cutover implies.
  date?: string;
  label?: string;
  disabled?: boolean;
}

// Which school year an entry counts toward. The date can't settle it on its
// own: by the Sept 1 cutover a payment received in August belongs to the year
// that just ended, but it is just as often money collected for the year about
// to start. This lets the filing be stated outright instead of inferred.
export default function SchoolYearFilingSelect({
  value,
  onChange,
  date,
  label = "Counts toward school year",
  disabled,
}: Props) {
  const derived = date ? schoolYearStartForDate(date) : null;

  // Offer a year either side of both the selected filing and the one the date
  // implies, so the two are always both reachable however far apart they sit.
  const years = new Set<number>();
  for (const anchor of [value, derived]) {
    if (anchor === null) continue;
    for (let y = anchor - 1; y <= anchor + 1; y += 1) years.add(y);
  }
  const options = Array.from(years).sort((a, b) => a - b);

  const labelId = `filing-year-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
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
            {y === derived ? " — from the entry date" : ""}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
