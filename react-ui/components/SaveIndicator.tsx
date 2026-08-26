import { CircularProgress, Stack, Typography } from "@mui/material";

interface Props {
  saving: boolean;
  savedAt: Date | null;
}

// Quiet feedback for the pages that autosave, matching the budget page's inline
// editing rather than announcing itself.
//
// A toast on every pause in typing is the wrong shape for autosave: it fires
// constantly, covers part of the page, and demands attention for something the
// user did not ask for and cannot act on. A spinner while the request is in
// flight, then a timestamp that simply sits there, answers the only question
// actually being asked — "is my work safe?" — without interrupting.
export default function SaveIndicator({ saving, savedAt }: Props) {
  if (saving) {
    return (
      <Stack direction="row" gap={0.75} alignItems="center">
        <CircularProgress size={12} />
        <Typography variant="caption" color="text.secondary">
          Saving…
        </Typography>
      </Stack>
    );
  }

  if (savedAt) {
    return (
      <Typography variant="caption" color="text.secondary">
        Saved{" "}
        {savedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
      </Typography>
    );
  }

  return null;
}
