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
  /** HH:MM (24h) */
  time: string;
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

  return {
    key,
    name: str(r.name),
    specialty,
    city: str(r.city),
    state: str(r.state),
    status: r.status === 'completed' ? 'completed' : 'scheduled',
    date: str(r.date),
    time: str(r.time),
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

export function loadInterviewData(): InterviewData {
  try {
    const stored = localStorage.getItem(INTERVIEW_STORAGE_KEY);
    return stored ? deserializeInterviewData(JSON.parse(stored)) : { records: {}, matches: [] };
  } catch {
    return { records: {}, matches: [] };
  }
}

export function saveInterviewData(data: InterviewData): void {
  try {
    localStorage.setItem(INTERVIEW_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Private mode / quota exceeded — keep working in memory.
  }
}
