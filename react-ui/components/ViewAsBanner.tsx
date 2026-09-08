import * as React from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { getViewAsUser, type ViewAsUser } from "../services/apiClient";
import { stopViewAs } from "../services/authService";

// Persistent marker that the app is being driven as someone else, and the way
// back out.
//
// Deliberately free of context: it reads the stored session directly rather
// than through useAuth. The app router's landing page has no AuthProvider, and
// that is exactly where an admin ends up after starting a session — a banner
// that could only render inside the pages-router shell left no exit from the
// one page they were guaranteed to land on.
//
// sessionStorage is also the honest source here. That token is what the request
// interceptor actually sends, so if it is present the app IS acting as someone
// else, whatever any other state believes.
export default function ViewAsBanner(props: {
  // Where it sticks. The pages shell has a 64px fixed header above it; the app
  // router's landing page has nothing, so it sits at the top.
  top?: number | string;
}) {
  const [viewing, setViewing] = React.useState<ViewAsUser | null>(null);
  const [leaving, setLeaving] = React.useState(false);

  // Storage is not readable during SSR, so this resolves after mount.
  React.useEffect(() => {
    setViewing(getViewAsUser());
  }, []);

  if (!viewing) return null;

  const name = [viewing.first_name, viewing.last_name].filter(Boolean).join(" ");

  return (
    <Box
      sx={{
        bgcolor: "warning.main",
        color: "warning.contrastText",
        px: 2,
        py: 0.75,
        // Full-bleed inside whatever padded region hosts it.
        mx: { xs: -2, md: -3 },
        mt: { xs: -2, md: -3 },
        mb: { xs: 2, md: 3 },
        position: "sticky",
        top: props.top ?? 0,
        zIndex: (theme) => theme.zIndex.appBar - 1,
      }}
    >
      <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
        <VisibilityOutlinedIcon fontSize="small" />
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          Viewing as {name || viewing.email}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.9 }}>
          Anything you change is real, and is recorded against your account.
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="contained"
          color="inherit"
          disabled={leaving}
          sx={{ color: "text.primary", bgcolor: "background.paper", flexShrink: 0 }}
          onClick={async () => {
            setLeaving(true);
            await stopViewAs();
            window.location.assign("/");
          }}
        >
          {leaving ? "Leaving…" : "Back to my account"}
        </Button>
      </Stack>
    </Box>
  );
}
