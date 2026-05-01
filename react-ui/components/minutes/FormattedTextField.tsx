import * as React from "react";
import { Box, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import { toggleBullets, toggleNumbering } from "../../utils/minutesText";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  disabled?: boolean;
  helperText?: string;
};

export function FormattedTextField(props: Props) {
  const inputRef = React.useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  function apply(fn: typeof toggleBullets | typeof toggleNumbering) {
    const el = inputRef.current as HTMLTextAreaElement | null;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const res = fn(props.value, start, end);
    props.onChange(res.text);
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      try {
        (inputRef.current as any).focus();
        (inputRef.current as any).setSelectionRange(res.selectionStart, res.selectionEnd);
      } catch {
        // ignore
      }
    });
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          {props.label}
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Toggle bullet list">
            <span>
              <IconButton size="small" onClick={() => apply(toggleBullets)} disabled={props.disabled}>
                <FormatListBulletedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Toggle numbered list">
            <span>
              <IconButton size="small" onClick={() => apply(toggleNumbering)} disabled={props.disabled}>
                <FormatListNumberedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      <TextField
        fullWidth
        multiline
        minRows={props.minRows ?? 2}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        disabled={props.disabled}
        inputRef={inputRef as any}
        helperText={props.helperText}
      />
    </Box>
  );
}


