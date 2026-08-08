import { IconButton, Stack, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { schoolYearLabel, schoolYearStartForDate } from "../utils/schoolYear";

interface Props {
  value: number;
  onChange: (year: number) => void;
  minYear?: number;
  maxYear?: number;
}

const DEFAULT_MAX = schoolYearStartForDate(new Date()) + 1;
const DEFAULT_MIN = DEFAULT_MAX - 4;

export default function SchoolYearSelector({ value, onChange, minYear = DEFAULT_MIN, maxYear = DEFAULT_MAX }: Props) {
  return (
    <Stack direction="row" alignItems="center" spacing={0}>
      <IconButton size="small" onClick={() => onChange(value - 1)} disabled={value <= minYear}>
        <ChevronLeftIcon fontSize="small" />
      </IconButton>
      <Typography variant="body2" sx={{ minWidth: 80, textAlign: "center", fontWeight: 600 }}>
        {schoolYearLabel(value)}
      </Typography>
      <IconButton size="small" onClick={() => onChange(value + 1)} disabled={value >= maxYear}>
        <ChevronRightIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}
