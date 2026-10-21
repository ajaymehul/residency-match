/**
 * Interview tracking data model and localStorage persistence.
 *
 * Records are keyed by `${specialty}|${guid}` (the Residency Explorer program
 * GUID), not by the app's positional program id, so saved interviews,
 * ratings, and notes survive a re-scrape that reorders the data files.
 */

import type { Specialty } from './types';
import { CRITERION_IDS, isValidScore, type CriterionId, type Ratings } from './interview-criteria';
import type { EloMatch } from './elo';
import {
  defaultTimeZone,
  formatDateInZone,
  formatDateTimeInZone,
  isValidTimeZone,
  localTimeZone,
  zonedWallTimeToUtc,
} from './timezone';

export const INTERVIEW_STORAGE_KEY = 'interviews:v1';

export type InterviewStatus = 'scheduled' | 'completed';
export type InterviewFormat = '' | 'virtual' | 'in-person';

export interface InterviewRecord {
  key: string;
  /** Snapshot so the record stays readable even if the program can't be matched. */
  name: string;
  specialty: Specialty;
  city: string;
  state: string;
  status: InterviewStatus;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM (24h), wall-clock in `timeZone`. */
  time: string;
  /** IANA zone the date/time were entered in (defaults to the program's local zone). */
  timeZone: string;
  format: InterviewFormat;
  scheduleNotes: string;
  ratings: Ratings;
  criterionNotes: Partial<Record<CriterionId, string>>;
  pros: string;
  cons: string;
  overall: string;
  createdAt: number;
  updatedAt: number;
}

export interface InterviewData {
  records: Record<string, InterviewRecord>;
  matches: EloMatch[];
}

export const EMPTY_INTERVIEW_DATA: InterviewData = { records: {}, matches: [] };

export function interviewKey(specialty: Specialty, guid: string): string {
  return `${specialty}|${guid}`;
}

export function newInterviewRecord(
  input: { key: string; name: string; specialty: Specialty; city: string; state: string },
  now = Date.now(),
): InterviewRecord {
  return {
    ...input,
    status: 'scheduled',
    date: '',
    time: '',
    timeZone: defaultTimeZone(input.city, input.state),
    format: '',
    scheduleNotes: '',
    ratings: {},
    criterionNotes: {},
    pros: '',
    cons: '',
    overall: '',
    createdAt: now,
    updatedAt: now,
  };
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

function parseRecord(key: string, raw: unknown): InterviewRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const specialty = r.specialty === 'Family Medicine' || r.specialty === 'Internal Medicine' ? r.specialty : null;
  if (!specialty) return null;

  const ratings: Ratings = {};
  if (r.ratings && typeof r.ratings === 'object') {
    for (const [id, v] of Object.entries(r.ratings as Record<string, unknown>)) {
      if (CRITERION_IDS.has(id) && isValidScore(v)) ratings[id as CriterionId] = v;
    }
  }
  const criterionNotes: Partial<Record<CriterionId, string>> = {};
  if (r.criterionNotes && typeof r.criterionNotes === 'object') {
    for (const [id, v] of Object.entries(r.criterionNotes as Record<string, unknown>)) {
      if (CRITERION_IDS.has(id) && typeof v === 'string' && v) criterionNotes[id as CriterionId] = v;
    }
  }

  const city = str(r.city);
  const state = str(r.state);

  return {
    key,
    name: str(r.name),
    specialty,
    city,
    state,
    status: r.status === 'completed' ? 'completed' : 'scheduled',
    date: str(r.date),
    time: str(r.time),
    // Records saved before time zones existed were entered and shown in the
    // browser's local time, so they keep that meaning.
    timeZone: isValidTimeZone(r.timeZone) ? r.timeZone : localTimeZone(),
    format: r.format === 'virtual' || r.format === 'in-person' ? r.format : '',
    scheduleNotes: str(r.scheduleNotes),
    ratings,
    criterionNotes,
    pros: str(r.pros),
    cons: str(r.cons),
    overall: str(r.overall),
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : 0,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : 0,
  };
}

