/**
 * Default Tech Hub configuration and scoring weights.
 *
 * Tech hubs are US metropolitan areas with significant technology industry
 * presence. The proximity sub-score measures how close a residency program
 * is to the nearest hub (Requirement 6.1).
 *
 * Default weights define the composite Fit_Score formula (Requirement 7.2).
 */

import type { TechHub, Weights } from './types';

/**
 * Default list of US tech hubs with approximate metro-center coordinates.
 * Requirement 6.1: configurable list with name and coordinates.
 */
export const DEFAULT_TECH_HUBS: TechHub[] = [
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

/**
 * Default sub-score weights for the composite Fit_Score.
 * Requirement 7.2: 40% Step2_Fit, 40% IMG_Friendliness, 20% Tech_Hub_Proximity.
 */
export const DEFAULT_WEIGHTS: Weights = {
  step2: 0.4,
  img: 0.4,
  proximity: 0.2,
};
