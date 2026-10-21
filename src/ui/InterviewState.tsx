/**
 * Interview-tracking state: interview records, criteria ratings, Elo match
 * history, interview-mode toggle, and the derived (cross-specialty) rank list.
 *
 * Must be rendered inside AppStateProvider (it reads the loaded programs to
 * resolve record keys back to programs). Persists to localStorage.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAppState } from './AppState';
import type { ScoredProgram } from '../core/types';
import type { EnrichedProgram } from '../core/scraped-data-loader';
import { isRatingComplete, ratedCount, scoreTotal } from '../core/interview-criteria';
import { computeStandings, type EloMatch, type EloStanding } from '../core/elo';
import {
  compareByInterviewTime,
  INTERVIEW_STORAGE_KEY,
  interviewKey,
  loadInterviewData,
  parseStoredInterviewData,
  newInterviewRecord,
  saveInterviewData,
  type InterviewData,
  type InterviewRecord,
} from '../core/interview-store';

const MODE_KEY = 'interviewMode:v1';

export interface RankEntry {
  key: string;
  record: InterviewRecord;
  program: ScoredProgram | null;
  standing: EloStanding;
  total: number;
  rated: number;
  complete: boolean;
}

export type RecordPatch = Partial<Omit<InterviewRecord, 'key' | 'createdAt' | 'updatedAt'>>;

export interface InterviewActions {
  addInterview: (program: ScoredProgram) => void;
  removeInterview: (key: string) => void;
  updateRecord: (key: string, patch: RecordPatch) => void;
  recordMatch: (winner: string, loser: string, note: string) => void;
  undoLastMatch: () => void;
  deleteMatch: (id: string) => void;
  resetMatches: () => void;
}

export interface InterviewStateValue {
  interviewMode: boolean;
  setInterviewMode: (on: boolean) => void;
  compareOpen: boolean;
  setCompareOpen: (open: boolean) => void;
  data: InterviewData;
  /** Resolve the record key for a program (null if it has no GUID). */
  keyForProgram: (program: ScoredProgram) => string;
  programForKey: ReadonlyMap<string, ScoredProgram>;
  /** Every interview, ranked: fully rated first (by Elo), then pending. */
  entries: RankEntry[];
  /** Fully rated programs sorted by Elo — the rank order list. */
  ranked: RankEntry[];
  /** Interviews whose 15 criteria aren't all rated yet. */
  pending: RankEntry[];
  actions: InterviewActions;
}

const InterviewContext = createContext<InterviewStateValue | null>(null);

