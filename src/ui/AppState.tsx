/**
 * Application state context and memoized derivations.
 *
 * Holds the applicant score, weights, filters, selection, loaded/geocoded programs,
 * and LoadSummary. Memoized derivations recompute scored, filtered, sorted programs,
 * markers, and bounds whenever their dependencies change.
 *
 * Requirements: 4.6, 7.3
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type {
  Filters,
  GeocodedProgram,
  LoadSummary,
  ScoredProgram,
  SortColumn,
  TechHub,
  Weights,
} from '../core/types';
import { scoreProgram } from '../core/scoring';
import { applyFilters, sortPrograms } from '../core/filter-sort';
import { buildMarkers, computeBounds } from '../core/map-model';
import type { LatLngBounds, MapMarker } from '../core/map-model';
import { DEFAULT_TECH_HUBS, DEFAULT_WEIGHTS } from '../core/tech-hubs';
import type { MatchWeights } from '../core/match-scoring';
import { DEFAULT_MATCH_WEIGHTS } from '../core/match-scoring';
import type { SignalMap, SignalTier } from '../core/signals';
import { deserializeSignals, serializeSignals } from '../core/signals';

/** Actions exposed by the app state context for mutating state. */
export interface AppStateActions {
  setApplicantScore: (score: number) => void;
  setWeights: (weights: Weights) => void;
  setMatchWeights: (weights: MatchWeights) => void;
  setFilters: (filters: Filters) => void;
  setSortColumn: (column: SortColumn) => void;
  setSortDirection: (direction: 'asc' | 'desc') => void;
  setSelectedProgramId: (id: string | null) => void;
  setPrograms: (programs: GeocodedProgram[]) => void;
  setLoadSummary: (summary: LoadSummary) => void;
  setTechHubs: (hubs: TechHub[]) => void;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  /** Assign (or reassign) a single program's signal tier. */
  setSignal: (id: string, tier: SignalTier) => void;
  /** Remove a program's signal. */
  removeSignal: (id: string) => void;
  /** Replace the entire signal map at once (used by the staging modal on save). */
  setSignals: (next: SignalMap) => void;
}

/** Derived values computed from the current state. */
export interface AppStateDerived {
  scoredPrograms: ScoredProgram[];
  filteredPrograms: ScoredProgram[];
  sortedPrograms: ScoredProgram[];
  markers: MapMarker[];
  bounds: LatLngBounds | null;
  selectedProgram: ScoredProgram | null;
}

/** Full app state shape exposed through context. */
export interface AppStateValue {
  applicantScore: number;
  weights: Weights;
  matchWeights: MatchWeights;
  filters: Filters;
  sortColumn: SortColumn;
  sortDirection: 'asc' | 'desc';
  selectedProgramId: string | null;
  programs: GeocodedProgram[];
  loadSummary: LoadSummary;
  techHubs: TechHub[];
  favorites: Set<string>;
  signals: SignalMap;
  derived: AppStateDerived;
  actions: AppStateActions;
}

const DEFAULT_LOAD_SUMMARY: LoadSummary = {
  loadedBySpecialty: { 'Family Medicine': 0, 'Internal Medicine': 0 },
  excludedRows: [],
  geocodedCount: 0,
  unmappedCount: 0,
};

const AppStateContext = createContext<AppStateValue | null>(null);

export interface AppStateProviderProps {
  children: ReactNode;
}

/**
 * Provider component that holds the application state and exposes
 * memoized derivations. Changing the applicant score or weights
 * recomputes all scores (Req 4.6, 7.3).
 */
