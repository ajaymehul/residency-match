/**
 * App component: orchestrates the startup sequence and application layout.
 *
 * Startup flow:
 * 1. Fetch Programs.xlsx as ArrayBuffer
 * 2. Parse with XLSX.read → parseWorkbook
 * 3. Geocode with geocodeAllWithSummary
 * 4. Populate AppStateProvider with programs and summary
 *
 * Layout: Full-height page with header, LoadSummaryBanner, and a main area
 * split into FilterPanel (left), MapView + ListView (center), ProgramDetail (right).
 *
 * Error state: full-screen error with fetch path and retry button.
 * Loading state: centered "Loading..." indicator.
 *
 * Requirements: 1.1, 2.4, 3.1, 8.2
 */

import { useCallback, useEffect, useState } from 'react';

import { loadScrapedPrograms } from '../core/scraped-data-loader';
import type { ScrapedProgram } from '../core/scraped-data-loader';
import type { GeocodedProgram, LoadSummary } from '../core/types';
import type { CityDataset } from '../core/geocoder';
import citiesDataset from '../core/us-cities.json';

import { AppStateProvider, useAppState } from './AppState';
import { LoadSummaryBanner } from './LoadSummaryBanner';
import { MapView } from './MapView';
import { ListView } from './ListView';
import { FilterPanel } from './FilterPanel';
import { ProgramDetail } from './ProgramDetail';

/** Fetch paths for program data JSON files. */
const FM_DATA_PATH = `${import.meta.env.BASE_URL}program_data.json`;
const IM_DATA_PATH = `${import.meta.env.BASE_URL}program_data_im.json`;

type AppStatus =
  | { kind: 'loading' }
  | { kind: 'error'; path: string; message: string }
  | { kind: 'ready'; programs: GeocodedProgram[]; summary: LoadSummary };

function App() {
  const [status, setStatus] = useState<AppStatus>({ kind: 'loading' });

  const loadData = useCallback(async () => {
    setStatus({ kind: 'loading' });

    try {
      // Load both FM and IM data in parallel
      const [fmResponse, imResponse] = await Promise.all([
        fetch(FM_DATA_PATH),
        fetch(IM_DATA_PATH),
      ]);

      if (!fmResponse.ok) throw new Error(`FM data: HTTP ${fmResponse.status}`);
      if (!imResponse.ok) throw new Error(`IM data: HTTP ${imResponse.status}`);

      const [fmRaw, imRaw]: [ScrapedProgram[], ScrapedProgram[]] = await Promise.all([
        fmResponse.json(),
        imResponse.json(),
      ]);

      // Load FM programs
      const fmResult = loadScrapedPrograms(fmRaw, citiesDataset as unknown as CityDataset, 'Family Medicine');
      // Load IM programs
      const imResult = loadScrapedPrograms(imRaw, citiesDataset as unknown as CityDataset, 'Internal Medicine');

      // Combine
      const allPrograms = [...fmResult.programs, ...imResult.programs];
      const summary: LoadSummary = {
        loadedBySpecialty: {
          'Family Medicine': fmResult.programs.length,
          'Internal Medicine': imResult.programs.length,
        },
        excludedRows: [],
        geocodedCount: fmResult.summary.geocodedCount + imResult.summary.geocodedCount,
        unmappedCount: fmResult.summary.unmappedCount + imResult.summary.unmappedCount,
      };

      setStatus({ kind: 'ready', programs: allPrograms, summary });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ kind: 'error', path: 'program data', message });
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (status.kind === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-serif font-semibold text-brand-indigo mb-3">
            Residency Match
          </h1>
          <p className="text-gray-500">Loading program data...</p>
        </div>
      </div>
    );
  }

  if (status.kind === 'error') {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50">
        <div className="text-center max-w-md p-8">
          <h1 className="text-2xl font-serif font-semibold text-red-600 mb-4">
            Failed to Load Data
          </h1>
          <p className="mb-2">
            Could not fetch{' '}
            <code className="bg-red-100 px-1.5 py-0.5 rounded text-sm">{status.path}</code>
          </p>
          <p className="text-gray-500 text-sm mb-6">{status.message}</p>
          <button
            onClick={loadData}
            type="button"
            className="px-6 py-2.5 bg-brand-purple text-white rounded-md hover:bg-brand-indigo transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppStateProvider>
      <AppLayout programs={status.programs} summary={status.summary} />
    </AppStateProvider>
  );
}

/**
 * Inner layout component that lives inside AppStateProvider
 * and populates the state on mount.
 */
function AppLayout({ programs, summary }: { programs: GeocodedProgram[]; summary: LoadSummary }) {
  const { actions } = useAppState();

  useEffect(() => {
    actions.setPrograms(programs);
    actions.setLoadSummary(summary);
  }, [programs, summary, actions]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="flex-shrink-0 bg-brand-indigo px-4 py-2.5">
        <h1 className="text-white font-sans text-xl font-bold tracking-tight m-0">
          Residency Match
        </h1>
      </header>

      <LoadSummaryBanner />

      <main className="flex flex-1 overflow-hidden">
        <aside className="w-[280px] flex-shrink-0 overflow-y-auto border-r border-brand-rose/30 p-3">
          <FilterPanel />
        </aside>

        <section className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-[300px]">
            <MapView />
          </div>
          <div className="h-[40%] overflow-y-auto border-t border-brand-rose/30">
            <ListView />
          </div>
        </section>

        <aside className="w-[320px] flex-shrink-0 overflow-y-auto border-l border-brand-rose/30 p-3">
          <ProgramDetail />
        </aside>
      </main>
    </div>
  );
}

export default App;
