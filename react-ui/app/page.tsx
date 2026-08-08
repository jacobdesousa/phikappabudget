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
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import LogoutIcon from "@mui/icons-material/Logout";
import GroupsIcon from "@mui/icons-material/Groups";
import PaymentsIcon from "@mui/icons-material/Payments";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import EventNoteIcon from "@mui/icons-material/EventNote";
import BuildIcon from "@mui/icons-material/Build";
import GavelIcon from "@mui/icons-material/Gavel";
import ConstructionIcon from "@mui/icons-material/Construction";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import CelebrationIcon from "@mui/icons-material/Celebration";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import AssignmentLateIcon from "@mui/icons-material/AssignmentLate";
import SettingsIcon from "@mui/icons-material/Settings";
import { me } from "../services/authService";
import { getAccessToken } from "../services/apiClient";
import { logout } from "../services/authService";
import { useColorMode } from "../theme/colorMode";

type ModuleCard = {
  href: string;
  title: string;
  description: string;
  anyPermissions?: string[];
  icon: React.ReactNode;
};

const MODULES: ModuleCard[] = [
  { href: "/brothers", title: "Brothers", description: "Member roster, status, office, and contact details.", anyPermissions: ["brothers.read"], icon: <GroupsIcon /> },
  { href: "/dues", title: "Dues", description: "Payments, balances, and who's behind by school year.", anyPermissions: ["dues.read"], icon: <PaymentsIcon /> },
  { href: "/revenue", title: "Revenue", description: "Track income and payment stream breakdowns.", anyPermissions: ["revenue.read"], icon: <TrendingUpIcon /> },
  { href: "/expenses", title: "Expenses", description: "Submissions, approvals, and reimbursements.", anyPermissions: ["expenses.read"], icon: <ReceiptLongIcon /> },
  { href: "/budget", title: "Budget", description: "Budgeted vs actual spend by category across the year.", anyPermissions: ["budget.read"], icon: <AccountBalanceOutlinedIcon /> },
  { href: "/meetings", title: "Meetings", description: "Minutes with attendance and officer reports.", anyPermissions: ["meetings.read"], icon: <EventNoteIcon /> },
  { href: "/workdays", title: "Workdays", description: "Attendance that drives chapter bonus earnings.", anyPermissions: ["workdays.read"], icon: <BuildIcon /> },
  { href: "/chapter-bonus", title: "Chapter Bonus", description: "Monthly deductions + workday earnings overview.", anyPermissions: ["chapterBonus.read"], icon: <GavelIcon /> },
  { href: "/shifts/setup", title: "Setup Shifts", description: "Schedule and track chapter setup shifts.", anyPermissions: ["shifts.setup.read"], icon: <ConstructionIcon /> },
  { href: "/shifts/cleanup", title: "Cleanup Shifts", description: "Schedule and track chapter cleanup shifts.", anyPermissions: ["shifts.cleanup.read"], icon: <CleaningServicesIcon /> },
  { href: "/shifts/party", title: "Party Shifts", description: "Party timetable with duty slots and attendance.", anyPermissions: ["shifts.party.read"], icon: <CelebrationIcon /> },
  { href: "/room-draw", title: "Room Draw", description: "Points standings per bylaws for room selection.", anyPermissions: ["roomDraw.read"], icon: <MeetingRoomOutlinedIcon /> },
  { href: "/makeups", title: "Makeups", description: "All unresolved absences requiring makeup.", anyPermissions: [], icon: <AssignmentLateIcon /> },
  {
    href: "/config",
    title: "Config",
    description: "Manage dues config, categories, and bonus rules.",
    anyPermissions: ["dues.config", "revenue.config", "chapterBonus.config", "expenses.write"],
    icon: <SettingsIcon />,
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
                  Access is invite-only. Once signed in, you'll see the modules you have permissions for.
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
                        {m.title}
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
