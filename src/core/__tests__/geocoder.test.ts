/**
 * Unit tests for the offline geocoder module.
 * Tests normalizeKey, CITY_ALIASES, geocode, and geocodeAll.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeKey,
  CITY_ALIASES,
  geocode,
  geocodeAll,
  geocodeAllWithSummary,
  type CityDataset,
} from '../geocoder';
import type { Program, LoadSummary } from '../types';

describe('normalizeKey', () => {
  it('lowercases city and uppercases state', () => {
    expect(normalizeKey('New York', 'NY')).toBe('new york|NY');
  });

  it('trims whitespace', () => {
    expect(normalizeKey('  Houston  ', '  TX  ')).toBe('houston|TX');
  });

  it('collapses internal whitespace', () => {
    expect(normalizeKey('San   Francisco', 'CA')).toBe('san francisco|CA');
  });

  it('strips periods', () => {
    expect(normalizeKey('St. Louis', 'MO')).toBe('st louis|MO');
  });

  it('handles combined normalizations', () => {
    expect(normalizeKey('  Ft.  Worth  ', ' TX ')).toBe('ft worth|TX');
  });
});

describe('CITY_ALIASES', () => {
  it('maps tripler amc|HI to honolulu|HI', () => {
    expect(CITY_ALIASES['tripler amc|HI']).toBe('honolulu|HI');
  });

  it('maps ft sam houston|TX to san antonio|TX', () => {
    expect(CITY_ALIASES['ft sam houston|TX']).toBe('san antonio|TX');
  });

  it('has all keys in normalized form (lowercase city, uppercase state, no periods, single spaces)', () => {
    for (const key of Object.keys(CITY_ALIASES)) {
      const [city, state] = key.split('|');
      expect(city).toBe(city.toLowerCase());
      expect(state).toBe(state.toUpperCase());
      expect(key).not.toContain('.');
      expect(key).not.toMatch(/  /);
    }
  });
});

describe('geocode', () => {
  const dataset: CityDataset = {
    'honolulu|HI': { lat: 21.3069, lng: -157.8583 },
    'new york|NY': { lat: 40.7128, lng: -74.006 },
    'san francisco|CA': { lat: 37.7749, lng: -122.4194 },
    'fort worth|TX': { lat: 32.7555, lng: -97.3308 },
    'st louis|MO': { lat: 38.627, lng: -90.1994 },
  };

  it('returns coordinates for a direct match', () => {
    const result = geocode('New York', 'NY', dataset);
    expect(result).toEqual({ lat: 40.7128, lng: -74.006 });
  });

  it('is case-insensitive', () => {
    const result = geocode('NEW YORK', 'ny', dataset);
    expect(result).toEqual({ lat: 40.7128, lng: -74.006 });
  });

  it('handles whitespace variations', () => {
    const result = geocode('  San   Francisco  ', ' CA ', dataset);
    expect(result).toEqual({ lat: 37.7749, lng: -122.4194 });
  });

  it('strips periods for matching', () => {
    const result = geocode('St. Louis', 'MO', dataset);
    expect(result).toEqual({ lat: 38.627, lng: -90.1994 });
  });

  it('resolves via alias table', () => {
    const result = geocode('Tripler AMC', 'HI', dataset);
    expect(result).toEqual({ lat: 21.3069, lng: -157.8583 });
  });

  it('resolves Ft. Worth via alias to fort worth', () => {
    const result = geocode('Ft. Worth', 'TX', dataset);
    expect(result).toEqual({ lat: 32.7555, lng: -97.3308 });
  });

  it('returns null for unknown cities', () => {
    const result = geocode('Nonexistent City', 'ZZ', dataset);
    expect(result).toBeNull();
  });

  it('is deterministic — repeated calls return identical results', () => {
    const r1 = geocode('New York', 'NY', dataset);
    const r2 = geocode('New York', 'NY', dataset);
    expect(r1).toEqual(r2);
  });
});

describe('geocodeAll', () => {
  const dataset: CityDataset = {
    'new york|NY': { lat: 40.7128, lng: -74.006 },
    'chicago|IL': { lat: 41.8781, lng: -87.6298 },
  };

  function makeProgram(city: string, state: string): Program {
    return {
      id: `FM:1`,
      specialty: 'Family Medicine',
      name: 'Test Program',
      step2Range: { kind: 'missing' },
      comlexRange: { kind: 'missing' },
      signalRates: {},
      inStateRate: { kind: 'missing' },
      outOfStateRate: { kind: 'missing' },
      usImgRate: { kind: 'missing' },
      city,
      state,
      region: 'Test',
      sourceRow: 4,
    };
  }

  it('geocodes programs found in the dataset', () => {
    const programs = [makeProgram('New York', 'NY')];
    const { geocoded, geocodedCount, unmappedCount } = geocodeAll(programs, dataset);

    expect(geocoded).toHaveLength(1);
    expect(geocoded[0].coordinates).toEqual({ lat: 40.7128, lng: -74.006 });
    expect(geocoded[0].unmapped).toBe(false);
    expect(geocodedCount).toBe(1);
    expect(unmappedCount).toBe(0);
  });

  it('flags unmapped programs with coordinates null and unmapped true', () => {
    const programs = [makeProgram('Unknown City', 'ZZ')];
    const { geocoded, geocodedCount, unmappedCount } = geocodeAll(programs, dataset);

    expect(geocoded).toHaveLength(1);
    expect(geocoded[0].coordinates).toBeNull();
    expect(geocoded[0].unmapped).toBe(true);
    expect(geocodedCount).toBe(0);
    expect(unmappedCount).toBe(1);
  });

  it('counts geocoded and unmapped correctly with a mix', () => {
    const programs = [
      makeProgram('New York', 'NY'),
      makeProgram('Chicago', 'IL'),
      makeProgram('Nowhere', 'XX'),
    ];
    const { geocoded, geocodedCount, unmappedCount } = geocodeAll(programs, dataset);

    expect(geocoded).toHaveLength(3);
    expect(geocodedCount).toBe(2);
    expect(unmappedCount).toBe(1);
  });

  it('preserves all original program fields', () => {
    const programs = [makeProgram('New York', 'NY')];
    const { geocoded } = geocodeAll(programs, dataset);

    expect(geocoded[0].name).toBe('Test Program');
    expect(geocoded[0].specialty).toBe('Family Medicine');
    expect(geocoded[0].city).toBe('New York');
    expect(geocoded[0].state).toBe('NY');
  });
});

describe('geocodeAllWithSummary', () => {
  const dataset: CityDataset = {
    'new york|NY': { lat: 40.7128, lng: -74.006 },
  };

  function makeProgram(city: string, state: string): Program {
    return {
      id: `FM:1`,
      specialty: 'Family Medicine',
      name: 'Test Program',
      step2Range: { kind: 'missing' },
      comlexRange: { kind: 'missing' },
      signalRates: {},
      inStateRate: { kind: 'missing' },
      outOfStateRate: { kind: 'missing' },
      usImgRate: { kind: 'missing' },
      city,
      state,
      region: 'Test',
      sourceRow: 4,
    };
  }

  it('appends geocodedCount and unmappedCount to the load summary', () => {
    const baseSummary: LoadSummary = {
      loadedBySpecialty: { 'Family Medicine': 2, 'Internal Medicine': 0 },
      excludedRows: [],
      geocodedCount: 0,
      unmappedCount: 0,
    };

    const programs = [
      makeProgram('New York', 'NY'),
      makeProgram('Unknown', 'ZZ'),
    ];

    const result = geocodeAllWithSummary(programs, dataset, baseSummary);

    expect(result.summary.geocodedCount).toBe(1);
    expect(result.summary.unmappedCount).toBe(1);
    expect(result.programs).toHaveLength(2);
  });
});
