/**
 * Offline geocoder: resolves program city+state to coordinates using
 * a bundled US cities dataset. No network calls exist in this module.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import type { Coordinates, GeocodedProgram, LoadSummary, Program } from './types';

/** Shape of the bundled cities dataset: key → { lat, lng }. */
export interface CityDataset {
  [key: string]: { lat: number; lng: number };
}

/**
 * Normalize a city+state pair into a dataset lookup key.
 * - Lowercase
 * - Trim leading/trailing whitespace
 * - Collapse internal whitespace runs to a single space
 * - Strip periods (e.g., "St." → "St")
 * - State code uppercased (dataset keys use lowercase state, so we lowercase it too)
 *
 * Final key format: `normalizedCity|normalizedState`
 */
export function normalizeKey(city: string, state: string): string {
  const normalizedCity = city
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '');

  const normalizedState = state.trim().toUpperCase();

  return `${normalizedCity}|${normalizedState}`;
}

/**
 * Alias table mapping known non-standard city names (after normalization)
 * to their canonical dataset keys. Keys and values are in normalized form.
 */
export const CITY_ALIASES: Record<string, string> = {
  'tripler amc|HI': 'honolulu|HI',
  'ft sam houston|TX': 'san antonio|TX',
  'ft hood|TX': 'killeen|TX',
  'ft worth|TX': 'fort worth|TX',
  'ft lauderdale|FL': 'fort lauderdale|FL',
  'ft myers|FL': 'fort myers|FL',
  'ft collins|CO': 'fort collins|CO',
  'n charleston|SC': 'north charleston|SC',
  'st pete|FL': 'st petersburg|FL',
  'st pete beach|FL': 'st petersburg|FL',
  'n little rock|AR': 'north little rock|AR',
  'jblm|WA': 'tacoma|WA',
  'joint base lewis-mcchord|WA': 'tacoma|WA',
  'joint base lewis mcchord|WA': 'tacoma|WA',
  'wpafb|OH': 'dayton|OH',
  'wright-patterson afb|OH': 'dayton|OH',
  'wright patterson afb|OH': 'dayton|OH',
  'lackland afb|TX': 'san antonio|TX',
  'nellis afb|NV': 'las vegas|NV',
  'eglin afb|FL': 'fort walton beach|FL',
  'travis afb|CA': 'fairfield|CA',
  'keesler afb|MS': 'biloxi|MS',
};

/**
 * Look up coordinates for a city+state pair from the dataset.
 * Pure function: same input always yields the same output.
 * Returns null if the location cannot be resolved.
 */
export function geocode(
  city: string,
  state: string,
  dataset: CityDataset,
): Coordinates | null {
  const key = normalizeKey(city, state);

  // Direct lookup
  const direct = dataset[key];
  if (direct) {
    return { lat: direct.lat, lng: direct.lng };
  }

  // Try alias table
  const aliasKey = CITY_ALIASES[key];
  if (aliasKey) {
    const aliased = dataset[aliasKey];
    if (aliased) {
      return { lat: aliased.lat, lng: aliased.lng };
    }
  }

  return null;
}

/**
 * Geocode all programs, producing GeocodedProgram[] with an `unmapped` flag
 * for programs whose locations could not be resolved.
 *
 * Also returns updated geocodedCount and unmappedCount for the load summary.
 */
export function geocodeAll(
  programs: Program[],
  dataset: CityDataset,
): { geocoded: GeocodedProgram[]; geocodedCount: number; unmappedCount: number } {
  let geocodedCount = 0;
  let unmappedCount = 0;

  const geocoded: GeocodedProgram[] = programs.map((program) => {
    const coordinates = geocode(program.city, program.state, dataset);

    if (coordinates) {
      geocodedCount++;
      return { ...program, coordinates, unmapped: false };
    } else {
      unmappedCount++;
      return { ...program, coordinates: null, unmapped: true };
    }
  });

  return { geocoded, geocodedCount, unmappedCount };
}

/**
 * Convenience function that geocodes all programs and appends the counts
 * to the given LoadSummary, returning the updated summary along with the
 * geocoded programs.
 */
export function geocodeAllWithSummary(
  programs: Program[],
  dataset: CityDataset,
  summary: LoadSummary,
): { programs: GeocodedProgram[]; summary: LoadSummary } {
  const { geocoded, geocodedCount, unmappedCount } = geocodeAll(programs, dataset);

  return {
    programs: geocoded,
    summary: {
      ...summary,
      geocodedCount,
      unmappedCount,
    },
  };
}