function parseMatch(raw: unknown): EloMatch | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.id !== 'string' || typeof m.winner !== 'string' || typeof m.loser !== 'string') return null;
  if (typeof m.at !== 'number') return null;
  return { id: m.id, winner: m.winner, loser: m.loser, note: str(m.note), at: m.at };
}

/** Parse stored JSON into InterviewData, dropping anything malformed. */
export function deserializeInterviewData(raw: unknown): InterviewData {
  if (!raw || typeof raw !== 'object') return { records: {}, matches: [] };
  const obj = raw as Record<string, unknown>;
  const records: Record<string, InterviewRecord> = {};
  if (obj.records && typeof obj.records === 'object') {
    for (const [key, rec] of Object.entries(obj.records as Record<string, unknown>)) {
      const parsed = parseRecord(key, rec);
      if (parsed) records[key] = parsed;
    }
  }
  const matches = Array.isArray(obj.matches)
    ? obj.matches.map(parseMatch).filter((m): m is EloMatch => m !== null)
    : [];
  return { records, matches };
}

/** Where unreadable saved data is copied before anything could overwrite it. */
export const INTERVIEW_BACKUP_KEY = `${INTERVIEW_STORAGE_KEY}:backup`;

/** Parse a raw stored string; returns null if it isn't valid JSON. */
export function parseStoredInterviewData(raw: string | null): InterviewData | null {
  if (!raw) return { records: {}, matches: [] };
  try {
    return deserializeInterviewData(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function loadInterviewData(): InterviewData {
  let stored: string | null;
  try {
    stored = localStorage.getItem(INTERVIEW_STORAGE_KEY);
  } catch {
    return { records: {}, matches: [] };
  }
  const parsed = parseStoredInterviewData(stored);
  if (parsed) return parsed;
  // Unreadable: keep a copy so a later save can't destroy it.
  try {
    localStorage.setItem(INTERVIEW_BACKUP_KEY, stored ?? '');
  } catch {
    // ignore
  }
  return { records: {}, matches: [] };
}

export function saveInterviewData(data: InterviewData): void {
  try {
    localStorage.setItem(INTERVIEW_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Private mode / quota exceeded — keep working in memory.
  }
}

/**
 * UTC instant of the interview, or null if no date is set. A date with no
 * time is placed at noon in its zone so it sorts on the right day.
 */
export function interviewUtc(rec: Pick<InterviewRecord, 'date' | 'time' | 'timeZone'>): number | null {
  if (!rec.date) return null;
  return zonedWallTimeToUtc(rec.date, rec.time || '12:00', rec.timeZone);
}

/**
 * Human-readable interview time in `displayZone`, always with the zone
 * abbreviation ("Thu, Oct 15, 6:00 AM PDT"). Date-only entries show just the
 * date, in the interview's own zone (a bare date isn't shifted across zones).
 */
export function formatInterviewWhen(
  rec: Pick<InterviewRecord, 'date' | 'time' | 'timeZone'>,
  displayZone: string,
): string {
  const utc = interviewUtc(rec);
  if (utc === null) return rec.date || '—';
  return rec.time ? formatDateTimeInZone(utc, displayZone) : formatDateInZone(utc, rec.timeZone);
}

/** Sort comparator: earliest interview first, undated last. */
export function compareByInterviewTime(
  a: Pick<InterviewRecord, 'date' | 'time' | 'timeZone' | 'name'>,
  b: Pick<InterviewRecord, 'date' | 'time' | 'timeZone' | 'name'>,
): number {
  const ta = interviewUtc(a) ?? Number.POSITIVE_INFINITY;
  const tb = interviewUtc(b) ?? Number.POSITIVE_INFINITY;
  return ta === tb ? a.name.localeCompare(b.name) : ta - tb;
}
