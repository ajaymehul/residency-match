/**
 * Unit tests for applyFilters and sortPrograms in filter-sort.ts.
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { describe, it, expect } from 'vitest';
import { applyFilters, sortPrograms } from '../filter-sort';
import type { ScoredProgram, Filters } from '../types';
import { UNAVAILABLE } from '../types';

/** Helper to build a minimal ScoredProgram for testing. */
function makeProgram(overrides: Partial<ScoredProgram> = {}): ScoredProgram {
  return {
    id: 'Family Medicine:1',
    specialty: 'Family Medicine',
    name: 'Test Program',
    step2Range: { kind: 'present', value: { low: 210, high: 250 } },
    comlexRange: { kind: 'missing' },
    signalRates: {},
    inStateRate: { kind: 'missing' },
    outOfStateRate: { kind: 'missing' },
    usImgRate: { kind: 'present', value: 0.5 },
    city: 'Boston',
    state: 'MA',
    region: 'New England',
    sourceRow: 4,
    coordinates: { lat: 42.36, lng: -71.06 },
    unmapped: false,
    step2Fit: 85,
    imgFriendliness: 50,
    techHubProximity: 90,
    nearestHub: { name: 'Boston', distanceMiles: 5 },
    fitScore: 75,
    matchScore: null,
    availability: { step2: true, img: true, proximity: true },
    ...overrides,
  };
}

describe('applyFilters', () => {
  const programs: ScoredProgram[] = [
    makeProgram({ id: 'FM:1', specialty: 'Family Medicine', state: 'MA', region: 'New England', fitScore: 80, imgFriendliness: 60, nearestHub: { name: 'Boston', distanceMiles: 5 } }),
    makeProgram({ id: 'IM:2', specialty: 'Internal Medicine', state: 'NY', region: 'Middle Atlantic', fitScore: 50, imgFriendliness: 30, nearestHub: { name: 'NYC', distanceMiles: 20 } }),
    makeProgram({ id: 'FM:3', specialty: 'Family Medicine', state: 'CA', region: 'Pacific', fitScore: UNAVAILABLE, imgFriendliness: UNAVAILABLE, nearestHub: { name: 'SF', distanceMiles: 10 } }),
    makeProgram({ id: 'IM:4', specialty: 'Internal Medicine', state: 'TX', region: 'West South Central', fitScore: 70, imgFriendliness: 45, nearestHub: null, coordinates: null, unmapped: true }),
  ];

  it('returns all programs when filters is empty', () => {
    const result = applyFilters(programs, {});
    expect(result).toEqual(programs);
  });

  it('returns all programs when filters has undefined fields', () => {
    const filters: Filters = { specialty: undefined, states: undefined, regions: undefined };
    const result = applyFilters(programs, filters);
    expect(result).toEqual(programs);
  });

  it('returns all programs when array filters are empty arrays', () => {
    const filters: Filters = { states: [], regions: [] };
    const result = applyFilters(programs, filters);
    expect(result).toEqual(programs);
  });

  it('filters by specialty', () => {
    const result = applyFilters(programs, { specialty: 'Family Medicine' });
    expect(result.map((p) => p.id)).toEqual(['FM:1', 'FM:3']);
  });

  it('filters by states', () => {
    const result = applyFilters(programs, { states: ['MA', 'CA'] });
    expect(result.map((p) => p.id)).toEqual(['FM:1', 'FM:3']);
  });

  it('filters by regions', () => {
    const result = applyFilters(programs, { regions: ['New England'] });
    expect(result.map((p) => p.id)).toEqual(['FM:1']);
  });

  it('filters by minFitScore, excluding UNAVAILABLE', () => {
    const result = applyFilters(programs, { minFitScore: 60 });
    // FM:3 has UNAVAILABLE fitScore — excluded
    // IM:2 has 50 — excluded
    expect(result.map((p) => p.id)).toEqual(['FM:1', 'IM:4']);
  });

  it('filters by minImgFriendliness, excluding UNAVAILABLE', () => {
    const result = applyFilters(programs, { minImgFriendliness: 40 });
    // FM:3 has UNAVAILABLE — excluded
    // IM:2 has 30 — excluded
    expect(result.map((p) => p.id)).toEqual(['FM:1', 'IM:4']);
  });

  it('filters by maxTechHubDistance, excluding programs with null nearestHub', () => {
    const result = applyFilters(programs, { maxTechHubDistance: 15 });
    // FM:1: 5mi ✓, IM:2: 20mi ✗, FM:3: 10mi ✓, IM:4: null nearestHub ✗
    expect(result.map((p) => p.id)).toEqual(['FM:1', 'FM:3']);
  });

  it('filters by step2Compatible when applicantScore >= range.low', () => {
    // All programs have step2Range { low: 210, high: 250 }
    const result = applyFilters(programs, { step2Compatible: true }, 215);
    // All have low=210, 215 >= 210 → pass for those with present range
    expect(result.map((p) => p.id)).toEqual(['FM:1', 'IM:2', 'FM:3', 'IM:4']);
  });

  it('step2Compatible excludes programs where applicantScore < range.low', () => {
    const progs = [
      makeProgram({ id: 'A', step2Range: { kind: 'present', value: { low: 230, high: 260 } } }),
      makeProgram({ id: 'B', step2Range: { kind: 'present', value: { low: 200, high: 240 } } }),
    ];
    const result = applyFilters(progs, { step2Compatible: true }, 220);
    // A: 220 < 230 → fail, B: 220 >= 200 → pass
    expect(result.map((p) => p.id)).toEqual(['B']);
  });

  it('step2Compatible excludes programs with missing step2Range', () => {
    const progs = [
      makeProgram({ id: 'A', step2Range: { kind: 'missing' } }),
      makeProgram({ id: 'B', step2Range: { kind: 'present', value: { low: 200, high: 240 } } }),
    ];
    const result = applyFilters(progs, { step2Compatible: true }, 220);
    expect(result.map((p) => p.id)).toEqual(['B']);
  });

  it('step2Compatible excludes all when applicantScore is undefined', () => {
    const result = applyFilters(programs, { step2Compatible: true });
    expect(result).toEqual([]);
  });

  it('applies conjunction of multiple filters', () => {
    const result = applyFilters(programs, {
      specialty: 'Family Medicine',
      minFitScore: 70,
    });
    // FM:1: FM ✓ + fitScore 80 ≥ 70 ✓
    // FM:3: FM ✓ + fitScore UNAVAILABLE ✗
    expect(result.map((p) => p.id)).toEqual(['FM:1']);
  });

  it('conjunction: specialty + state + minFitScore', () => {
    const result = applyFilters(programs, {
      specialty: 'Internal Medicine',
      states: ['NY', 'TX'],
      minFitScore: 60,
    });
    // IM:2: IM ✓, NY ✓, fitScore 50 < 60 ✗
    // IM:4: IM ✓, TX ✓, fitScore 70 ≥ 60 ✓
    expect(result.map((p) => p.id)).toEqual(['IM:4']);
  });
});


