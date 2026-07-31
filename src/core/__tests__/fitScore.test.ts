import { describe, it, expect } from 'vitest';
import { fitScore, scoreProgram } from '../scoring';
import { UNAVAILABLE } from '../types';
import type { GeocodedProgram, TechHub, Weights } from '../types';
import { DEFAULT_WEIGHTS } from '../tech-hubs';

describe('fitScore', () => {
  const defaultWeights: Weights = { step2: 0.4, img: 0.4, proximity: 0.2 };

  describe('weighted mean over available sub-scores', () => {
    it('computes correct weighted mean with all three available', () => {
      const result = fitScore(
        { step2: 100, img: 50, proximity: 80 },
        defaultWeights,
      );
      // (100*0.4 + 50*0.4 + 80*0.2) / (0.4+0.4+0.2) = (40+20+16) / 1 = 76
      expect(result).toBeCloseTo(76);
    });

    it('renormalizes weights when one sub-score is UNAVAILABLE', () => {
      const result = fitScore(
        { step2: 100, img: UNAVAILABLE, proximity: 80 },
        defaultWeights,
      );
      // Available: step2(0.4), proximity(0.2); total = 0.6
      // (100 * 0.4/0.6 + 80 * 0.2/0.6) = (66.67 + 26.67) = 93.33
      expect(result).toBeCloseTo(100 * (0.4 / 0.6) + 80 * (0.2 / 0.6));
    });

    it('renormalizes weights when two sub-scores are UNAVAILABLE', () => {
      const result = fitScore(
        { step2: UNAVAILABLE, img: 75, proximity: UNAVAILABLE },
        defaultWeights,
      );
      // Only img available: 75 * (0.4/0.4) = 75
      expect(result).toBeCloseTo(75);
    });
  });

  describe('UNAVAILABLE when all sub-scores are unavailable', () => {
    it('returns UNAVAILABLE when all three are UNAVAILABLE', () => {
      const result = fitScore(
        { step2: UNAVAILABLE, img: UNAVAILABLE, proximity: UNAVAILABLE },
        defaultWeights,
      );
      expect(result).toBe(UNAVAILABLE);
    });
  });

  describe('all-zero weights treated as default weights', () => {
    it('uses DEFAULT_WEIGHTS when all weights are zero', () => {
      const zeroWeights: Weights = { step2: 0, img: 0, proximity: 0 };
      const result = fitScore(
        { step2: 100, img: 50, proximity: 80 },
        zeroWeights,
      );
      // Should use DEFAULT_WEIGHTS: 0.4/0.4/0.2
      const expected = 100 * 0.4 + 50 * 0.4 + 80 * 0.2;
      expect(result).toBeCloseTo(expected);
    });
  });

  describe('renormalization invariance', () => {
    it('returns v when all available sub-scores are the same value v', () => {
      const result = fitScore(
        { step2: 65, img: 65, proximity: 65 },
        defaultWeights,
      );
      expect(result).toBeCloseTo(65);
    });

    it('returns v with only two available at same value', () => {
      const result = fitScore(
        { step2: 80, img: UNAVAILABLE, proximity: 80 },
        defaultWeights,
      );
      expect(result).toBeCloseTo(80);
    });
  });

  describe('bounds', () => {
    it('returns 100 when all available sub-scores are 100', () => {
      const result = fitScore(
        { step2: 100, img: 100, proximity: 100 },
        defaultWeights,
      );
      expect(result).toBeCloseTo(100);
    });

    it('returns 0 when all available sub-scores are 0', () => {
      const result = fitScore(
        { step2: 0, img: 0, proximity: 0 },
        defaultWeights,
      );
      expect(result).toBeCloseTo(0);
    });
  });
});

describe('scoreProgram', () => {
  const hubs: TechHub[] = [
    { name: 'Austin', lat: 30.2672, lng: -97.7431 },
    { name: 'Boston', lat: 42.3601, lng: -71.0589 },
  ];

  const makeGeocodedProgram = (overrides: Partial<GeocodedProgram> = {}): GeocodedProgram => ({
    id: 'FM:1',
    specialty: 'Family Medicine',
    name: 'Test Program',
    step2Range: { kind: 'present', value: { low: 200, high: 240 } },
    comlexRange: { kind: 'missing' },
    signalRates: { signal: { kind: 'present', value: 0.5 } },
    inStateRate: { kind: 'present', value: 0.6 },
    outOfStateRate: { kind: 'present', value: 0.4 },
    usImgRate: { kind: 'present', value: 0.3 },
    city: 'Austin',
    state: 'TX',
    region: 'West South Central',
    sourceRow: 5,
    coordinates: { lat: 30.2672, lng: -97.7431 },
    unmapped: false,
    ...overrides,
  });

  it('assembles a scored program with all scores available', () => {
    const program = makeGeocodedProgram();
    const result = scoreProgram(program, 220, DEFAULT_WEIGHTS, hubs);

    expect(result.step2Fit).toBe(100); // score 220 >= mid (220)
    expect(result.imgFriendliness).toBeCloseTo(30); // 0.3 * 100
    expect(typeof result.techHubProximity).toBe('number'); // should be available
    expect(result.nearestHub).not.toBeNull();
    expect(result.nearestHub!.name).toBe('Austin');
    expect(result.nearestHub!.distanceMiles).toBeCloseTo(0, 0);
    expect(typeof result.fitScore).toBe('number');
    expect(result.availability).toEqual({ step2: true, img: true, proximity: true });
  });

  it('marks step2Fit unavailable when range is missing', () => {
    const program = makeGeocodedProgram({ step2Range: { kind: 'missing' } });
    const result = scoreProgram(program, 220, DEFAULT_WEIGHTS, hubs);

    expect(result.step2Fit).toBe(UNAVAILABLE);
    expect(result.availability.step2).toBe(false);
  });

  it('marks imgFriendliness unavailable when usImgRate is missing', () => {
    const program = makeGeocodedProgram({ usImgRate: { kind: 'missing' } });
    const result = scoreProgram(program, 220, DEFAULT_WEIGHTS, hubs);

    expect(result.imgFriendliness).toBe(UNAVAILABLE);
    expect(result.availability.img).toBe(false);
  });

  it('marks techHubProximity unavailable for unmapped programs', () => {
    const program = makeGeocodedProgram({
      coordinates: null,
      unmapped: true,
    });
    const result = scoreProgram(program, 220, DEFAULT_WEIGHTS, hubs);

    expect(result.techHubProximity).toBe(UNAVAILABLE);
    expect(result.nearestHub).toBeNull();
    expect(result.availability.proximity).toBe(false);
  });

  it('returns UNAVAILABLE fitScore when all three sub-scores are unavailable', () => {
    const program = makeGeocodedProgram({
      step2Range: { kind: 'missing' },
      usImgRate: { kind: 'missing' },
      coordinates: null,
      unmapped: true,
    });
    const result = scoreProgram(program, 220, DEFAULT_WEIGHTS, hubs);

    expect(result.fitScore).toBe(UNAVAILABLE);
    expect(result.availability).toEqual({ step2: false, img: false, proximity: false });
  });

  it('preserves original program properties', () => {
    const program = makeGeocodedProgram();
    const result = scoreProgram(program, 220, DEFAULT_WEIGHTS, hubs);

    expect(result.id).toBe('FM:1');
    expect(result.name).toBe('Test Program');
    expect(result.specialty).toBe('Family Medicine');
    expect(result.city).toBe('Austin');
    expect(result.state).toBe('TX');
  });
});
