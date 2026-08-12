"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Container,
  Paper,
  Stack,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";
import { APP_MODULES } from "../components/navigation/modules";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import LogoutIcon from "@mui/icons-material/Logout";
import { me } from "../services/authService";
import { getAccessToken, redirectToLogin } from "../services/apiClient";
import { logout } from "../services/authService";
import { useColorMode } from "../theme/colorMode";

type ModuleCard = {
  href: string;
  title: string;
  description: string;
  anyPermissions?: string[];
  icon: React.ReactNode;
};


function hasAny(perms: string[] | undefined, keys: string[] | undefined) {
  if (!keys || keys.length === 0) return true;
  if (!perms || perms.length === 0) return false;
  const set = new Set(perms);
  return keys.some((k) => set.has(k));
}

export default function LandingPage() {
  const router = useRouter();
  const { mode, toggle } = useColorMode();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [permissions, setPermissions] = React.useState<string[] | null>(null);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = getAccessToken();
        if (!token) {
          // Not signed in: go straight to login instead of stalling here.
          redirectToLogin("unauthorized");
          return;
        }
        const u = await me();
        if (cancelled) return;
        setPermissions(u.permissions ?? []);
        setUserEmail(u.email ?? null);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setPermissions(null);
        setUserEmail(null);
        setError(null);
        // Session is dead (refresh already failed in the interceptor); leave the
        // spinner up while the redirect completes.
        redirectToLogin("expired");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleModules = React.useMemo(() => {
    return APP_MODULES.filter((m) => hasAny(permissions ?? undefined, m.anyPermissions));
  }, [permissions]);

  return (
    <Box sx={{ bgcolor: "background.default", minHeight: "100vh", py: { xs: 3, md: 6 } }}>
      <Container maxWidth="lg">
        <Stack spacing={3}>
          {/* Header row */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Image src="/alphabeta.png" alt="Alpha Beta Logo" width={56} height={56} priority />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                  Phi Kappa Sigma
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Alpha Beta — Operations Dashboard
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              {userEmail ? (
                <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, display: { xs: "none", sm: "block" } }}>
                  {userEmail}
                </Typography>
              ) : null}
              <Tooltip title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
                <IconButton onClick={toggle} aria-label="toggle color mode">
                  {mode === "dark" ? <Brightness7Icon /> : <Brightness4Icon />}
                </IconButton>
              </Tooltip>
              {userEmail ? (
                <Tooltip title="Logout">
                  <IconButton
                    aria-label="logout"
                    onClick={async () => {
                      await logout();
                      router.push("/login");
                    }}
                  >
                    <LogoutIcon />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Box>
          </Box>

          {loading ? (
            <Box display="flex" justifyContent="center" py={6}>
              <CircularProgress />
            </Box>
          ) : null}
          {error ? <Alert severity="error">{error}</Alert> : null}

          {!loading && !permissions ? (
            <Paper elevation={2} sx={{ p: { xs: 2, md: 3 } }}>
              <Stack spacing={1.5} alignItems="flex-start">
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Sign in to continue
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Access is invite-only. Once signed in, you&apos;ll see the modules you have permissions for.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<LoginIcon />}
                  onClick={() => router.push("/login?next=%2F")}
                >
                  Go to login
                </Button>
              </Stack>
            </Paper>
          ) : null}

          {!loading && permissions && visibleModules.length === 0 ? (
            <Alert severity="warning">No modules are available for your account yet. Ask the Tau to grant access.</Alert>
          ) : null}

          {!loading && permissions && visibleModules.length > 0 ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, 1fr)",
                  md: "repeat(3, 1fr)",
                  lg: "repeat(4, 1fr)",
                },
                gap: 1.5,
              }}
            >
              {visibleModules.map((m) => (
                <Card
                  key={m.href}
                  variant="outlined"
                  sx={{
                    transition: "border-color 0.15s, box-shadow 0.15s",
                    "&:hover": { borderColor: "primary.main", boxShadow: 2 },
                  }}
                >
                  <CardActionArea sx={{ height: "100%" }} onClick={() => router.push(m.href)}>
                    <CardContent>
                      <Box
                        sx={{
                          display: "inline-flex",
                          p: 1,
                          borderRadius: 1.5,
                          bgcolor: "action.selected",
                          color: "primary.main",
                          mb: 1.5,
                        }}
                      >
                        {m.icon}
                      </Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                        {m.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {m.description}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              ))}
            </Box>
          ) : null}

          <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
            For support, contact your Tau.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
