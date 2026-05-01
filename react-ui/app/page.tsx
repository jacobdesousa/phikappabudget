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
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import LogoutIcon from "@mui/icons-material/Logout";
import { me } from "../services/authService";
import { getAccessToken } from "../services/apiClient";
import { logout } from "../services/authService";
import { useColorMode } from "../theme/colorMode";

type ModuleCard = {
  href: string;
  title: string;
  description: string;
  anyPermissions?: string[];
  icon?: React.ReactNode;
};

const MODULES: ModuleCard[] = [
  { href: "/brothers", title: "Brothers", description: "Member roster, status, office, and contact details.", anyPermissions: ["brothers.read"] },
  { href: "/dues", title: "Dues", description: "Payments, balances, and who’s behind by school year.", anyPermissions: ["dues.read"] },
  { href: "/revenue", title: "Revenue", description: "Track income and payment stream breakdowns.", anyPermissions: ["revenue.read"] },
  { href: "/expenses", title: "Expenses", description: "Submissions, approvals, and reimbursements.", anyPermissions: ["expenses.read"] },
  { href: "/meetings", title: "Meetings", description: "Minutes with attendance and officer reports.", anyPermissions: ["meetings.read"] },
  { href: "/workdays", title: "Workdays", description: "Attendance that drives chapter bonus earnings.", anyPermissions: ["workdays.read"] },
  { href: "/chapter-bonus", title: "Chapter Bonus", description: "Monthly deductions + workday earnings overview.", anyPermissions: ["chapterBonus.read"] },
  { href: "/shifts/setup", title: "Setup Shifts", description: "Schedule and track chapter setup shifts.", anyPermissions: ["shifts.setup.read"] },
  { href: "/shifts/cleanup", title: "Cleanup Shifts", description: "Schedule and track chapter cleanup shifts.", anyPermissions: ["shifts.cleanup.read"] },
  { href: "/shifts/party", title: "Party Shifts", description: "Party timetable with duty slots and attendance.", anyPermissions: ["shifts.party.read"] },
  {
    href: "/config",
    title: "Config",
    description: "Manage dues config, categories, and bonus rules.",
    anyPermissions: ["dues.config", "revenue.config", "chapterBonus.config", "expenses.write"],
  },
];

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
          setPermissions(null);
          setUserEmail(null);
          return;
        }
        const u = await me();
        if (cancelled) return;
        setPermissions(u.permissions ?? []);
        setUserEmail(u.email ?? null);
      } catch (e: any) {
        // Not logged in (or token expired and refresh cookie missing) => show CTA
        if (cancelled) return;
        setPermissions(null);
        setUserEmail(null);
        setError(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleModules = React.useMemo(() => {
    return MODULES.filter((m) => hasAny(permissions ?? undefined, m.anyPermissions));
  }, [permissions]);

  return (
    <Box sx={{ bgcolor: "background.default", minHeight: "100vh", py: { xs: 3, md: 6 } }}>
      <Container maxWidth="md">
        <Stack spacing={2.5}>
          <Box sx={{ display: "flex", justifyContent: "center", pt: 1, position: "relative" }}>
            <Image src="/alphabeta.png" alt="Alpha Beta Logo" width={120} height={120} priority />
            <Box sx={{ position: "absolute", right: 0, top: 0, display: "flex", gap: 0.5 }}>
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

          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>
              Phi Kappa Sigma — Alpha Beta
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
              Budgeting and operations dashboard.
            </Typography>
            {userEmail ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Signed in as <b>{userEmail}</b>
              </Typography>
            ) : null}
          </Paper>

          {loading ? <CircularProgress /> : null}
          {error ? <Alert severity="error">{error}</Alert> : null}

          {!loading && !permissions ? (
            <Paper elevation={2} sx={{ p: { xs: 2, md: 3 } }}>
              <Stack spacing={1.5} alignItems="flex-start">
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Sign in to continue
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Access is invite-only. Once signed in, you’ll see the modules you have permissions for.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<LoginIcon />}
                  onClick={() => router.push("/login")}
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
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
              {visibleModules.map((m) => (
                <Box key={m.href} sx={{ width: { xs: "100%", sm: "calc(50% - 8px)" } }}>
                  <Card variant="outlined" sx={{ height: "100%" }}>
                    <CardActionArea sx={{ height: "100%" }} onClick={() => router.push(m.href)}>
                      <CardContent sx={{ height: "100%" }}>
                        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
                          <Box>
                            <Typography variant="h6" sx={{ fontWeight: 900 }}>
                              {m.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              {m.description}
                            </Typography>
                          </Box>
                          <ArrowForwardIosIcon fontSize="small" />
                        </Stack>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Box>
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
