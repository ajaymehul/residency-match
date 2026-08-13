/**
 * Filtering and sorting logic for scored programs.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import type { Filters, ScoredProgram, SortColumn, SubScore } from './types';
import { UNAVAILABLE } from './types';

/**
 * Returns true if a SubScore value is a usable number (not UNAVAILABLE).
 */
function isAvailable(value: SubScore): value is number {
  return value !== UNAVAILABLE;
}

/**
 * Apply all active filters as a conjunction (AND). A program must pass every
 * active filter to appear in the result.
 *
 * - A filter field is "active" only when its value is defined and non-empty
 *   (for arrays).
 * - Programs with UNAVAILABLE in a numeric filter's field do NOT match that
 *   filter (they are excluded).
 * - An empty/undefined Filters object matches everything (identity function).
 * - step2Compatible: program passes if applicantScore >= program.step2Range.low
 *   (the range must be present).
 *
 * Requirements: 8.1, 8.2, 8.3
 */
export function applyFilters(
  programs: ScoredProgram[],
  filters: Filters,
  applicantScore?: number
): ScoredProgram[] {
  return programs.filter((program) => {
    // Specialty filter (single value)
    if (filters.specialty !== undefined) {
      if (program.specialty !== filters.specialty) return false;
    }

    // States filter (array)
    if (filters.states !== undefined && filters.states.length > 0) {
      if (!filters.states.includes(program.state)) return false;
    }

    // Regions filter (array)
    if (filters.regions !== undefined && filters.regions.length > 0) {
      if (!filters.regions.includes(program.region)) return false;
    }

    // minFitScore filter (numeric — UNAVAILABLE excluded)
    if (filters.minFitScore !== undefined) {
      if (!isAvailable(program.fitScore)) return false;
      if (program.fitScore < filters.minFitScore) return false;
    }

    // minImgFriendliness filter (numeric — UNAVAILABLE excluded)
    if (filters.minImgFriendliness !== undefined) {
      if (!isAvailable(program.imgFriendliness)) return false;
      if (program.imgFriendliness < filters.minImgFriendliness) return false;
    }

    // maxTechHubDistance filter (numeric — UNAVAILABLE excluded, uses nearestHub)
    if (filters.maxTechHubDistance !== undefined) {
      if (program.nearestHub === null) return false;
      if (program.nearestHub.distanceMiles > filters.maxTechHubDistance) return false;
    }

    // step2Compatible filter: applicantScore >= range.low
    if (filters.step2Compatible === true) {
      if (applicantScore === undefined) return false;
      if (program.step2Range.kind !== 'present') return false;
      if (applicantScore < program.step2Range.value.low) return false;
    }

    // hideIncompleteData filter: hide programs missing Step 2 range OR US IMG rate
    if (filters.hideIncompleteData === true) {
      const hasStep2 = program.step2Range.kind === 'present';
      const hasUsImg = program.usImgRate.kind === 'present';
      if (!hasStep2 || !hasUsImg) return false;
    }

    return true;
  });
}

/**
 * Extract the sortable value for a given column from a ScoredProgram.
 * Returns `UNAVAILABLE` for numeric columns when the value is unavailable,
 * or `null` for techHubDistance when nearestHub is null.
 */
function getSortValue(
  program: ScoredProgram,
  column: SortColumn
): string | number | typeof UNAVAILABLE | null {
  switch (column) {
    case 'name':
      return program.name;
    case 'specialty':
      return program.specialty;
    case 'city':
      return program.city;
    case 'state':
      return program.state;
    case 'fitScore':
      return program.fitScore;
    case 'matchScore':
      return program.matchScore ?? null;
    case 'step2Fit':
      return program.step2Fit;
    case 'imgFriendliness':
      return program.imgFriendliness;
    case 'techHubProximity':
    case 'cityProximity':
      return program.techHubProximity;
    case 'techHubDistance':
    case 'cityDistance':
      return program.nearestHub === null ? null : program.nearestHub.distanceMiles;
  }
}

/**
 * Returns true if the value should be treated as "unavailable" for sorting
 * purposes (placed last regardless of sort direction).
 */
function isUnavailableForSort(value: string | number | typeof UNAVAILABLE | null): boolean {
  return value === UNAVAILABLE || value === null;
}

/**
 * Sort programs by the requested column and direction. The sort is stable:
 * programs with equal values preserve their original relative order.
 *
 * Programs with UNAVAILABLE values (or null nearestHub for techHubDistance)
 * in the sort column are always placed last regardless of direction.
 *
 * For string columns (name, specialty, city, state): uses localeCompare.
 * For numeric columns: standard numeric comparison.
 *
 * Returns a new array; does not mutate the input.
 *
 * Requirements: 8.4, 8.5
 */
export function sortPrograms(
  programs: ScoredProgram[],
  column: SortColumn,
  direction: 'asc' | 'desc'
): ScoredProgram[] {
  // Copy to avoid mutation; Array.prototype.sort is stable in modern JS engines
  // (ES2019+ specification guarantees stable sort)
  const result = [...programs];

  result.sort((a, b) => {
    const aVal = getSortValue(a, column);
    const bVal = getSortValue(b, column);

    const aUnavail = isUnavailableForSort(aVal);
    const bUnavail = isUnavailableForSort(bVal);

    // Unavailable values always sort last regardless of direction
    if (aUnavail && bUnavail) return 0;
    if (aUnavail) return 1;
    if (bUnavail) return -1;

    // Both values are available — compare based on type
    let cmp: number;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      cmp = aVal.localeCompare(bVal);
    } else {
      // Both are numbers at this point
      cmp = (aVal as number) - (bVal as number);
    }

    return direction === 'asc' ? cmp : -cmp;
  });

  return result;
}