describe('sortPrograms', () => {
  function makeProgram(overrides: Partial<ScoredProgram> = {}): ScoredProgram {
    return {
      id: 'Family Medicine:1',
      specialty: 'Family Medicine',
      name: 'Test Program',
      step2Range: { kind: 'present', value: { low: 210, high: 250 } },
      comlexRange: { kind: 'missing' },
      signalRates: {},
      inStateRate: { kind: 'missing' },
      outOfStateRate: { kind: 'missing' },
      usImgRate: { kind: 'present', value: 0.5 },
      city: 'Boston',
      state: 'MA',
      region: 'New England',
      sourceRow: 4,
      coordinates: { lat: 42.36, lng: -71.06 },
      unmapped: false,
      step2Fit: 85,
      imgFriendliness: 50,
      techHubProximity: 90,
      nearestHub: { name: 'Boston', distanceMiles: 5 },
      fitScore: 75,
      matchScore: null,
      availability: { step2: true, img: true, proximity: true },
      ...overrides,
    };
  }

  const programs: ScoredProgram[] = [
    makeProgram({ id: 'A', name: 'Alpha', fitScore: 80, city: 'Austin', state: 'TX', nearestHub: { name: 'Austin', distanceMiles: 3 } }),
    makeProgram({ id: 'B', name: 'Beta', fitScore: UNAVAILABLE, city: 'Dallas', state: 'TX', nearestHub: null, coordinates: null, unmapped: true }),
    makeProgram({ id: 'C', name: 'Charlie', fitScore: 60, city: 'Boston', state: 'MA', nearestHub: { name: 'Boston', distanceMiles: 10 } }),
    makeProgram({ id: 'D', name: 'Delta', fitScore: 90, city: 'Seattle', state: 'WA', nearestHub: { name: 'Seattle', distanceMiles: 1 } }),
  ];

  it('sorts by name ascending', () => {
    const result = sortPrograms(programs, 'name', 'asc');
    expect(result.map((p) => p.name)).toEqual(['Alpha', 'Beta', 'Charlie', 'Delta']);
  });

  it('sorts by name descending', () => {
    const result = sortPrograms(programs, 'name', 'desc');
    expect(result.map((p) => p.name)).toEqual(['Delta', 'Charlie', 'Beta', 'Alpha']);
  });

  it('sorts by fitScore ascending with UNAVAILABLE last', () => {
    const result = sortPrograms(programs, 'fitScore', 'asc');
    expect(result.map((p) => p.id)).toEqual(['C', 'A', 'D', 'B']);
  });

  it('sorts by fitScore descending with UNAVAILABLE last', () => {
    const result = sortPrograms(programs, 'fitScore', 'desc');
    expect(result.map((p) => p.id)).toEqual(['D', 'A', 'C', 'B']);
  });

  it('sorts by techHubDistance ascending with null nearestHub last', () => {
    const result = sortPrograms(programs, 'techHubDistance', 'asc');
    expect(result.map((p) => p.id)).toEqual(['D', 'A', 'C', 'B']);
  });

  it('sorts by techHubDistance descending with null nearestHub last', () => {
    const result = sortPrograms(programs, 'techHubDistance', 'desc');
    expect(result.map((p) => p.id)).toEqual(['C', 'A', 'D', 'B']);
  });

  it('does not mutate the input array', () => {
    const original = [...programs];
    sortPrograms(programs, 'fitScore', 'asc');
    expect(programs).toEqual(original);
  });

  it('preserves relative order for equal values (stability)', () => {
    const sameScore: ScoredProgram[] = [
      makeProgram({ id: 'X', name: 'X', fitScore: 70 }),
      makeProgram({ id: 'Y', name: 'Y', fitScore: 70 }),
      makeProgram({ id: 'Z', name: 'Z', fitScore: 70 }),
    ];
    const result = sortPrograms(sameScore, 'fitScore', 'asc');
    expect(result.map((p) => p.id)).toEqual(['X', 'Y', 'Z']);
  });

  it('sorts by state using localeCompare', () => {
    const result = sortPrograms(programs, 'state', 'asc');
    expect(result.map((p) => p.state)).toEqual(['MA', 'TX', 'TX', 'WA']);
  });
});
