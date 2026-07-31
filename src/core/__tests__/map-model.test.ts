import { describe, it, expect } from 'vitest';
import { fitBand, buildMarkers, computeBounds, type MapMarker } from '../map-model';
import { UNAVAILABLE, type ScoredProgram, type Coordinates } from '../types';

/** Helper: create a minimal ScoredProgram for testing buildMarkers. */
function makeScoredProgram(overrides: Partial<ScoredProgram> & { id: string; name: string }): ScoredProgram {
  return {
    specialty: 'Family Medicine',
    step2Range: { kind: 'missing' },
    comlexRange: { kind: 'missing' },
    signalRates: {},
    inStateRate: { kind: 'missing' },
    outOfStateRate: { kind: 'missing' },
    usImgRate: { kind: 'missing' },
    city: 'Test City',
    state: 'TX',
    region: 'South',
    sourceRow: 4,
    coordinates: { lat: 30.0, lng: -97.0 },
    unmapped: false,
    step2Fit: 80,
    imgFriendliness: 60,
    techHubProximity: 50,
    nearestHub: { name: 'Austin', distanceMiles: 10 },
    fitScore: 70,
    availability: { step2: true, img: true, proximity: true },
    ...overrides,
  };
}

describe('fitBand', () => {
  it('returns "high" for scores >= 70', () => {
    expect(fitBand(70)).toBe('high');
    expect(fitBand(100)).toBe('high');
    expect(fitBand(85)).toBe('high');
  });

  it('returns "medium" for scores 40–69', () => {
    expect(fitBand(40)).toBe('medium');
    expect(fitBand(69)).toBe('medium');
    expect(fitBand(55)).toBe('medium');
  });

  it('returns "low" for scores < 40', () => {
    expect(fitBand(0)).toBe('low');
    expect(fitBand(39)).toBe('low');
    expect(fitBand(20)).toBe('low');
  });

  it('returns "unavailable" for UNAVAILABLE', () => {
    expect(fitBand(UNAVAILABLE)).toBe('unavailable');
  });
});

describe('buildMarkers', () => {
  it('returns empty array for empty input', () => {
    expect(buildMarkers([])).toEqual([]);
  });

  it('excludes unmapped programs', () => {
    const unmapped = makeScoredProgram({
      id: 'FM:5',
      name: 'Unmapped Prog',
      coordinates: null,
      unmapped: true,
    });
    expect(buildMarkers([unmapped])).toEqual([]);
  });

  it('produces one marker per geocoded program with correct id and band', () => {
    const prog = makeScoredProgram({
      id: 'FM:10',
      name: 'Good Program',
      coordinates: { lat: 40.0, lng: -74.0 },
      fitScore: 85,
    });
    const markers = buildMarkers([prog]);
    expect(markers).toHaveLength(1);
    expect(markers[0].id).toBe('FM:10');
    expect(markers[0].band).toBe('high');
    expect(markers[0].lat).toBe(40.0);
    expect(markers[0].lng).toBe(-74.0);
  });

  it('fans out programs sharing identical coordinates', () => {
    const coords: Coordinates = { lat: 35.0, lng: -80.0 };
    const progA = makeScoredProgram({ id: 'FM:1', name: 'Alpha', coordinates: coords, fitScore: 75 });
    const progB = makeScoredProgram({ id: 'FM:2', name: 'Beta', coordinates: coords, fitScore: 50 });
    const progC = makeScoredProgram({ id: 'FM:3', name: 'Charlie', coordinates: coords, fitScore: 30 });

    const markers = buildMarkers([progA, progB, progC]);
    expect(markers).toHaveLength(3);

    // All markers should have distinct positions
    const positions = markers.map((m) => `${m.lat},${m.lng}`);
    const unique = new Set(positions);
    expect(unique.size).toBe(3);

    // None should be at the exact original coordinate
    for (const m of markers) {
      expect(m.lat === coords.lat && m.lng === coords.lng).toBe(false);
    }
  });

  it('fans out deterministically ordered by program name', () => {
    const coords: Coordinates = { lat: 42.0, lng: -71.0 };
    const progZ = makeScoredProgram({ id: 'FM:1', name: 'Zulu', coordinates: coords, fitScore: 60 });
    const progA = makeScoredProgram({ id: 'FM:2', name: 'Alpha', coordinates: coords, fitScore: 60 });

    // Regardless of input order, output positions should be the same
    const markers1 = buildMarkers([progZ, progA]);
    const markers2 = buildMarkers([progA, progZ]);

    // Find Alpha's marker in both runs
    const alpha1 = markers1.find((m) => m.id === 'FM:2')!;
    const alpha2 = markers2.find((m) => m.id === 'FM:2')!;
    expect(alpha1.lat).toBe(alpha2.lat);
    expect(alpha1.lng).toBe(alpha2.lng);

    // Find Zulu's marker in both runs
    const zulu1 = markers1.find((m) => m.id === 'FM:1')!;
    const zulu2 = markers2.find((m) => m.id === 'FM:1')!;
    expect(zulu1.lat).toBe(zulu2.lat);
    expect(zulu1.lng).toBe(zulu2.lng);
  });

  it('does not offset programs at different coordinates', () => {
    const progA = makeScoredProgram({
      id: 'FM:1',
      name: 'Prog A',
      coordinates: { lat: 30.0, lng: -90.0 },
      fitScore: 80,
    });
    const progB = makeScoredProgram({
      id: 'FM:2',
      name: 'Prog B',
      coordinates: { lat: 40.0, lng: -80.0 },
      fitScore: 50,
    });

    const markers = buildMarkers([progA, progB]);
    expect(markers).toHaveLength(2);
    // Each should be at their original coordinates (no co-location offset)
    const mA = markers.find((m) => m.id === 'FM:1')!;
    const mB = markers.find((m) => m.id === 'FM:2')!;
    expect(mA.lat).toBe(30.0);
    expect(mA.lng).toBe(-90.0);
    expect(mB.lat).toBe(40.0);
    expect(mB.lng).toBe(-80.0);
  });
});