function keyOf(program: ScoredProgram): string {
  const guid = (program as unknown as EnrichedProgram).scraped?.guid;
  return guid ? interviewKey(program.specialty, guid) : program.id;
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function InterviewProvider({ children }: { children: ReactNode }) {
  const { derived } = useAppState();

  const [data, setData] = useState<InterviewData>(loadInterviewData);
  /** JSON of the data last read from or written to storage. */
  const lastSynced = useRef<string | null>(null);
  const [interviewMode, setInterviewModeState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MODE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [compareOpen, setCompareOpen] = useState(false);

  // Persist to localStorage, but only when the data actually changed since it
  // was loaded or last synced. Mounting, remounting, or re-running effects
  // (e.g. dev hot reload) never writes, so a tab holding stale data can't
  // overwrite newer data saved by another tab.
  useEffect(() => {
    const json = JSON.stringify(data);
    if (lastSynced.current === null) {
      lastSynced.current = json;
      return;
    }
    if (json === lastSynced.current) return;
    lastSynced.current = json;
    saveInterviewData(data);
  }, [data]);

  // Keep open tabs in sync: adopt changes saved by another tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== INTERVIEW_STORAGE_KEY) return;
      const next = parseStoredInterviewData(e.newValue);
      if (!next) return; // unreadable — keep what we have
      lastSynced.current = JSON.stringify(next);
      setData(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setInterviewMode = useCallback((on: boolean) => {
    setInterviewModeState(on);
    try {
      localStorage.setItem(MODE_KEY, on ? '1' : '0');
    } catch {
      // ignore
    }
  }, []);

  const programForKey = useMemo(() => {
    const map = new Map<string, ScoredProgram>();
    for (const p of derived.scoredPrograms) map.set(keyOf(p), p);
    return map;
  }, [derived.scoredPrograms]);

  const { entries, ranked, pending } = useMemo(() => {
    const records = Object.values(data.records);
    const standings = computeStandings(records.map((r) => r.key), data.matches);

    const all: RankEntry[] = records.map((r) => ({
      key: r.key,
      record: r,
      program: programForKey.get(r.key) ?? null,
      standing: standings.get(r.key)!,
      total: scoreTotal(r.ratings),
      rated: ratedCount(r.ratings),
      complete: isRatingComplete(r.ratings),
    }));
    // Elo only; ties (e.g. before any comparisons) fall back to name.
    const byElo = (a: RankEntry, b: RankEntry) =>
      b.standing.elo - a.standing.elo || a.record.name.localeCompare(b.record.name);
    const rankedList = all.filter((e) => e.complete).sort(byElo);
    const pendingList = all
      .filter((e) => !e.complete)
      .sort((a, b) => compareByInterviewTime(a.record, b.record));
    return { entries: [...rankedList, ...pendingList], ranked: rankedList, pending: pendingList };
  }, [data, programForKey]);

  const addInterview = useCallback((program: ScoredProgram) => {
    const key = keyOf(program);
    setData((prev) => {
      if (prev.records[key]) return prev;
      const rec = newInterviewRecord({
        key,
        name: program.name,
        specialty: program.specialty,
        city: program.city,
        state: program.state,
      });
      return { ...prev, records: { ...prev.records, [key]: rec } };
    });
  }, []);

  const removeInterview = useCallback((key: string) => {
    setData((prev) => {
      if (!prev.records[key]) return prev;
      const { [key]: _removed, ...rest } = prev.records;
      return {
        records: rest,
        matches: prev.matches.filter((m) => m.winner !== key && m.loser !== key),
      };
    });
  }, []);

  const updateRecord = useCallback((key: string, patch: RecordPatch) => {
    setData((prev) => {
      const rec = prev.records[key];
      if (!rec) return prev;
      return {
        ...prev,
        records: { ...prev.records, [key]: { ...rec, ...patch, updatedAt: Date.now() } },
      };
    });
  }, []);

  const recordMatch = useCallback((winner: string, loser: string, note: string) => {
    const match: EloMatch = { id: newId(), winner, loser, note: note.trim(), at: Date.now() };
    setData((prev) => ({ ...prev, matches: [...prev.matches, match] }));
  }, []);

  const undoLastMatch = useCallback(() => {
    setData((prev) => (prev.matches.length ? { ...prev, matches: prev.matches.slice(0, -1) } : prev));
  }, []);

  const deleteMatch = useCallback((id: string) => {
    setData((prev) => ({ ...prev, matches: prev.matches.filter((m) => m.id !== id) }));
  }, []);

  const resetMatches = useCallback(() => {
    setData((prev) => ({ ...prev, matches: [] }));
  }, []);

  const actions = useMemo<InterviewActions>(
    () => ({ addInterview, removeInterview, updateRecord, recordMatch, undoLastMatch, deleteMatch, resetMatches }),
    [addInterview, removeInterview, updateRecord, recordMatch, undoLastMatch, deleteMatch, resetMatches],
  );

  const value = useMemo<InterviewStateValue>(
    () => ({
      interviewMode,
      setInterviewMode,
      compareOpen,
      setCompareOpen,
      data,
      keyForProgram: keyOf,
      programForKey,
      entries,
      ranked,
      pending,
      actions,
    }),
    [interviewMode, setInterviewMode, compareOpen, data, programForKey, entries, ranked, pending, actions],
  );

  return <InterviewContext.Provider value={value}>{children}</InterviewContext.Provider>;
}

export function useInterviews(): InterviewStateValue {
  const ctx = useContext(InterviewContext);
  if (!ctx) throw new Error('useInterviews must be used within an InterviewProvider');
  return ctx;
}
