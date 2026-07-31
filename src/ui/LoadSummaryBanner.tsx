/**
 * LoadSummaryBanner - A collapsible banner displaying data loading results.
 *
 * Shows: total programs loaded per specialty, geocoded/unmapped counts,
 * and (when expanded) excluded row details and failed-sheet notices.
 *
 * Requirements: 1.6, 1.7, 2.4
 */

import { useState } from 'react';
import { useAppState } from './AppState';

export function LoadSummaryBanner() {
  const { loadSummary } = useAppState();
  const [expanded, setExpanded] = useState(false);

  const { loadedBySpecialty, excludedRows, geocodedCount, unmappedCount } = loadSummary;

  const totalLoaded = Object.values(loadedBySpecialty).reduce((sum, n) => sum + n, 0);

  // Separate failed-sheet notices (rowNumber === 0) from regular excluded rows
  const failedSheets = excludedRows.filter((r) => r.rowNumber === 0);
  const excludedDataRows = excludedRows.filter((r) => r.rowNumber !== 0);

  return (
    <div className="flex-shrink-0 bg-brand-rose/20 px-4 py-2 text-sm" role="region" aria-label="Load summary">
      <div
        className="flex justify-between items-center cursor-pointer select-none"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <p className="m-0 text-brand-indigo font-medium text-xs">
          Loaded {totalLoaded} programs ({Object.entries(loadedBySpecialty).map(
            ([specialty, count]) => `${specialty}: ${count}`
          ).join(', ')}) — Geocoded: {geocodedCount}, Unmapped: {unmappedCount}
          {excludedRows.length > 0 && ` — ${excludedRows.length} excluded`}
        </p>
        <button
          className="text-xs text-brand-indigo bg-transparent border border-brand-rose rounded px-2 py-0.5 cursor-pointer hover:bg-brand-rose/30 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((prev) => !prev);
          }}
          aria-label={expanded ? 'Collapse details' : 'Expand details'}
        >
          {expanded ? '▲ Less' : '▼ More'}
        </button>
      </div>

      {expanded && (
        <div className="mt-2.5 pt-2.5 border-t border-brand-rose/40">
          {/* Failed sheets section */}
          {failedSheets.length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-semibold text-brand-indigo mb-1">Failed Sheets</div>
              {failedSheets.map((fs, i) => (
                <div key={i} className="bg-red-50 border border-red-200 rounded px-2.5 py-1.5 text-xs text-red-700 mb-1">
                  <strong>{fs.sheetName}</strong>: {fs.reason}
                </div>
              ))}
            </div>
          )}

          {/* Per-specialty breakdown */}
          <div className="mb-2">
            <div className="text-xs font-semibold text-brand-indigo mb-1">Programs by Specialty</div>
            <ul className="my-1 pl-5 text-xs text-gray-700 space-y-0.5">
              {Object.entries(loadedBySpecialty).map(([specialty, count]) => (
                <li key={specialty}>
                  {specialty}: {count} programs
                </li>
              ))}
            </ul>
          </div>

          {/* Geocoding counts */}
          <div className="mb-2">
            <div className="text-xs font-semibold text-brand-indigo mb-1">Geocoding</div>
            <ul className="my-1 pl-5 text-xs text-gray-700 space-y-0.5">
              <li>Successfully geocoded: {geocodedCount}</li>
              <li>Unmapped (location not resolved): {unmappedCount}</li>
            </ul>
          </div>

          {/* Excluded rows table */}
          {excludedDataRows.length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-semibold text-brand-indigo mb-1">
                Excluded Rows ({excludedDataRows.length})
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="text-left px-2 py-1 border-b border-brand-rose/40 text-brand-indigo font-semibold">Sheet</th>
                      <th className="text-left px-2 py-1 border-b border-brand-rose/40 text-brand-indigo font-semibold">Row</th>
                      <th className="text-left px-2 py-1 border-b border-brand-rose/40 text-brand-indigo font-semibold">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excludedDataRows.map((row, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1 border-b border-gray-100 text-gray-700">{row.sheetName}</td>
                        <td className="px-2 py-1 border-b border-gray-100 text-gray-700">{row.rowNumber}</td>
                        <td className="px-2 py-1 border-b border-gray-100 text-gray-700">{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
