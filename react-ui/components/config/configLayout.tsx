import * as React from "react";
import { Alert, Box, Paper, Stack, Typography } from "@mui/material";

// Shared furniture for the config pages.
//
// Each of these pages grew on its own, so headings ranged over h5 and h6, tables
// used three different cell paddings, and buttons mixed default and small with
// hand-set heights that clipped their own labels. The pages differ in what they
// configure, not in how they should look, so the layout lives here once.

// Page header: the title, one line saying what the page is for, and the actions
// that apply to the page as a whole.
export function ConfigHeader(props: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ sm: "center" }}
      >
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography variant="h5">{props.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {props.description}
          </Typography>
        </Stack>
        {props.actions ? (
          // Wraps rather than compressing: a button that has to shrink to fit
          // its row is how the labels ended up clipped.
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ flexShrink: 0 }}>
            {props.actions}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}

// One block of settings within a page.
export function ConfigSection(props: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  // Sections holding a wide table manage their own padding around it.
  disablePadding?: boolean;
}) {
  const hasHeader = Boolean(props.title || props.actions);
  return (
    <Paper
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        p: props.disablePadding ? 0 : 2,
        minWidth: 0,
      }}
    >
      {hasHeader ? (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ sm: "center" }}
          sx={{ mb: props.description ? 0.5 : 1.5, p: props.disablePadding ? 2 : 0, pb: props.disablePadding ? 1 : undefined }}
        >
          {props.title ? <Typography variant="h6">{props.title}</Typography> : <span />}
          {props.actions ? (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {props.actions}
            </Stack>
          ) : null}
        </Stack>
      ) : null}
      {props.description ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, px: props.disablePadding ? 2 : 0 }}>
          {props.description}
        </Typography>
      ) : null}
      {props.children}
    </Paper>
  );
}

// The page itself: consistent spacing between sections, and one place for the
// error every one of these pages renders.
export function ConfigPageLayout(props: {
  title: string;
  description: string;
  actions?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <ConfigHeader title={props.title} description={props.description} actions={props.actions} />
      {props.error ? <Alert severity="error">{props.error}</Alert> : null}
      {props.children}
    </Stack>
  );
}

// Empty state, so "nothing here yet" reads the same on every page instead of
// being a bare sentence on one and a bordered box on another.
export function ConfigEmpty(props: { children: React.ReactNode }) {
  return (
    <Box sx={{ py: 3, textAlign: "center" }}>
      <Typography variant="body2" color="text.secondary">
        {props.children}
      </Typography>
    </Box>
  );
}

// Page-level guard for a config page.
//
// The server gates every one of these endpoints, so an unpermitted visitor was
// never able to change anything — but reaching the URL directly still rendered
// the whole page, with each request failing behind it. That reads as broken
// rather than as "not yours".
export function ConfigForbidden(props: { what: string }) {
  return (
    <Alert severity="error">
      You don&apos;t have permission to manage {props.what}.
    </Alert>
  );
}
