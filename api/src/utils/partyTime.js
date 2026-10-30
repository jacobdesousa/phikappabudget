// Party slot times, server side.
//
// Slots are stored as hours from the party's own start of day, so "25:00" is
// 1am the next morning. The page has had this for a while
// (react-ui/utils/partyTime.ts); the feed needs it too, because an email and a
// notification have to read identically and the server is the only place both
// of them pass through.

const HHMM = /^(\d{1,2}):(\d{2})$/;

function parts(value) {
  const m = HHMM.exec(String(value ?? "").trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) return null;
  return { hours, minutes };
}

function twelveHour(hours, minutes) {
  const hour = ((hours % 24) + 24) % 24;
  const suffix = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** "21:00" -> "9:00 PM – 10:00 PM". Slots are an hour long. */
function formatSlotRange(value, stepMinutes = 60) {
  const p = parts(value);
  if (!p) return String(value ?? "");
  const startMins = p.hours * 60 + p.minutes;
  const endMins = startMins + stepMinutes;
  return `${twelveHour(p.hours, p.minutes)} – ${twelveHour(
    Math.floor(endMins / 60),
    endMins % 60
  )}`;
}

/** "20:00" to "02:00" reads as "8:00 PM – 2:00 AM". */
function formatTimeRange(start, end) {
  const s = parts(start);
  const e = parts(end);
  if (!s || !e) return "";
  return `${twelveHour(s.hours, s.minutes)} – ${twelveHour(e.hours, e.minutes)}`;
}

module.exports = { formatSlotRange, formatTimeRange };
