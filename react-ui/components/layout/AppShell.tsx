import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import GroupsIcon from "@mui/icons-material/Groups";
import PaymentsIcon from "@mui/icons-material/Payments";
import SettingsIcon from "@mui/icons-material/Settings";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import EventNoteIcon from "@mui/icons-material/EventNote";
import GavelIcon from "@mui/icons-material/Gavel";
import BuildIcon from "@mui/icons-material/Build";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import ConstructionIcon from "@mui/icons-material/Construction";
import CelebrationIcon from "@mui/icons-material/Celebration";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import LogoutIcon from "@mui/icons-material/Logout";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import { useTheme } from "@mui/material/styles";
import { useColorMode } from "../../theme/colorMode";
import { logout } from "../../services/authService";
import { useAuth } from "../../context/authContext";

const drawerWidth = 260;

const navItems = [
  { href: "/brothers", label: "Brothers", icon: <GroupsIcon />, anyPermissions: ["brothers.read"] },
  { href: "/dues", label: "Dues", icon: <PaymentsIcon />, anyPermissions: ["dues.read"] },
  { href: "/revenue", label: "Revenue", icon: <TrendingUpIcon />, anyPermissions: ["revenue.read"] },
  { href: "/expenses", label: "Expenses", icon: <ReceiptLongIcon />, anyPermissions: ["expenses.read"] },
  { href: "/meetings", label: "Meetings", icon: <EventNoteIcon />, anyPermissions: ["meetings.read"] },
  { href: "/workdays", label: "Workdays", icon: <BuildIcon />, anyPermissions: ["workdays.read"] },
  { href: "/chapter-bonus", label: "Chapter Bonus", icon: <GavelIcon />, anyPermissions: ["chapterBonus.read"] },
  { href: "/shifts/setup", label: "Setup Shifts", icon: <ConstructionIcon />, anyPermissions: ["shifts.setup.read"] },
  { href: "/shifts/cleanup", label: "Cleanup Shifts", icon: <CleaningServicesIcon />, anyPermissions: ["shifts.cleanup.read"] },
  { href: "/shifts/party", label: "Party Shifts", icon: <CelebrationIcon />, anyPermissions: ["shifts.party.read"] },
  { href: "/sessions", label: "Sessions", icon: <SecurityOutlinedIcon />, anyPermissions: [] },
  {
    href: "/config",
    label: "Config",
    icon: <SettingsIcon />,
    anyPermissions: ["dues.config", "revenue.config", "chapterBonus.config", "expenses.write"],
  },
];

export function AppShell(props: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const theme = useTheme();
  const { mode, toggle } = useColorMode();
  const { canAny } = useAuth();

  const handleDrawerToggle = () => setMobileOpen((p) => !p);

  const drawer = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Toolbar sx={{ px: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Phi Kappa Budget
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ px: 1 }}>
        {navItems.filter((i) => canAny(i.anyPermissions)).map((item) => {
          const active = router.pathname === item.href || router.pathname.startsWith(item.href + "/");
          return (
            <ListItemButton
              key={item.href}
              component={Link as any}
              href={item.href}
              selected={active}
              sx={{ borderRadius: 2, mb: 0.5 }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ flex: 1 }} />
      <Divider />
      <List sx={{ px: 1, pb: 2 }}>
        <ListItemButton
          component={Link as any}
          href="/"
          sx={{ borderRadius: 2, mt: 0.5 }}
        >
          <ListItemIcon>
            <HomeOutlinedIcon />
          </ListItemIcon>
          <ListItemText primary="Home" />
        </ListItemButton>
      </List>
    </Box>
  );

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        bgcolor: "background.default",
        colorScheme: (t) => t.palette.mode,
      }}
    >
      <CssBaseline />
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          backdropFilter: "saturate(180%) blur(10px)",
          backgroundColor:
            theme.palette.mode === "dark"
              ? "rgba(15,23,42,0.72)"
              : "rgba(255,255,255,0.85)",
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ gap: 1.5 }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ display: { md: "none" } }}
            aria-label="open navigation"
          >
            <MenuIcon />
          </IconButton>
          <Box
            component={Link as any}
            href="/"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              textDecoration: "none",
              borderRadius: 1,
            }}
            aria-label="Go to home"
          >
            <Image
              src="/alphabeta.png"
              alt="Alpha Beta Logo"
              width={32}
              height={32}
              priority
            />
          </Box>
          <Typography variant="h6">{props.title}</Typography>
          <Box sx={{ flex: 1 }} />
          <Tooltip title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            <IconButton color="inherit" onClick={toggle} aria-label="toggle color mode">
              {mode === "dark" ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Logout">
            <IconButton
              color="inherit"
              aria-label="logout"
              onClick={async () => {
                await logout();
                await router.push("/login");
              }}
            >
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box" },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              borderRight: "1px solid",
              borderColor: "divider",
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          mt: "64px",
        }}
      >
        {props.children}
      </Box>
    </Box>
  );
}


