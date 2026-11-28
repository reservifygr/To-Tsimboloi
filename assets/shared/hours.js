// Opening hours + pickup-slot logic.
//
// IMPORTANT: hours are NOT verified. Third-party listing (Athinorama, retrieved 2026-11-02) says:
//   Wed-Fri from 17:00, Sat from 13:00, Sun 13:00-19:00; Mon/Tue not listed; closing times unknown.
// Until the owner confirms, `verified` is false and ordering falls back to a manual pickup-time request.
// The slot generator below is fully functional and tested against a fixture so it can be switched on
// the day the owner confirms hours (set verified:true and fill `closes`).

export const HOURS = {
  verified: false,
  source: 'Athinorama listing (third-party), 2026-11-02 - NEEDS OWNER VERIFICATION',
  timezone: 'Europe/Athens',
  // weekday 0=Sun..6=Sat -> [openHour, openMin, closeHour, closeMin] | null (closed). closes are unknown (null) for now.
  weekly: {
    0: { opens: [13, 0], closes: [19, 0] },
    1: null,
    2: null,
    3: { opens: [17, 0], closes: null },
    4: { opens: [17, 0], closes: null },
    5: { opens: [17, 0], closes: null },
    6: { opens: [13, 0], closes: null },
  },
};

export const SLOT_MINUTES = 15;

/** Convert an instant to Athens wall-clock parts (handles DST via Intl). */
export function athensParts(date, tz = 'Europe/Athens') {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday];
  return { weekday: wd, y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute };
}

/**
 * Decide how a customer may choose pickup time right now.
 * - hours unverified            -> {mode:'manual', reason:'hours_unverified'}
 * - verified but closed / no end -> {mode:'manual', reason:'closed' | 'no_closing_time'}
 * - verified and open            -> {mode:'slots', slots:[ISO...]}
 * @param {Date} now
 * @param {{prepMinutes:number, paused:boolean}} settings
 * @param {typeof HOURS} [hours]
 */
export function pickupMode(now, settings, hours = HOURS) {
  if (settings.paused) return { mode: 'paused', reason: 'paused' };
  if (!hours.verified) return { mode: 'manual', reason: 'hours_unverified' };
  const t = athensParts(now, hours.timezone);
  const today = hours.weekly[t.weekday];
  if (!today) return { mode: 'manual', reason: 'closed' };
  if (!today.closes) return { mode: 'manual', reason: 'no_closing_time' };
  const nowMin = t.h * 60 + t.min;
  const openMin = today.opens[0] * 60 + today.opens[1];
  const closeMin = today.closes[0] * 60 + today.closes[1];
  const earliest = Math.max(openMin, nowMin + settings.prepMinutes);
  const first = Math.ceil(earliest / SLOT_MINUTES) * SLOT_MINUTES;
  const lastSlot = closeMin - 15; // last pickup 15 min before closing
  if (first > lastSlot) return { mode: 'manual', reason: 'closed' };
  const slots = [];
  for (let m = first; m <= lastSlot; m += SLOT_MINUTES) {
    // Build the instant by offsetting from `now` (minute arithmetic; Athens DST changes do not occur mid-service).
    slots.push(new Date(now.getTime() + (m - nowMin) * 60000 - now.getSeconds() * 1000 - now.getMilliseconds()).toISOString());
  }
  return { mode: 'slots', slots };
}