describe('computeBounds', () => {
  it('returns null for an empty marker array', () => {
    expect(computeBounds([])).toBeNull();
  });

  it('returns tight bounds for a single marker', () => {
    const markers: MapMarker[] = [
      { id: 'FM:1', lat: 40.0, lng: -74.0, band: 'high' },
    ];
    const bounds = computeBounds(markers);
    expect(bounds).toEqual({
      southWest: { lat: 40.0, lng: -74.0 },
      northEast: { lat: 40.0, lng: -74.0 },
    });
  });

  it('computes tight bounds for multiple markers in the continental US', () => {
    const markers: MapMarker[] = [
      { id: 'FM:1', lat: 30.0, lng: -90.0, band: 'high' },
      { id: 'FM:2', lat: 45.0, lng: -70.0, band: 'medium' },
      { id: 'FM:3', lat: 35.0, lng: -120.0, band: 'low' },
    ];
    const bounds = computeBounds(markers);
    expect(bounds).toEqual({
      southWest: { lat: 30.0, lng: -120.0 },
      northEast: { lat: 45.0, lng: -70.0 },
    });
  });

  it('covers AK (high latitude) when present', () => {
    const markers: MapMarker[] = [
      { id: 'FM:1', lat: 40.0, lng: -90.0, band: 'high' },
      { id: 'FM:2', lat: 64.2, lng: -152.5, band: 'medium' }, // Fairbanks, AK
    ];
    const bounds = computeBounds(markers)!;
    expect(bounds.northEast.lat).toBe(64.2);
    expect(bounds.southWest.lng).toBe(-152.5);
  });

  it('covers HI (far-west longitude) when present', () => {
    const markers: MapMarker[] = [
      { id: 'FM:1', lat: 40.0, lng: -74.0, band: 'high' },
      { id: 'FM:2', lat: 21.3, lng: -157.8, band: 'low' }, // Honolulu, HI
    ];
    const bounds = computeBounds(markers)!;
    expect(bounds.southWest.lat).toBe(21.3);
    expect(bounds.southWest.lng).toBe(-157.8);
  });

  it('covers territories (e.g., Puerto Rico) when present', () => {
    const markers: MapMarker[] = [
      { id: 'FM:1', lat: 40.0, lng: -90.0, band: 'high' },
      { id: 'FM:2', lat: 18.2, lng: -66.5, band: 'medium' }, // San Juan, PR
    ];
    const bounds = computeBounds(markers)!;
    expect(bounds.southWest.lat).toBe(18.2);
    expect(bounds.northEast.lng).toBe(-66.5);
  });

  it('covers AK, HI, and continental US simultaneously', () => {
    const markers: MapMarker[] = [
      { id: 'FM:1', lat: 64.2, lng: -152.5, band: 'high' },   // AK
      { id: 'FM:2', lat: 21.3, lng: -157.8, band: 'medium' },  // HI
      { id: 'FM:3', lat: 40.7, lng: -74.0, band: 'low' },      // NYC
      { id: 'FM:4', lat: 18.2, lng: -66.5, band: 'unavailable' }, // PR
    ];
    const bounds = computeBounds(markers)!;
    // southWest: lowest lat (PR), most western lng (HI)
    expect(bounds.southWest.lat).toBe(18.2);
    expect(bounds.southWest.lng).toBe(-157.8);
    // northEast: highest lat (AK), most eastern lng (PR)
    expect(bounds.northEast.lat).toBe(64.2);
    expect(bounds.northEast.lng).toBe(-66.5);
  });
});
