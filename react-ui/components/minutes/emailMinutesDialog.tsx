import * as React from "react";
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import type { IBrother } from "../../interfaces/api.interface";
import { matchesBrotherSearch } from "../../utils/brotherSearch";

interface Props {
  open: boolean;
  brothers: IBrother[];
  senderName: string;
  senderOffice: string;
  onClose: () => void;
  onSend: (payload: { custom_message: string; recipient_brother_ids: number[] }) => void;
}

// The address the minutes would actually reach. Alumni records frequently have
// only the secondary address filled in, and the server falls back the same way.
export function effectiveEmail(b: IBrother): string {
  return (b.email ?? "").trim() || (b.email_secondary ?? "").trim();
}

function fullName(b: IBrother): string {
  return `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim();
}

// Recipient picking for the meeting minutes.
//
// The two halves are deliberately different shapes. Actives are the default
// audience, so they arrive pre-checked in a list you subtract from. Everyone
// else — alumni, boarders, anyone inactive — is a few hundred records nobody
// wants to scroll, and is opted in one at a time through search.
export default function EmailMinutesDialog(props: Props) {
  const { open, brothers, senderName, senderOffice, onClose, onSend } = props;

  const [message, setMessage] = React.useState("");
  const [excluded, setExcluded] = React.useState<Set<number>>(new Set());
  const [extras, setExtras] = React.useState<IBrother[]>([]);
  const [listOpen, setListOpen] = React.useState(false);

  const actives = React.useMemo(
    () =>
      brothers
        .filter((b) => (b.status ?? "").toLowerCase() === "active" && b.id)
        .sort((a, b) => fullName(a).localeCompare(fullName(b))),
    [brothers]
  );

  // An active with no address on file can never be a recipient, so it is shown
  // as a disabled row rather than quietly vanishing from the count.
  const mailableActives = React.useMemo(() => actives.filter((b) => effectiveEmail(b)), [actives]);

  const others = React.useMemo(
    () =>
      brothers
        .filter((b) => b.id && (b.status ?? "").toLowerCase() !== "active" && effectiveEmail(b))
        .sort((a, b) => fullName(a).localeCompare(fullName(b))),
    [brothers]
  );

  // Starting fresh each time the dialog opens: a deselection made for last
  // week's minutes should not silently carry into this week's.
  React.useEffect(() => {
    if (!open) return;
    setExcluded(new Set());
    setExtras([]);
    setListOpen(false);
  }, [open]);

  const selectedActives = React.useMemo(
    () => mailableActives.filter((b) => !excluded.has(b.id as number)),
    [mailableActives, excluded]
  );

  const recipientIds = React.useMemo(
    () => [...selectedActives, ...extras].map((b) => b.id as number),
    [selectedActives, extras]
  );

  function toggle(id: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const total = recipientIds.length;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Email Meeting Minutes</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Minutes will be sent as a PDF attachment. Add an optional message below.
        </Typography>
        <TextField
          label="Message (optional)"
          multiline
          minRows={4}
          fullWidth
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. Brothers — hope everyone had a great meeting tonight..."
        />

        <Divider sx={{ my: 2 }} />

        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Button
            size="small"
            onClick={() => setListOpen((v) => !v)}
            startIcon={listOpen ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Active brothers
          </Button>
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="caption" color="text.secondary">
              {selectedActives.length} of {mailableActives.length} selected
            </Typography>
            <Button size="small" onClick={() => setExcluded(new Set())} disabled={excluded.size === 0}>
              All
            </Button>
            <Button
              size="small"
              onClick={() => setExcluded(new Set(mailableActives.map((b) => b.id as number)))}
              disabled={selectedActives.length === 0}
            >
              None
            </Button>
          </Stack>
        </Stack>

        <Collapse in={listOpen} unmountOnExit>
          <Box
            sx={{
              mt: 1,
              maxHeight: 240,
              overflowY: "auto",
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              px: 1,
              py: 0.5,
            }}
          >
            {actives.length === 0 && (
              <Typography variant="caption" color="text.secondary">
                No active brothers on the roster.
              </Typography>
            )}
            {actives.map((b) => {
              const id = b.id as number;
              const email = effectiveEmail(b);
              return (
                <Stack
                  key={id}
                  direction="row"
                  alignItems="center"
                  gap={1}
                  sx={{ py: 0.1, cursor: email ? "pointer" : "default", opacity: email ? 1 : 0.5 }}
                  onClick={() => email && toggle(id)}
                >
                  <Checkbox
                    size="small"
                    sx={{ p: 0.25 }}
                    disabled={!email}
                    checked={Boolean(email) && !excluded.has(id)}
                    onChange={() => toggle(id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                    {fullName(b)}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ ml: "auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {email || "no email on file"}
                  </Typography>
                </Stack>
              );
            })}
          </Box>
        </Collapse>

        <Box sx={{ mt: 2 }}>
          <Autocomplete
            multiple
            options={others}
            value={extras}
            onChange={(_, value) => setExtras(value)}
            getOptionLabel={(b) => fullName(b)}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            filterOptions={(options, state) =>
              options.filter((b) => matchesBrotherSearch(b, state.inputValue))
            }
            renderOption={(optionProps, b) => (
              <li {...optionProps} key={b.id}>
                <Stack sx={{ minWidth: 0 }}>
                  <Typography variant="body2">
                    {fullName(b)}{" "}
                    <Typography component="span" variant="caption" color="text.secondary">
                      {b.status}
                      {b.pledge_class ? ` · ${b.pledge_class}` : ""}
                    </Typography>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {effectiveEmail(b)}
                  </Typography>
                </Stack>
              </li>
            )}
            renderTags={(value, getTagProps) =>
              value.map((b, index) => (
                <Chip size="small" label={fullName(b)} {...getTagProps({ index })} key={b.id} />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Also send to (alumni and inactive)"
                placeholder="Search by name, email, pledge class…"
              />
            )}
          />
        </Box>

        {(senderName || senderOffice) && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "block" }}>
            Signed as: {[senderName, senderOffice].filter(Boolean).join(", ")}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          startIcon={<EmailOutlinedIcon />}
          disabled={total === 0}
          onClick={() => onSend({ custom_message: message, recipient_brother_ids: recipientIds })}
        >
          Send to {total} recipient{total === 1 ? "" : "s"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
