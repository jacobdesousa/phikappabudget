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

// Which session a date falls in: winter runs Sep 1 – Apr 30, summer May 1 –
// Aug 31. Mirrors sessionTypeForDate in the API's houseFees.
export function sessionTypeForDate(date: string | Date): HouseSessionType {
  const d = date instanceof Date ? date : new Date(`${date}T00:00:00`);
  const month = d.getMonth();
  return month >= 4 && month <= 7 ? "summer" : "winter";
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
export interface DateGap {
  start_date: string;
  end_date: string;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// The stretches of a session where a bed has nobody in it. A resident who
// leaves mid-session frees the bed for the remainder, and the room can be re-let
// for exactly that window — the server allows two assignments on one bed as
// long as their dates don't overlap.
//
// Assignments missing a bound are treated as running to the session edge, which
// matches how the API's rangesOverlap reads an open range.
export function bedVacancies(
  sessionStart: string | null | undefined,
  sessionEnd: string | null | undefined,
  assignments: { start_date: string | null; end_date: string | null }[]
): DateGap[] {
  if (!sessionStart || !sessionEnd) return [];

  const occupied = assignments
    .map((a) => ({
      start: a.start_date && a.start_date > sessionStart ? a.start_date : sessionStart,
      end: a.end_date && a.end_date < sessionEnd ? a.end_date : sessionEnd,
    }))
    .filter((r) => r.start <= r.end)
    .sort((a, b) => a.start.localeCompare(b.start));

  const gaps: DateGap[] = [];
  let cursor = sessionStart;

  for (const r of occupied) {
    if (r.start > cursor) gaps.push({ start_date: cursor, end_date: addDays(r.start, -1) });
    // Ranges can overlap each other (a buy-out spans every bed), so only ever
    // advance the cursor.
    if (r.end >= cursor) cursor = addDays(r.end, 1);
  }
  if (cursor <= sessionEnd) gaps.push({ start_date: cursor, end_date: sessionEnd });

  return gaps;
}

export const SUBTLE_CHIP_SX = {
  height: 16,
  fontSize: "0.65rem",
  borderColor: "divider",
  color: "text.secondary",
  "& .MuiChip-label": { px: 0.6, lineHeight: 1 },
} as const;
