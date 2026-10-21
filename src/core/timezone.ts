/**
 * Time-zone helpers for interview scheduling, built on Intl (no dependency).
 *
 * An interview time is entered as a wall-clock date + time in a chosen IANA
 * time zone (the zone the program gave it in). It is converted to a UTC
 * instant for sorting and for display in the viewer's local zone. Every
 * formatted time carries a zone abbreviation (EDT, CST, PDT...) so it's never
 * ambiguous.
 */

export interface TimeZoneOption {
  id: string;
  label: string;
}

/** US zones (plus Puerto Rico) offered in the picker, in east→west order. */
export const US_TIME_ZONES: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'America/Puerto_Rico', label: 'Atlantic – Puerto Rico' },
  { id: 'America/New_York', label: 'Eastern' },
  { id: 'America/Chicago', label: 'Central' },
  { id: 'America/Denver', label: 'Mountain' },
  { id: 'America/Phoenix', label: 'Mountain – Arizona (no DST)' },
  { id: 'America/Los_Angeles', label: 'Pacific' },
  { id: 'America/Anchorage', label: 'Alaska' },
  { id: 'Pacific/Honolulu', label: 'Hawaii' },
];

const E = 'America/New_York';
const C = 'America/Chicago';
const M = 'America/Denver';
const P = 'America/Los_Angeles';

/** Dominant zone per state. Split states use the zone most programs are in. */
const STATE_ZONES: Record<string, string> = {
  CT: E, DE: E, DC: E, FL: E, GA: E, IN: E, KY: E, ME: E, MD: E, MA: E, MI: E,
  NH: E, NJ: E, NY: E, NC: E, OH: E, PA: E, RI: E, SC: E, VT: E, VA: E, WV: E,
  AL: C, AR: C, IL: C, IA: C, KS: C, LA: C, MN: C, MS: C, MO: C, NE: C, ND: C,
  OK: C, SD: C, TN: C, TX: C, WI: C,
  CO: M, ID: M, MT: M, NM: M, UT: M, WY: M,
  AZ: 'America/Phoenix',
  CA: P, NV: P, OR: P, WA: P,
  AK: 'America/Anchorage',
  HI: 'Pacific/Honolulu',
  PR: 'America/Puerto_Rico',
  VI: 'America/Puerto_Rico',
  GU: 'Pacific/Guam',
};

/** Cities in split states whose zone differs from the state default. */
const CITY_ZONES: Record<string, string> = {
  'el paso|TX': M,
  'knoxville|TN': E,
  'chattanooga|TN': E,
  'johnson city|TN': E,
  'kingsport|TN': E,
  'bristol|TN': E,
  'pensacola|FL': C,
  'panama city|FL': C,
  "coeur d'alene|ID": P,
  'gary|IN': C,
  'evansville|IN': C,
  'paducah|KY': C,
  'bowling green|KY': C,
  'garden city|KS': C,
};

/** The viewer's own IANA time zone (falls back to UTC). */
export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const validCache = new Map<string, boolean>();
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false;
  const cached = validCache.get(tz);
  if (cached !== undefined) return cached;
  let ok = true;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    ok = false;
  }
  validCache.set(tz, ok);
  return ok;
}

/** Best-guess zone for a program location; null if the state is unknown. */
export function timeZoneForLocation(city: string, state: string): string | null {
  const st = state.trim().toUpperCase();
  return CITY_ZONES[`${city.trim().toLowerCase()}|${st}`] ?? STATE_ZONES[st] ?? null;
}

/** Zone to default a new interview to: the program's local zone, else the viewer's. */
export function defaultTimeZone(city: string, state: string): string {
  return timeZoneForLocation(city, state) ?? localTimeZone();
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatter(key: string, make: () => Intl.DateTimeFormat): Intl.DateTimeFormat {
  let f = fmtCache.get(key);
  if (!f) {
    f = make();
    fmtCache.set(key, f);
  }
  return f;
}

/** UTC offset of `tz` at instant `ts`, in ms (e.g. EDT → −4h). */
function offsetMs(tz: string, ts: number): number {
  const f = formatter(`parts|${tz}`, () =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  );
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(new Date(ts))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return asUtc - Math.floor(ts / 1000) * 1000;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

/**
 * Convert a wall-clock date (YYYY-MM-DD) + time (HH:MM) in `tz` to a UTC
 * epoch-ms instant. Returns null for malformed input or an invalid zone.
 */
export function zonedWallTimeToUtc(date: string, time: string, tz: string): number | null {
  const d = DATE_RE.exec(date);
  const t = TIME_RE.exec(time);
  if (!d || !t || !isValidTimeZone(tz)) return null;
  const guess = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  // Two passes handle the offset changing between the guess and the answer (DST).
  const first = guess - offsetMs(tz, guess);
  return guess - offsetMs(tz, first);
}

/** Short zone abbreviation at an instant, e.g. "EDT", "PST" ("GMT+5:30" outside the US). */
export function tzAbbreviation(ts: number, tz: string): string {
  const f = formatter(`abbr|${tz}`, () => new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }));
  return f.formatToParts(new Date(ts)).find((p) => p.type === 'timeZoneName')?.value ?? tz;
}

/** "Thu, Oct 15, 9:00 AM EDT" — always includes the zone abbreviation. */
export function formatDateTimeInZone(ts: number, tz: string): string {
  return formatter(`dt|${tz}`, () =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }),
  ).format(new Date(ts));
}

/** "9:00 AM EDT". */
export function formatTimeInZone(ts: number, tz: string): string {
  return formatter(`t|${tz}`, () =>
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }),
  ).format(new Date(ts));
}

/** "Thu, Oct 15" — for a date with no time. */
export function formatDateInZone(ts: number, tz: string): string {
  return formatter(`d|${tz}`, () =>
    new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }),
  ).format(new Date(ts));
}

/**
 * Picker options: the US zones, plus the viewer's zone and the currently
 * selected one if they aren't already listed. Labels show the abbreviation
 * in effect `now` and mark the viewer's own zone.
 */
export function timeZoneOptions(current?: string, now = Date.now()): TimeZoneOption[] {
  const local = localTimeZone();
  const mark = (id: string) => (id === local ? ' — your time zone' : '');
  const list: TimeZoneOption[] = US_TIME_ZONES.map((z) => ({
    id: z.id,
    label: `${z.label} (${tzAbbreviation(now, z.id)})${mark(z.id)}`,
  }));
  const ids = new Set(list.map((o) => o.id));
  for (const extra of [local, current]) {
    if (extra && !ids.has(extra) && isValidTimeZone(extra)) {
      list.push({ id: extra, label: `${extra.replace(/_/g, ' ')} (${tzAbbreviation(now, extra)})${mark(extra)}` });
      ids.add(extra);
    }
  }
  return list;
}
