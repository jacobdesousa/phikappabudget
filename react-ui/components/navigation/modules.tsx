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
import CleaningServicesOutlinedIcon from "@mui/icons-material/CleaningServicesOutlined";
import CelebrationIcon from "@mui/icons-material/Celebration";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import AssignmentLateIcon from "@mui/icons-material/AssignmentLate";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import SettingsIcon from "@mui/icons-material/Settings";

// The one list of modules in the app. The sidebar (pages router) and the home
// page (app router) both render from this, so a new page appears in both or
// neither — they used to be separate lists and drifted.
export interface AppModule {
  href: string;
  // Shown in the sidebar, and as the card title on the home page.
  label: string;
  // Home page only; the sidebar has no room for it.
  description: string;
  icon: React.ReactNode;
  // Any one of these grants access. Empty means every signed-in user sees it.
  anyPermissions: string[];
}

export const APP_MODULES: AppModule[] = [
  {
    href: "/brothers",
    label: "Brothers",
    description: "Member roster, status, office, and contact details.",
    anyPermissions: ["brothers.read"],
    icon: <GroupsIcon />,
  },
  {
    href: "/dues",
    label: "Dues",
    description: "Payments, balances, and who's behind by school year.",
    anyPermissions: ["dues.read"],
    icon: <PaymentsIcon />,
  },
  {
    href: "/revenue",
    label: "Revenue",
    description: "Track income and payment stream breakdowns.",
    anyPermissions: ["revenue.read"],
    icon: <TrendingUpIcon />,
  },
  {
    href: "/expenses",
    label: "Expenses",
    description: "Submissions, approvals, and reimbursements.",
    anyPermissions: ["expenses.read"],
    icon: <ReceiptLongIcon />,
  },
  {
    href: "/budget",
    label: "Budget",
    description: "Budgeted vs actual spend by category across the year.",
    anyPermissions: ["budget.read"],
    icon: <AccountBalanceOutlinedIcon />,
  },
  {
    href: "/meetings",
    label: "Meetings",
    description: "Minutes with attendance and officer reports.",
    anyPermissions: ["meetings.read"],
    icon: <EventNoteIcon />,
  },
  {
    href: "/workdays",
    label: "Workdays",
    description: "Attendance that drives chapter bonus earnings.",
    anyPermissions: ["workdays.read"],
    icon: <BuildIcon />,
  },
  {
    href: "/chapter-bonus",
    label: "Chapter Bonus",
    description: "Monthly deductions + workday earnings overview.",
    anyPermissions: ["chapterBonus.read"],
    icon: <GavelIcon />,
  },
  {
    href: "/shifts/setup",
    label: "Setup Shifts",
    description: "Schedule and track chapter setup shifts.",
    anyPermissions: ["shifts.setup.read"],
    icon: <ConstructionIcon />,
  },
  {
    href: "/shifts/cleanup",
    label: "Cleanup Shifts",
    description: "Schedule and track chapter cleanup shifts.",
    anyPermissions: ["shifts.cleanup.read"],
    icon: <CleaningServicesIcon />,
  },
  {
    href: "/shifts/party",
    label: "Party Shifts",
    description: "Party timetable with duty slots and attendance.",
    anyPermissions: ["shifts.party.read"],
    icon: <CelebrationIcon />,
  },
  {
    href: "/room-draw",
    label: "Room Draw",
    description: "Points standings per bylaws for room selection.",
    anyPermissions: ["roomDraw.read"],
    icon: <MeetingRoomOutlinedIcon />,
  },
  {
    href: "/house",
    label: "House Residents",
    description: "Who lives in which bedroom, and for what dates.",
    anyPermissions: ["house.read"],
    icon: <HomeWorkOutlinedIcon />,
  },
  {
    href: "/house-instalments",
    label: "Resident Instalments",
    description: "Room fees owed, paid, and outstanding per session.",
    anyPermissions: ["house.read"],
    icon: <ApartmentOutlinedIcon />,
  },
  {
    href: "/house-account",
    label: "House Account",
    description: "Bank balance, disbursements to TSPHC and PKSAB.",
    anyPermissions: ["house.read"],
    icon: <AccountBalanceWalletOutlinedIcon />,
  },
  {
    href: "/chores",
    label: "Chores",
    description: "Who is on duty now, and the full house chore schedule.",
    anyPermissions: ["chores.read"],
    icon: <CleaningServicesOutlinedIcon />,
  },
  {
    href: "/makeups",
    label: "Makeups",
    description: "All unresolved absences requiring makeup.",
    anyPermissions: [],
    icon: <AssignmentLateIcon />,
  },
  {
    href: "/sessions",
    label: "Sessions",
    description: "Devices you're signed in on, and sign them out.",
    anyPermissions: ["admin.sessions"],
    icon: <SecurityOutlinedIcon />,
  },
  {
    href: "/config",
    label: "Config",
    description: "Dues, revenue, expenses, house, chores, users, and permissions.",
    anyPermissions: [
      "dues.config",
      "revenue.config",
      "chapterBonus.config",
      "expenses.write",
      "house.config",
      "chores.config",
    ],
    icon: <SettingsIcon />,
  },
];
