/**
 * Core data models and shared types for the Residency Program Explorer.
 *
 * All parsing, geocoding, scoring, filtering, and sorting logic consumes
 * these types. Missing data is modeled explicitly via `FieldValue<T>` and
 * the `UNAVAILABLE` symbol so every consumer handles gaps deliberately.
 *
 * Requirements: 1.1, 4.5, 5.2, 6.5, 7.5
 */

/** Residency specialty, determined by the source sheet. */
export type Specialty = 'Family Medicine' | 'Internal Medicine';

/**
 * A parsed field value: present with a value, missing (`--` or `!` in the
 * source), or invalid (unparseable content, raw string retained).
 */
export type FieldValue<T> =
  | { kind: 'present'; value: T }
  | { kind: 'missing' }
  | { kind: 'invalid'; raw: string };

/** A Step 2 CK / COMLEX score range. Valid ⇔ integers with low <= high. */
export interface ScoreRange {
  low: number;
  high: number;
}

/** Geographic coordinates. */
export interface Coordinates {
  lat: number;
  lng: number;
}

/** A single residency program parsed from one data row of the source file. */
export interface Program {
  /** `${specialty}:${rowNumber}` */
  id: string;
  specialty: Specialty;
  name: string;
  step2Range: FieldValue<ScoreRange>;
  comlexRange: FieldValue<ScoreRange>;
  /** Keys per specialty (signal / silverSignal / goldSignal / noSignal). */
  signalRates: Record<string, FieldValue<number>>;
  inStateRate: FieldValue<number>;
  outOfStateRate: FieldValue<number>;
  usImgRate: FieldValue<number>;
  city: string;
  state: string;
  region: string;
  /** 1-based row in the source sheet. */
  sourceRow: number;
  /** Hyperlink URL from the program name cell, if present. */
  url?: string;
}

/** A program after offline geocoding. */
export interface GeocodedProgram extends Program {
  coordinates: Coordinates | null;
  /** true ⇔ coordinates === null */
  unmapped: boolean;
}

/**
 * Sentinel for a sub-score that cannot be computed (missing/invalid source
 * data or unmapped location). A tagged union with `number` forces every
 * consumer to handle unavailability explicitly.
 */
export const UNAVAILABLE: unique symbol = Symbol('unavailable');

/** A sub-score in [0, 100], or UNAVAILABLE when it cannot be computed. */
export type SubScore = number | typeof UNAVAILABLE;

/** A program with all computed sub-scores and the composite Fit_Score. */
export interface ScoredProgram extends GeocodedProgram {
  step2Fit: SubScore;
  imgFriendliness: SubScore;
  techHubProximity: SubScore;
  /** Nearest major city info */
  nearestHub: { name: string; distanceMiles: number } | null;
  fitScore: SubScore;
  /** New 5-signal match chance score (0-100 or null) */
  matchScore: number | null;
  availability: { step2: boolean; img: boolean; proximity: boolean };
}

/** A US metropolitan area relevant for partner employment. */
export interface MajorCity {
  name: string;
  lat: number;
  lng: number;
}

/** @deprecated Use MajorCity instead */
export type TechHub = MajorCity;

/** Sub-score weights for the composite Fit_Score. Default 0.4 / 0.4 / 0.2. */
export interface Weights {
  step2: number;
  img: number;
  proximity: number;
}

/** A source row excluded during parsing, with its location and reason. */
export interface ExcludedRow {
  sheetName: string;
  rowNumber: number;
  reason: string;
}

/** Summary of data loading and geocoding results. */
export interface LoadSummary {
  loadedBySpecialty: Record<Specialty, number>;
  excludedRows: ExcludedRow[];
  geocodedCount: number;
  unmappedCount: number;
}

/** Active filters; a program matches only if it satisfies every active filter. */
export interface Filters {
  specialty?: Specialty;
  states?: string[];
  regions?: string[];
  minFitScore?: number;
  minImgFriendliness?: number;
  maxCityDistance?: number;
  /** @deprecated */ maxTechHubDistance?: number;
  /** applicantScore >= range.low */
  step2Compatible?: boolean;
  /** Hide programs missing both Step 2 score range and US IMG rate. */
  hideIncompleteData?: boolean;
}

/** Sortable columns in the list view. */
export type SortColumn =
  | 'name'
  | 'specialty'
  | 'city'
  | 'state'
  | 'fitScore'
  | 'matchScore'
  | 'step2Fit'
  | 'imgFriendliness'
  | 'cityProximity'
  | 'cityDistance'
  | 'techHubProximity'
  | 'techHubDistance';
