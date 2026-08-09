import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { HouseSessionType } from "../interfaces/api.interface";

interface Props {
  value: HouseSessionType;
  onChange: (session: HouseSessionType) => void;
}

// Winter runs Sep 1 – Apr 30, summer May 1 – Aug 31 of the same school year.
export default function HouseSessionSelector({ value, onChange }: Props) {
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={value}
      onChange={(_e, next) => next && onChange(next as HouseSessionType)}
    >
      <ToggleButton value="winter">Winter</ToggleButton>
      <ToggleButton value="summer">Summer</ToggleButton>
    </ToggleButtonGroup>
  );
}