export function AppStateProvider({ children }: AppStateProviderProps) {
  const [applicantScore, setApplicantScore] = useState(223);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [matchWeights, setMatchWeights] = useState<MatchWeights>(DEFAULT_MATCH_WEIGHTS);
  const [filters, setFilters] = useState<Filters>({ step2Compatible: true, hideIncompleteData: true });
  const [sortColumn, setSortColumn] = useState<SortColumn>('matchScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [programs, setPrograms] = useState<GeocodedProgram[]>([]);
  const [loadSummary, setLoadSummary] = useState<LoadSummary>(DEFAULT_LOAD_SUMMARY);
  const [techHubs, setTechHubs] = useState<TechHub[]>(DEFAULT_TECH_HUBS);

  // Favorites: initialize from localStorage
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('favorites');
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        return new Set(parsed);
      }
    } catch {
      // Ignore parse errors
    }
    return new Set();
  });

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      localStorage.setItem('favorites', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: string) => {
    return favorites.has(id);
  }, [favorites]);

  /** Add ids to favorites (never removes). Used to auto-favorite on signal. */
  const ensureFavorites = useCallback((ids: string[]) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of ids) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      if (!changed) return prev;
      localStorage.setItem('favorites', JSON.stringify([...next]));
      return next;
    });
  }, []);

  // Signals: initialize from localStorage
  const [signals, setSignalsState] = useState<SignalMap>(() => {
    try {
      const stored = localStorage.getItem('signals');
      if (stored) {
        return deserializeSignals(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
    return new Map();
  });

  const persistSignals = useCallback((next: SignalMap) => {
    try {
      localStorage.setItem('signals', JSON.stringify(serializeSignals(next)));
    } catch {
      // Ignore quota/serialization errors
    }
  }, []);

  const setSignal = useCallback((id: string, tier: SignalTier) => {
    setSignalsState((prev) => {
      const next = new Map(prev);
      next.set(id, tier);
      persistSignals(next);
      return next;
    });
    // Auto-favorite so signaled programs show up in the export.
    ensureFavorites([id]);
  }, [persistSignals, ensureFavorites]);

  const removeSignal = useCallback((id: string) => {
    setSignalsState((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      persistSignals(next);
      return next;
    });
  }, [persistSignals]);

  const setSignals = useCallback((next: SignalMap) => {
    const copy = new Map(next);
    persistSignals(copy);
    setSignalsState(copy);
    // Auto-favorite every currently-signaled program (removals don't unfavorite).
    ensureFavorites([...copy.keys()]);
  }, [persistSignals, ensureFavorites]);

  // Derivation: score all programs when applicantScore, weights, or techHubs change
  const scoredPrograms = useMemo<ScoredProgram[]>(
    () => programs.map((p) => scoreProgram(p, applicantScore, weights, techHubs, matchWeights)),
    [programs, applicantScore, weights, techHubs, matchWeights],
  );

  // Derivation: apply filters to scored programs
  const filteredPrograms = useMemo<ScoredProgram[]>(
    () => applyFilters(scoredPrograms, filters, applicantScore),
    [scoredPrograms, filters, applicantScore],
  );

  // Derivation: sort the filtered list
  const sortedPrograms = useMemo<ScoredProgram[]>(
    () => sortPrograms(filteredPrograms, sortColumn, sortDirection),
    [filteredPrograms, sortColumn, sortDirection],
  );

  // Derivation: build map markers from filtered programs
  const markers = useMemo<MapMarker[]>(
    () => buildMarkers(filteredPrograms),
    [filteredPrograms],
  );

  // Derivation: compute tight bounds from markers
  const bounds = useMemo<LatLngBounds | null>(
    () => computeBounds(markers),
    [markers],
  );

  // Derivation: find the selected program in scored programs
  const selectedProgram = useMemo<ScoredProgram | null>(
    () =>
      selectedProgramId === null
        ? null
        : scoredPrograms.find((p) => p.id === selectedProgramId) ?? null,
    [scoredPrograms, selectedProgramId],
  );

  const actions: AppStateActions = useMemo(
    () => ({
      setApplicantScore,
      setWeights,
      setMatchWeights,
      setFilters,
      setSortColumn,
      setSortDirection,
      setSelectedProgramId,
      setPrograms,
      setLoadSummary,
      setTechHubs,
      toggleFavorite,
      isFavorite,
      setSignal,
      removeSignal,
      setSignals,
    }),
    [toggleFavorite, isFavorite, setSignal, removeSignal, setSignals],
  );

  const derived: AppStateDerived = useMemo(
    () => ({
      scoredPrograms,
      filteredPrograms,
      sortedPrograms,
      markers,
      bounds,
      selectedProgram,
    }),
    [scoredPrograms, filteredPrograms, sortedPrograms, markers, bounds, selectedProgram],
  );

  const value: AppStateValue = useMemo(
    () => ({
      applicantScore,
      weights,
      matchWeights,
      filters,
      sortColumn,
      sortDirection,
      selectedProgramId,
      programs,
      loadSummary,
      techHubs,
      favorites,
      signals,
      derived,
      actions,
    }),
    [
      applicantScore,
      weights,
      matchWeights,
      filters,
      sortColumn,
      sortDirection,
      selectedProgramId,
      programs,
      loadSummary,
      techHubs,
      favorites,
      signals,
      derived,
      actions,
    ],
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

/**
 * Custom hook to access the app state context.
 * Throws if used outside of AppStateProvider.
 */
export function useAppState(): AppStateValue {
  const context = useContext(AppStateContext);
  if (context === null) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}
