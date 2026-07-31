/**
 * Scoring module for the Residency Program Explorer.
 *
 * Contains haversine distance calculation, nearest tech hub lookup,
 * and sub-score/composite score functions.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 6.2, 6.3, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5
 */

import type { Coordinates, FieldValue, GeocodedProgram, ScoreRange, ScoredProgram, TechHub, Weights } from './types';
import { UNAVAILABLE } from './types';
import type { SubScore } from './types';
import { DEFAULT_WEIGHTS } from './tech-hubs';

/** Earth's mean radius in miles. */
const EARTH_RADIUS_MILES = 3958.8;

/**
 * Compute the great-circle distance in miles between two coordinates
 * using the haversine formula.
 */
export function haversineMiles(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const aLat = toRad(a.lat);
  const bLat = toRad(b.lat);

  const havLat = Math.sin(dLat / 2) ** 2;
  const havLng = Math.sin(dLng / 2) ** 2;

  const h = havLat + Math.cos(aLat) * Math.cos(bLat) * havLng;

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

/**
 * Find the nearest tech hub to the given coordinates.
 * Returns the hub with the minimum haversine distance and that distance in miles.
 *
 * Precondition: `hubs` must be non-empty.
 */
export function nearestTechHub(
  coords: Coordinates,
  hubs: TechHub[],
): { hub: TechHub; distance: number } {
  let minDistance = Infinity;
  let nearest: TechHub = hubs[0];

  for (const hub of hubs) {
    const d = haversineMiles(coords, { lat: hub.lat, lng: hub.lng });
    if (d < minDistance) {
      minDistance = d;
      nearest = hub;
    }
  }

  return { hub: nearest, distance: minDistance };
}


/**
 * Compute the IMG_Friendliness sub-score from a program's US IMG acceptance rate.
 *
 * Formula: clamp(rate, 0, 1) × 100
 * Returns UNAVAILABLE when the rate is missing or invalid.
 *
 * Requirements: 5.1, 5.2
 */
export function imgFriendliness(rate: FieldValue<number>): SubScore {
  if (rate.kind !== 'present') {
    return UNAVAILABLE;
  }

  return Math.min(Math.max(rate.value, 0), 1) * 100;
}

/**
 * Compute the Tech_Hub_Proximity sub-score from the distance to the nearest tech hub.
 *
 * Formula: max(0, 100 × (1 − d / 150))
 * - At distance 0 → 100
 * - At distance 150 → 0
 * - At distance > 150 → 0
 *
 * Returns UNAVAILABLE for unmapped programs (null distance).
 *
 * Requirements: 6.3, 6.5
 */
export function techHubProximity(distanceMiles: number | null): SubScore {
  if (distanceMiles === null) {
    return UNAVAILABLE;
  }

  return Math.max(0, 100 * (1 - distanceMiles / 150));
}

/**
 * Compute the Step2_Fit sub-score for an applicant score against a program's
 * Step 2 CK score range.
 *
 * Formula (with mid = (low + high) / 2):
 * - score >= mid → 100
 * - low <= score < mid → linear interpolation from 70 (at low) to 100 (at mid)
 * - score < low → max(0, 70 × (1 − (low − score) / 30))
 *
 * Returns UNAVAILABLE when the range is missing or invalid.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
export function step2Fit(applicantScore: number, range: FieldValue<ScoreRange>): SubScore {
  if (range.kind !== 'present') {
    return UNAVAILABLE;
  }

  const { low, high } = range.value;
  const mid = (low + high) / 2;

  if (applicantScore >= mid) {
    return 100;
  }

  if (applicantScore >= low) {
    // Linear interpolation from 70 (at low) to 100 (at mid)
    return 70 + ((applicantScore - low) / (mid - low)) * 30;
  }

  // Below the low bound: decreases with the gap, reaching 0 at 30+ points below
  return Math.max(0, 70 * (1 - (low - applicantScore) / 30));
}

/**
 * Determine the applicant's score position relative to a program's score range.
 *
 * - "below" if the applicant score is strictly less than the range's low bound
 * - "above" if the applicant score is strictly greater than the range's high bound
 * - "within" if the score is between low and high (inclusive)
 * - null if the range is missing or invalid (position cannot be determined)
 *
 * Requirements: 9.4
 */
export function scorePosition(
  applicantScore: number,
  range: FieldValue<ScoreRange>,
): 'below' | 'within' | 'above' | null {
  if (range.kind !== 'present') {
    return null;
  }

  const { low, high } = range.value;

  if (applicantScore < low) {
    return 'below';
  }

  if (applicantScore > high) {
    return 'above';
  }

  return 'within';
}


/**
 * Compute the composite Fit_Score as a weighted mean over available sub-scores.
 *
 * - Weights are renormalized to sum to 1 over the available (non-UNAVAILABLE) subset.
 * - If all three sub-scores are UNAVAILABLE, returns UNAVAILABLE.
 * - Defensively treats all-zero weights as DEFAULT_WEIGHTS.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
export function fitScore(
  subScores: { step2: SubScore; img: SubScore; proximity: SubScore },
  weights: Weights,
): SubScore {
  // Defensively treat all-zero weights as default weights
  const w =
    weights.step2 === 0 && weights.img === 0 && weights.proximity === 0
      ? DEFAULT_WEIGHTS
      : weights;

  // Collect available sub-scores with their corresponding weights
  const available: { score: number; weight: number }[] = [];

  if (subScores.step2 !== UNAVAILABLE) {
    available.push({ score: subScores.step2, weight: w.step2 });
  }
  if (subScores.img !== UNAVAILABLE) {
    available.push({ score: subScores.img, weight: w.img });
  }
  if (subScores.proximity !== UNAVAILABLE) {
    available.push({ score: subScores.proximity, weight: w.proximity });
  }

  // All three unavailable → UNAVAILABLE
  if (available.length === 0) {
    return UNAVAILABLE;
  }

  // Renormalize weights to sum to 1 over the available subset
  const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);

  // Edge case: if available weights sum to 0 (shouldn't happen after the
  // all-zero guard above, but be defensive), use equal weights
  if (totalWeight === 0) {
    const equalWeight = 1 / available.length;
    return available.reduce((sum, item) => sum + item.score * equalWeight, 0);
  }

  return available.reduce(
    (sum, item) => sum + item.score * (item.weight / totalWeight),
    0,
  );
}

/**
 * Assemble a fully scored program from a geocoded program, applicant score,
 * weights, and tech hub list.
 *
 * Computes:
 * - nearestHub (if program has coordinates, otherwise null)
 * - Each sub-score (step2Fit, imgFriendliness, techHubProximity)
 * - fitScore from the three sub-scores and weights
 * - availability flags (true if sub-score is not UNAVAILABLE)
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
export function scoreProgram(
  program: GeocodedProgram,
  applicantScore: number,
  weights: Weights,
  hubs: TechHub[],
): ScoredProgram {
  // Compute nearest hub (only if program has coordinates)
  let nearestHubResult: { name: string; distanceMiles: number } | null = null;
  let distanceForProximity: number | null = null;

  if (program.coordinates !== null && hubs.length > 0) {
    const { hub, distance } = nearestTechHub(program.coordinates, hubs);
    nearestHubResult = { name: hub.name, distanceMiles: distance };
    distanceForProximity = distance;
  }

  // Compute sub-scores
  const step2FitScore = step2Fit(applicantScore, program.step2Range);
  const imgFriendlinessScore = imgFriendliness(program.usImgRate);
  const techHubProximityScore = techHubProximity(distanceForProximity);

  // Compute composite fit score
  const compositeFitScore = fitScore(
    {
      step2: step2FitScore,
      img: imgFriendlinessScore,
      proximity: techHubProximityScore,
    },
    weights,
  );

  // Set availability flags
  const availability = {
    step2: step2FitScore !== UNAVAILABLE,
    img: imgFriendlinessScore !== UNAVAILABLE,
    proximity: techHubProximityScore !== UNAVAILABLE,
  };

  return {
    ...program,
    step2Fit: step2FitScore,
    imgFriendliness: imgFriendlinessScore,
    techHubProximity: techHubProximityScore,
    nearestHub: nearestHubResult,
    fitScore: compositeFitScore,
    availability,
  };
}
