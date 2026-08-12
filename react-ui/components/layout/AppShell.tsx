import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import {
  AppBar,
  Badge,
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
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import LogoutIcon from "@mui/icons-material/Logout";
import { useTheme } from "@mui/material/styles";
import { useColorMode } from "../../theme/colorMode";
import { logout } from "../../services/authService";
import { useAuth } from "../../context/authContext";
import { APP_MODULES } from "../navigation/modules";
import { getNotifications } from "../../services/notificationsService";

const drawerWidth = 260;


export function AppShell(props: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [notifCount, setNotifCount] = React.useState(0);
  const theme = useTheme();
  const { mode, toggle } = useColorMode();
  const { canAny } = useAuth();

  React.useEffect(() => {
    getNotifications()
      .then((d) => setNotifCount(d.upcoming_shifts?.length ?? 0))
      .catch(() => {});
  }, []);

  const handleDrawerToggle = () => setMobileOpen((p) => !p);

  const drawer = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Toolbar sx={{ px: 2 }} />
      <Divider />
      <List sx={{ px: 1 }}>
        {APP_MODULES.filter((i) => canAny(i.anyPermissions)).map((item) => {
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
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
            {props.title}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Tooltip title={notifCount > 0 ? `${notifCount} upcoming shift${notifCount === 1 ? "" : "s"}` : "Notifications"}>
            <IconButton
              color="inherit"
              aria-label="notifications"
              component={Link as any}
              href="/notifications"
            >
              <Badge badgeContent={notifCount} color="error" max={99}>
                <NotificationsNoneIcon />
              </Badge>
            </IconButton>
          </Tooltip>
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
          // Without minWidth, a flex child grows to fit its widest content, so a
          // wide table pushes the whole page sideways instead of scrolling
          // inside its own container.
          minWidth: 0,
          p: { xs: 2, md: 3 },
          mt: "64px",
        }}
      >
        {props.children}
      </Box>
    </Box>
  );
}
