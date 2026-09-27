import * as React from "react";
import { Button, Snackbar } from "@mui/material";
import IosShareIcon from "@mui/icons-material/IosShare";
import dayjs from "dayjs";
import type { IShiftEvent, IShiftPartyDuty, IShiftPartySlot } from "../../interfaces/api.interface";
import { formatSlotRange, formatTimeRange } from "../../utils/partyTime";

type Props = {
  shift: IShiftEvent;
  duties: IShiftPartyDuty[];
  slots: IShiftPartySlot[];
  slotStarts: string[];
  /** Match whichever way round the page is showing the grid. */
  dutyRows: boolean;
};

const INK = "#101b2d";
const MUTED = "rgba(16,27,45,0.62)";
const FAINT = "rgba(16,27,45,0.38)";
const RULE = "1px solid rgba(16,27,45,0.09)";

/** First name plus last initial: narrow enough for a phone, still unambiguous. */
function shortName(slot: IShiftPartySlot | undefined): string {
  if (!slot?.brother_id) return "—";
  const first = slot.first_name ?? "";
  const lastInitial = slot.last_name ? `${slot.last_name[0]}.` : "";
  return [first, lastInitial].filter(Boolean).join(" ") || "Assigned";
}

/**
 * Exports the timetable as a small PNG for the group chat — a card built for
 * the purpose rather than a screenshot of the page, so it stays readable on a
 * phone. Uses the share sheet where there is one, otherwise downloads.
 */
export default function PartyTimetableShare({ shift, duties, slots, slotStarts, dutyRows }: Props) {
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  const slotFor = React.useCallback(
    (dutyId: number, slotStart: string) =>
      slots.find((s) => s.duty_id === dutyId && s.slot_start === slotStart),
    [slots]
  );

  async function handleExport() {
    const node = cardRef.current;
    if (!node || busy) return;
    setBusy(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff", logging: false });
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png")
      );
      if (!blob) {
        setToast("Could not build the image.");
        return;
      }

      const fileName = `party-${dayjs(shift.event_date).format("YYYY-MM-DD")}.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: "Party timetable" });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      setToast("Timetable image saved.");
    } catch {
      setToast("Could not build the image.");
    } finally {
      setBusy(false);
    }
  }

  const headline = [dayjs(shift.event_date).format("ddd, MMM D"), shift.title]
    .filter(Boolean)
    .join(" · ");
  const hours =
    shift.party_start_time && shift.party_end_time
      ? formatTimeRange(shift.party_start_time, shift.party_end_time)
      : "";

  const rowKeys: Array<string | number> = dutyRows ? duties.map((d) => d.id) : slotStarts;
  const colKeys: Array<string | number> = dutyRows ? slotStarts : duties.map((d) => d.id);
  const cornerLabel = dutyRows ? "Duty" : "Time";
  const labelFor = (key: string | number, isRow: boolean) =>
    (dutyRows ? isRow : !isRow)
      ? (duties.find((d) => d.id === key)?.name ?? "")
      : formatSlotRange(String(key));

  // A wide grid still has to fit a phone screen, so the card grows with the
  // number of columns rather than squeezing them.
  // Hour ranges are wider than a single time, so columns need the room.
  const colWidth = dutyRows ? 150 : 120;
  const width = Math.min(1180, Math.max(640, 170 + colKeys.length * colWidth));

  const headCell: React.CSSProperties = {
    textAlign: "left",
    padding: "8px 10px",
    borderBottom: `2px solid ${INK}`,
    fontSize: 11.5,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: MUTED,
    whiteSpace: "nowrap",
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<IosShareIcon />}
        onClick={handleExport}
        disabled={busy || duties.length === 0 || slotStarts.length === 0}
      >
        {busy ? "Building…" : "Export image"}
      </Button>

      {/* Off-screen so html2canvas can measure it at full size. Fixed light
          palette: the card lands in a chat, not in the app's theme. */}
      <div aria-hidden style={{ position: "fixed", left: "-10000px", top: 0, pointerEvents: "none" }}>
        <div
          ref={cardRef}
          style={{
            width,
            padding: "26px 28px 22px",
            background: "#ffffff",
            color: INK,
            fontFamily:
              'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>
              Party Timetable
            </div>
            <div style={{ fontSize: 14, color: MUTED }}>{hours}</div>
          </div>
          <div style={{ fontSize: 15, color: MUTED, marginTop: 4 }}>{headline}</div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 18, fontSize: 14 }}>
            <thead>
              <tr>
                <th style={headCell}>{cornerLabel}</th>
                {colKeys.map((col) => (
                  <th key={String(col)} style={headCell}>
                    {labelFor(col, false)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowKeys.map((row, i) => (
                <tr key={String(row)} style={{ background: i % 2 ? "#f5f7fb" : "#ffffff" }}>
                  <td
                    style={{
                      padding: "9px 10px",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      borderBottom: RULE,
                    }}
                  >
                    {labelFor(row, true)}
                  </td>
                  {colKeys.map((col) => {
                    const dutyId = (dutyRows ? row : col) as number;
                    const slotStart = String(dutyRows ? col : row);
                    const slot = slotFor(dutyId, slotStart);
                    const assigned = Boolean(slot?.brother_id);
                    return (
                      <td
                        key={String(col)}
                        style={{
                          padding: "9px 10px",
                          borderBottom: RULE,
                          whiteSpace: "nowrap",
                          color: assigned ? INK : FAINT,
                        }}
                      >
                        {shortName(slot)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 16, fontSize: 12, color: "rgba(16,27,45,0.45)" }}>
            Phi Kappa Sigma · Alpha Beta
          </div>
        </div>
      </div>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
      />
    </>
  );
}
