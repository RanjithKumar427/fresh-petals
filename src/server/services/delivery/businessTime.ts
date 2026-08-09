// Timezone-safe "what time is it for FreshPetals' business day" helpers —
// Delivery Capability Engine milestone. FreshPetals operates in India;
// nothing in this codebase configures a different business timezone, so
// this hardcodes Asia/Kolkata rather than depending on the server/
// Vercel/developer-machine timezone (which `new Date().getHours()` etc.
// would silently do). No new dependency: `Intl.DateTimeFormat` with an
// explicit `timeZone` is sufficient and is standard in every runtime this
// project targets (Node 22+, Vercel's Node runtime) — a library like
// date-fns-tz/luxon would just be net-new complexity for a single-timezone
// business with no DST to worry about (India has none).
//
// Every function takes an optional `reference: Date` (defaulting to
// `new Date()`) rather than reading the clock internally — this is what
// makes the cutoff logic in DeliveryService actually testable at specific
// times (09:00, 17:59, 23:59, ...) without the test depending on when it
// happens to run. `Date` itself is always a UTC instant; only the
// *formatting* below is timezone-aware.
const BUSINESS_TIMEZONE = "Asia/Kolkata";

export type BusinessNow = {
  /** YYYY-MM-DD in the business timezone — comparable directly against a `type="date"` input's value. */
  isoDate: string;
  hour: number;
  minute: number;
  /** 0-1439, minutes since local midnight — the single number every cutoff check compares against. */
  minuteOfDay: number;
};

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Resolves a UTC instant to its wall-clock date/time in the business timezone. */
export function getBusinessNow(reference: Date = new Date()): BusinessNow {
  const parts = Object.fromEntries(partsFormatter.formatToParts(reference).map((p) => [p.type, p.value]));
  // Intl's 24-hour "hour" can format midnight as "24" depending on runtime
  // (a documented, real ICU inconsistency) — normalize it to 0 so
  // minuteOfDay stays in the expected 0-1439 range instead of overflowing
  // to 1440 for the one instant this would otherwise bite.
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);

  return {
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
    hour,
    minute,
    minuteOfDay: hour * 60 + minute,
  };
}

/** Whether `dateStr` (a `type="date"` input value, "YYYY-MM-DD") is "today" in the business timezone. */
export function isBusinessToday(dateStr: string, reference: Date = new Date()): boolean {
  return dateStr === getBusinessNow(reference).isoDate;
}

/** "HH:MM" minute-of-day back to a human string, for building promise text (e.g. "07:00"). */
export function formatMinuteOfDay(minuteOfDay: number): string {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
