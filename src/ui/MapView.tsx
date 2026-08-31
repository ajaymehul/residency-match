/**
 * MapView component: renders a react-leaflet map with program markers
 * color-coded by FitBand, major city markers with distinct DivIcon,
 * and handles selection/centering interactions.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 8.6, 8.7
 */

import { useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  Marker,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { useAppState } from './AppState';
import { CITIES_ATTRIBUTION } from '../core/cities-attribution';
import type { FitBand } from '../core/map-model';
import type { SignalTier } from '../core/signals';
import { SIGNAL_LABELS } from '../core/signals';

// --- Color scheme for fit bands ---
const BAND_COLORS: Record<FitBand, string> = {
  high: '#22c55e',       // green
  medium: '#f59e0b',     // amber/orange
  low: '#ef4444',        // red
  unavailable: '#9ca3af', // gray
};

// --- Signal tier colors for map stars ---
// gold/silver for IM tiers; a distinct violet for the FM flat signal.
const SIGNAL_COLORS: Record<SignalTier, string> = {
  gold: '#EAB308',   // gold
  silver: '#94A3B8', // silver/slate
  signal: '#8B5CF6', // violet (FM)
};

/** A colored star DivIcon for a signaled program. */
function createSignalIcon(tier: SignalTier, isSelected: boolean): L.DivIcon {
  const size = isSelected ? 30 : 22;
  const color = SIGNAL_COLORS[tier];
  // Blue outline when selected, otherwise a subtle dark outline for contrast.
  const stroke = isSelected ? '#1d4ed8' : 'rgba(0,0,0,0.45)';
  return L.divIcon({
    className: 'signal-marker',
    html: `<div style="
      font-size: ${size}px;
      line-height: 1;
      color: ${color};
      -webkit-text-stroke: ${isSelected ? 2 : 1}px ${stroke};
      text-stroke: ${isSelected ? 2 : 1}px ${stroke};
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));
    " aria-label="${SIGNAL_LABELS[tier]} signal">★</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const BAND_LABELS: Record<FitBand, string> = {
  high: 'High Fit',
  medium: 'Medium Fit',
  low: 'Low Fit',
  unavailable: 'Unavailable',
};

// --- Major City DivIcon (diamond shape for visual distinction) ---
function createMajorCityIcon(): L.DivIcon {
  return L.divIcon({
    className: 'major-city-marker',
    html: `<div style="
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      color: #6366f1;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
    " aria-label="Major City">◆</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

// --- Inner component that accesses the map instance ---
function MapController() {
  const { derived, selectedProgramId, techHubs: majorCities } = useAppState();
  const { bounds, markers } = derived;
  const map = useMap();
  const previousSelectedId = useRef<string | null>(null);

  // Initial fitBounds
  useEffect(() => {
    if (bounds) {
      map.fitBounds([
        [bounds.southWest.lat, bounds.southWest.lng],
        [bounds.northEast.lat, bounds.northEast.lng],
      ]);
    }
  }, [bounds, map]);

  // flyTo selected marker (Req 8.6, 8.7)
  useEffect(() => {
    if (
      selectedProgramId &&
      selectedProgramId !== previousSelectedId.current
    ) {
      const marker = markers.find((m) => m.id === selectedProgramId);
      if (marker) {
        try {
          map.flyTo([marker.lat, marker.lng], 10, { duration: 0.8 });
        } catch {
          // Highlight survives a centering failure (Req 8.7)
        }
      }
    }
    previousSelectedId.current = selectedProgramId;
  }, [selectedProgramId, markers, map]);

  return (
    <>
      {/* Major city markers */}
      {majorCities.map((city) => (
        <Marker
          key={`city-${city.name}`}
          position={[city.lat, city.lng]}
          icon={createMajorCityIcon()}
          interactive={true}
        >
          <Tooltip direction="top" offset={[0, -12]}>
            <span>🏢 {city.name}</span>
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}

// --- Program marker component ---
function ProgramMarkers() {
  const { derived, selectedProgramId, actions, signals } = useAppState();
  const { markers, sortedPrograms } = derived;

  return (
    <>
      {markers.map((marker) => {
        const isSelected = marker.id === selectedProgramId;
        const program = sortedPrograms.find((p) => p.id === marker.id);
        const programName = program?.name ?? marker.id;
        const tier = signals.get(marker.id);

        // Signaled programs render as a colored star (gold/silver/violet).
        if (tier) {
          return (
            <Marker
              key={marker.id}
              position={[marker.lat, marker.lng]}
              icon={createSignalIcon(tier, isSelected)}
              zIndexOffset={isSelected ? 1000 : 500}
              eventHandlers={{
                click: () => {
                  actions.setSelectedProgramId(marker.id);
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -12]}>
                <span>
                  ★ {programName} ({SIGNAL_LABELS[tier]} signal)
                </span>
              </Tooltip>
            </Marker>
          );
        }

        return (
          <CircleMarker
            key={marker.id}
            center={[marker.lat, marker.lng]}
            radius={isSelected ? 10 : 6}
            pathOptions={{
              color: isSelected ? '#1d4ed8' : BAND_COLORS[marker.band],
              fillColor: BAND_COLORS[marker.band],
              fillOpacity: isSelected ? 0.9 : 0.7,
              weight: isSelected ? 3 : 2,
            }}
            eventHandlers={{
              click: () => {
                actions.setSelectedProgramId(marker.id);
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <span>
                {programName} ({BAND_LABELS[marker.band]})
              </span>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}

// --- Main MapView component ---
export function MapView() {
  const { derived } = useAppState();
  const { bounds } = derived;

  // Default center: continental US
  const defaultCenter: [number, number] = [39.8283, -98.5795];
  const defaultZoom = 4;

  const initialBounds = bounds
    ? ([[bounds.southWest.lat, bounds.southWest.lng], [bounds.northEast.lat, bounds.northEast.lng]] as L.LatLngBoundsExpression)
    : undefined;

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        bounds={initialBounds}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController />
        <ProgramMarkers />
      </MapContainer>

      {/* Signal legend */}
      <div className="absolute top-2 right-2 bg-white/90 rounded-md shadow px-2.5 py-1.5 text-[10px] text-gray-600 z-[1000] leading-tight">
        <div className="font-semibold text-gray-700 mb-0.5">Signals</div>
        <div className="flex items-center gap-1">
          <span style={{ color: SIGNAL_COLORS.gold, WebkitTextStroke: '0.5px rgba(0,0,0,0.45)' }}>★</span> Gold (IM)
        </div>
        <div className="flex items-center gap-1">
          <span style={{ color: SIGNAL_COLORS.silver, WebkitTextStroke: '0.5px rgba(0,0,0,0.45)' }}>★</span> Silver (IM)
        </div>
        <div className="flex items-center gap-1">
          <span style={{ color: SIGNAL_COLORS.signal, WebkitTextStroke: '0.5px rgba(0,0,0,0.45)' }}>★</span> Signal (FM)
        </div>
      </div>

      {/* CC BY 4.0 cities attribution — subtle inline */}
      <div className="absolute bottom-0 left-0 right-0 bg-white/80 px-2 py-0.5 text-[10px] text-gray-500 z-[1000]">
        {CITIES_ATTRIBUTION}
      </div>
    </div>
  );
}
