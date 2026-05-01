import Link from "next/link";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import PaymentsIcon from "@mui/icons-material/Payments";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import GavelIcon from "@mui/icons-material/Gavel";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import { useAuth } from "../context/authContext";

const CARD_MIN_HEIGHT = 124;

function ConfigCard(props: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ width: "100%" }}>
      <CardActionArea component={Link as any} href={props.href} sx={{ height: "100%" }}>
        <CardContent sx={{ width: "100%", height: "100%", minHeight: CARD_MIN_HEIGHT, display: "flex", alignItems: "center" }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: "100%" }}>
            <Box sx={{ width: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {props.icon}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700 }}>{props.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {props.description}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function ConfigPage() {
  const { can } = useAuth();
  const isAdmin = can("admin.users");
  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="h5">Config</Typography>
        <Typography variant="body2" color="text.secondary">
          Central place for chapter configuration.
        </Typography>
      </Paper>

      <Box sx={{ width: "100%", maxWidth: 1100, mx: "auto" }}>
        <Grid container spacing={2} alignItems="stretch">
          <Grid item xs={12} md={4} sx={{ display: "flex" }}>
            <ConfigCard
              href="/dues-config"
              title="Dues Config"
              description="Configure regular vs neophyte dues and instalment schedules."
              icon={<PaymentsIcon />}
            />
          </Grid>

          <Grid item xs={12} md={4} sx={{ display: "flex" }}>
            <ConfigCard
              href="/revenue-config"
              title="Revenue Config"
              description="Manage revenue categories."
              icon={<TrendingUpIcon />}
            />
          </Grid>

          <Grid item xs={12} md={4} sx={{ display: "flex" }}>
            <ConfigCard
              href="/expenses-config"
              title="Expenses Config"
              description="Manage expense categories."
              icon={<ReceiptLongIcon />}
            />
          </Grid>

          <Grid item xs={12} md={4} sx={{ display: "flex" }}>
            <ConfigCard
              href="/chapter-bonus-config"
              title="Chapter Bonus Config"
              description="Configure violation penalties and stacking tiers."
              icon={<GavelIcon />}
            />
          </Grid>

          {isAdmin ? (
            <Grid item xs={12} md={4} sx={{ display: "flex" }}>
              <ConfigCard
                href="/role-permissions"
                title="Role Permissions"
                description="Configure which permissions each office role grants."
                icon={<AdminPanelSettingsOutlinedIcon />}
              />
            </Grid>
          ) : null}

          {isAdmin ? (
            <Grid item xs={12} md={4} sx={{ display: "flex" }}>
              <ConfigCard
                href="/offices"
                title="Offices"
                description="Add/remove offices used by Brothers and permissions."
                icon={<BusinessOutlinedIcon />}
              />
            </Grid>
          ) : null}

          {isAdmin ? (
            <Grid item xs={12} md={4} sx={{ display: "flex" }}>
              <ConfigCard
                href="/users"
                title="User Settings"
                description="Invite accounts, view effective permissions, and enable/disable users."
                icon={<SettingsIcon />}
              />
            </Grid>
          ) : null}
        </Grid>
      </Box>
    </Stack>
  );
}


