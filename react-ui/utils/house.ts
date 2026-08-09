import { alpha } from "@mui/material/styles";
import {
  HouseDepositStatus,
  HouseOccupancy,
  HouseSessionType,
  IHouseDeposit,
} from "../interfaces/api.interface";

export type TintColor = "success" | "warning" | "info" | "error";

// Row shading as a translucent wash rather than a solid fill: it reads in both
// light and dark themes, keeps text contrast, and leaves hover visible.
export function tintSx(color: TintColor | null) {
  if (!color) return undefined;
  return {
    backgroundColor: (t: any) => alpha(t.palette[color].main, 0.12),
    "&:hover": {
      backgroundColor: (t: any) => alpha(t.palette[color].main, 0.22),
    },
  };
}

// The matching swatch for a legend entry.
export function tintSwatchSx(color: TintColor) {
  return {
    width: 12,
    height: 12,
    borderRadius: 0.5,
    border: "1px solid",
    borderColor: (t: any) => alpha(t.palette[color].main, 0.5),
    backgroundColor: (t: any) => alpha(t.palette[color].main, 0.22),
  };
}

// Derived, never stored. `year` is the September start year:
// 2026 => "Winter 2026-27" / "Summer 2027".
export function sessionLabel(year: number, sessionType: HouseSessionType): string {
  return sessionType === "winter"
    ? `Winter ${year}-${String(year + 1).slice(2)}`
    : `Summer ${year + 1}`;
}

// "1st", "2nd", "3rd", "4th" — derived from seq, never stored.
export function instalmentLabel(seq: number): string {
  const tens = seq % 100;
  if (tens >= 11 && tens <= 13) return `${seq}th`;
  const suffix: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
  return `${seq}${suffix[seq % 10] ?? "th"}`;
}

// Rooms have one rate per term; capacity is what distinguishes them.
export function roomTypeLabel(capacity: number): string {
  return capacity > 1 ? "Double" : "Single";
}

// A buy-out takes the whole room, so it costs the per-person rate times capacity.
export function rateForOccupancy(
  ratePerPerson: number | null,
  capacity: number,
  occupancy: HouseOccupancy
): number | null {
  if (ratePerPerson == null) return null;
  return occupancy === "full_room" ? ratePerPerson * Math.max(capacity, 1) : ratePerPerson;
}

export const DEPOSIT_STATUSES: HouseDepositStatus[] = ["outstanding", "received", "refunded"];

const DEPOSIT_STATUS_LABELS: Record<HouseDepositStatus, string> = {
  outstanding: "Outstanding",
  received: "Received",
  refunded: "Refunded",
};

export function depositStatusLabel(status: HouseDepositStatus): string {
  return DEPOSIT_STATUS_LABELS[status] ?? status;
}

export function deductionsTotal(deductions: { amount: number }[] | undefined): number {
  return (deductions ?? []).reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
}

// What the resident actually gets back once damages are withheld.
export function netRefund(deposit: Pick<IHouseDeposit, "amount" | "deductions">): number {
  return Math.max(Number(deposit.amount) - deductionsTotal(deposit.deductions), 0);
}

// Small outlined annotation chip — "Boarder", "Buy-out". Sized to sit inside a
// table row without competing with the text it labels.
export const SUBTLE_CHIP_SX = {
  height: 16,
  fontSize: "0.65rem",
  borderColor: "divider",
  color: "text.secondary",
  "& .MuiChip-label": { px: 0.6, lineHeight: 1 },
} as const;
