/**
 * Map model utilities: fit-band classification, marker construction,
 * and bounds computation for the Leaflet map layer.
 *
 * Requirements: 3.1, 3.3, 3.4, 3.5
 */

import { UNAVAILABLE, type SubScore, type ScoredProgram, type Coordinates } from './types';

/** Tight bounding box containing a set of geographic points. */
export interface LatLngBounds {
  southWest: Coordinates;
  northEast: Coordinates;
}

/** Classification band for color-coding map markers by Fit_Score. */
export type FitBand = 'high' | 'medium' | 'low' | 'unavailable';

/** A map marker carrying the program's id, position, and visual band. */
export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  band: FitBand;
}

/**
 * Classify a Fit_Score into a visual band.
 *
 * - high: score >= 70
 * - medium: 40 <= score < 70
 * - low: score < 40
 * - unavailable: UNAVAILABLE sentinel
 *
 * Requirements: 3.4
 */
export function fitBand(score: SubScore): FitBand {
  if (score === UNAVAILABLE) {
    return 'unavailable';
  }
  if (score >= 50) {
    return 'high';
  }
  if (score >= 30) {
    return 'medium';
  }
  return 'low';
}

/**
 * Build one MapMarker per geocoded (non-unmapped) program. Programs sharing
 * identical coordinates are fanned out deterministically on a small circle
 * (~0.6 mile radius ≈ 0.01 degrees), ordered alphabetically by program name.
 *
 * Requirements: 3.1, 3.5
 */
export function buildMarkers(programs: ScoredProgram[]): MapMarker[] {
  // Filter to only geocoded programs (non-unmapped with coordinates)
  const geocoded = programs.filter(
    (p): p is ScoredProgram & { coordinates: Coordinates } =>
      !p.unmapped && p.coordinates !== null
  );

  // Group programs by their coordinate key (exact lat/lng match)
  const groups = new Map<string, (ScoredProgram & { coordinates: Coordinates })[]>();
  for (const program of geocoded) {
    const key = `${program.coordinates.lat},${program.coordinates.lng}`;
    const group = groups.get(key);
    if (group) {
      group.push(program);
    } else {
      groups.set(key, [program]);
    }
  }

  const markers: MapMarker[] = [];

  // Radius of the fan-out circle in degrees (~0.6 miles ≈ 0.01 degrees)
  const OFFSET_RADIUS = 0.01;

  for (const group of groups.values()) {
    if (group.length === 1) {
      // Single program at this location — no offset needed
      const p = group[0];
      markers.push({
        id: p.id,
        lat: p.coordinates.lat,
        lng: p.coordinates.lng,
        band: fitBand(p.fitScore),
      });
    } else {
      // Multiple programs share coordinates — fan out deterministically
      // Sort alphabetically by program name for deterministic ordering
      const sorted = [...group].sort((a, b) => a.name.localeCompare(b.name));
      const count = sorted.length;
      for (let i = 0; i < count; i++) {
        const angle = (2 * Math.PI * i) / count;
        const p = sorted[i];
        markers.push({
          id: p.id,
          lat: p.coordinates.lat + OFFSET_RADIUS * Math.cos(angle),
          lng: p.coordinates.lng + OFFSET_RADIUS * Math.sin(angle),
          band: fitBand(p.fitScore),
        });
      }
    }
  }

  return markers;
}

/**
 * Compute the tight bounding box containing every marker's coordinates.
 * Returns null for an empty marker array. The result covers markers in
 * AK (high latitude), HI (far-west longitude), and US territories when present.
 *
 * Used by the React-Leaflet map to call `fitBounds()` for the initial view.
 *
 * Requirements: 3.3
 */
export function computeBounds(markers: MapMarker[]): LatLngBounds | null {
  if (markers.length === 0) {
    return null;
  }

  let minLat = markers[0].lat;
  let maxLat = markers[0].lat;
  let minLng = markers[0].lng;
  let maxLng = markers[0].lng;

  for (let i = 1; i < markers.length; i++) {
    const { lat, lng } = markers[i];
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  return {
    southWest: { lat: minLat, lng: minLng },
    northEast: { lat: maxLat, lng: maxLng },
  };
}
