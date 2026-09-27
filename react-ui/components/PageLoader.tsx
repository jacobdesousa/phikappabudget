import * as React from "react";
import { Box, CircularProgress } from "@mui/material";

type Props = {
  /** Vertical breathing room, in theme spacing units. */
  py?: number;
  /** Fill most of the viewport — for pages with no chrome around them yet. */
  fullHeight?: boolean;
  label?: string;
};

/**
 * The one way this app shows it is loading: centred in whatever space it has.
 * Pages used to drop a bare spinner in, which left it pinned to the top-left
 * corner of the content.
 */
export default function PageLoader({ py = 6, fullHeight = false, label = "Loading" }: Props) {
  return (
    <Box
      role="status"
      aria-label={label}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        py,
        ...(fullHeight ? { minHeight: "60vh" } : null),
      }}
    >
      <CircularProgress />
    </Box>
  );
}
