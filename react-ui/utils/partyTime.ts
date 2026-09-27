/** Party shifts run past midnight, so slot times are stored as hours from the
 *  party's own start of day: "25:00" is 1am the next morning. That is a fine
 *  way to store it and a terrible way to type it, so these helpers convert
 *  between the stored form and ordinary clock times. */

const HHMM = /^(\d{1,2}):(\d{2})$/;

function parts(value: string): { hours: number; minutes: number } | null {
  const m = HHMM.exec(String(value ?? "").trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) return null;
  return { hours, minutes };
}

/** "25:00" -> "01:00". What a <input type="time"> can actually show. */
export function toClockTime(value: string | null | undefined): string {
  const p = parts(value ?? "");
  if (!p) return "";
  const hours = p.hours % 24;
  return `${String(hours).padStart(2, "0")}:${String(p.minutes).padStart(2, "0")}`;
}

/** True when the stored value already rolled past midnight ("24:00" and up). */
export function isNextDay(value: string | null | undefined): boolean {
  const p = parts(value ?? "");
  return p ? p.hours >= 24 : false;
}

/** True when an end time lands on the following day, which is the normal case
 *  for a party: it starts at 8pm and ends at 2am. */
export function endsNextDay(start: string, end: string): boolean {
  const s = parts(start);
  const e = parts(end);
  if (!s || !e) return false;
  if (e.hours >= 24) return true;
  return e.hours * 60 + e.minutes <= s.hours * 60 + s.minutes;
}

/** 25:00 -> "1:00 AM". Hours past midnight wrap, since AM after PM already
 *  reads as the small hours. */
export function formatClock12(value: string | null | undefined): string {
  const p = parts(value ?? "");
  if (!p) return String(value ?? "");
  return twelveHour(p.hours, p.minutes);
}

/** Slots are an hour long, and a duty roster reads better as the hour it
 *  covers than as the moment it starts: "9:00 PM – 10:00 PM". */
export function formatSlotRange(value: string, stepMinutes = 60): string {
  const p = parts(value);
  if (!p) return String(value ?? "");
  const startMins = p.hours * 60 + p.minutes;
  const endMins = startMins + stepMinutes;
  return `${twelveHour(p.hours, p.minutes)} – ${twelveHour(
    Math.floor(endMins / 60),
    endMins % 60
  )}`;
}

function twelveHour(hours: number, minutes: number): string {
  const hour = ((hours % 24) + 24) % 24;
  const suffix = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** "20:00" to "02:00" reads as "8:00 PM – 2:00 AM (next day)". */
export function formatTimeRange(start: string, end: string): string {
  const s = parts(start);
  const e = parts(end);
  if (!s || !e) return "";
  const range = `${twelveHour(s.hours, s.minutes)} – ${twelveHour(e.hours, e.minutes)}`;
  return endsNextDay(start, end) ? `${range} (next day)` : range;
}

/** The slot starts a party covers, mirroring the API's own generator so the UI
 *  can tell the user which rows a narrower window would clear. Hours past
 *  midnight keep counting up: 8pm-2am is 20:00 through 25:00. */
export function generateSlotStarts(start: string, end: string): string[] {
  const s = parts(start);
  const e = parts(end);
  if (!s || !e) return [];
  const startMins = s.hours * 60 + s.minutes;
  let endMins = e.hours * 60 + e.minutes;
  if (endMins <= startMins) endMins += 24 * 60;
  const out: string[] = [];
  for (let t = startMins; t < endMins; t += 60) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return out;
}
