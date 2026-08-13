/**
 * Default Major City configuration and scoring weights.
 *
 * Major cities are US metropolitan areas where the applicant's partner
 * could find tech employment. The proximity sub-score measures how close
 * a residency program is to the nearest major city.
 */

import type { MajorCity, Weights } from './types';

/**
 * Default list of US major cities with approximate metro-center coordinates.
 */
export const DEFAULT_MAJOR_CITIES: MajorCity[] = [
  { name: 'SF Bay Area', lat: 37.7749, lng: -122.4194 },
  { name: 'Seattle', lat: 47.6062, lng: -122.3321 },
  { name: 'Austin', lat: 30.2672, lng: -97.7431 },
  { name: 'NYC', lat: 40.7128, lng: -74.006 },
  { name: 'Boston', lat: 42.3601, lng: -71.0589 },
  { name: 'Denver', lat: 39.7392, lng: -104.9903 },
  { name: 'Raleigh-Durham', lat: 35.7796, lng: -78.6382 },
  { name: 'Atlanta', lat: 33.749, lng: -84.388 },
  { name: 'Dallas', lat: 32.7767, lng: -96.797 },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { name: 'LA', lat: 34.0522, lng: -118.2437 },
  { name: 'San Diego', lat: 32.7157, lng: -117.1611 },
  { name: 'Washington DC', lat: 38.9072, lng: -77.0369 },
  { name: 'Phoenix', lat: 33.4484, lng: -112.074 },
  { name: 'Salt Lake City', lat: 40.7608, lng: -111.891 },
];

// Keep old name as alias for backward compatibility during migration
export const DEFAULT_TECH_HUBS = DEFAULT_MAJOR_CITIES;

/**
 * Default sub-score weights for the composite Fit_Score.
 */
export const DEFAULT_WEIGHTS: Weights = {
  step2: 0.4,
  img: 0.4,
  proximity: 0.2,
};
