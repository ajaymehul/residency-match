import { describe, it, expect } from 'vitest';
import { haversineMiles, nearestTechHub } from '../scoring';
import type { TechHub } from '../types';

describe('haversineMiles', () => {
  it('returns 0 for identical coordinates', () => {
    const coord = { lat: 37.7749, lng: -122.4194 };
    expect(haversineMiles(coord, coord)).toBe(0);
  });

  it('computes a known distance between SF and NYC', () => {
    const sf = { lat: 37.7749, lng: -122.4194 };
    const nyc = { lat: 40.7128, lng: -74.006 };
    const distance = haversineMiles(sf, nyc);
    // Known distance SF to NYC is approximately 2,569 miles
    expect(distance).toBeGreaterThan(2550);
    expect(distance).toBeLessThan(2590);
  });

  it('computes a known distance between Seattle and Austin', () => {
    const seattle = { lat: 47.6062, lng: -122.3321 };
    const austin = { lat: 30.2672, lng: -97.7431 };
    const distance = haversineMiles(seattle, austin);
    // Known distance Seattle to Austin is approximately 1,770 miles
    expect(distance).toBeGreaterThan(1750);
    expect(distance).toBeLessThan(1800);
  });

  it('is symmetric (distance a→b equals b→a)', () => {
    const a = { lat: 33.749, lng: -84.388 }; // Atlanta
    const b = { lat: 41.8781, lng: -87.6298 }; // Chicago
    expect(haversineMiles(a, b)).toBeCloseTo(haversineMiles(b, a), 10);
  });
});

describe('nearestTechHub', () => {
  const hubs: TechHub[] = [
    { name: 'SF Bay Area', lat: 37.7749, lng: -122.4194 },
    { name: 'Seattle', lat: 47.6062, lng: -122.3321 },
    { name: 'NYC', lat: 40.7128, lng: -74.006 },
  ];

  it('returns the closest hub when the coordinate matches a hub exactly', () => {
    const coords = { lat: 47.6062, lng: -122.3321 }; // Seattle
    const result = nearestTechHub(coords, hubs);
    expect(result.hub.name).toBe('Seattle');
    expect(result.distance).toBe(0);
  });

  it('returns the closest hub for a point near SF', () => {
    // San Jose is closest to SF Bay Area
    const sanJose = { lat: 37.3382, lng: -121.8863 };
    const result = nearestTechHub(sanJose, hubs);
    expect(result.hub.name).toBe('SF Bay Area');
    expect(result.distance).toBeLessThan(50);
  });

  it('returns the closest hub for a point near NYC', () => {
    // Philadelphia is closest to NYC from the given hubs
    const philadelphia = { lat: 39.9526, lng: -75.1652 };
    const result = nearestTechHub(philadelphia, hubs);
    expect(result.hub.name).toBe('NYC');
    expect(result.distance).toBeLessThan(100);
  });

  it('returns a non-negative distance', () => {
    const coords = { lat: 25.7617, lng: -80.1918 }; // Miami
    const result = nearestTechHub(coords, hubs);
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });

  it('works with a single hub', () => {
    const singleHub: TechHub[] = [{ name: 'Austin', lat: 30.2672, lng: -97.7431 }];
    const coords = { lat: 32.7767, lng: -96.797 }; // Dallas
    const result = nearestTechHub(coords, singleHub);
    expect(result.hub.name).toBe('Austin');
    expect(result.distance).toBeGreaterThan(0);
  });
});
