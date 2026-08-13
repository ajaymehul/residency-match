/**
 * ListView - A sortable table displaying scored residency programs.
 *
 * Columns: name, specialty, city, state, Fit_Score, Step2_Fit,
 * IMG_Friendliness, Tech_Hub_Proximity, nearest Tech_Hub distance.
 *
 * Features:
 * - Clickable column headers toggle sort direction or change sort column
 * - Unmapped programs show a visual indicator
 * - Programs with all scores unavailable show "insufficient data"
 * - Row click selects the program (highlighted row)
 * - Numeric scores formatted to 1 decimal place
 * - UNAVAILABLE sub-scores displayed as "N/A"
 *
 * Requirements: 2.3, 7.5, 8.4, 8.5, 8.6
 */

import { useAppState } from './AppState';
import { UNAVAILABLE, type ScoredProgram, type SortColumn, type SubScore } from '../core/types';

/** Format a SubScore for display: number → 1 decimal place, UNAVAILABLE → "N/A" */
function formatScore(score: SubScore): string {
  if (score === UNAVAILABLE) return 'N/A';
  return score.toFixed(1);
}

/** Format nearest hub distance: number → "X mi", null → "N/A" */
function formatDistance(hub: ScoredProgram['nearestHub']): string {
  if (hub === null) return 'N/A';
  return `${hub.distanceMiles.toFixed(1)} mi`;
}

/** Check if all sub-scores are unavailable (insufficient data) */
function isInsufficientData(program: ScoredProgram): boolean {
  return (
    program.step2Fit === UNAVAILABLE &&
    program.imgFriendliness === UNAVAILABLE &&
    program.techHubProximity === UNAVAILABLE
  );
}

/** Column definitions for the list view */
const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'name', label: 'Program' },
  { key: 'specialty', label: 'Spec.' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'matchScore', label: 'Match Score' },
  { key: 'imgFriendliness', label: 'US IMG Int. Rate' },
  { key: 'techHubProximity', label: 'City Prox.' },
  { key: 'techHubDistance', label: 'Nearest City' },
];

export function ListView() {
  const {
    sortColumn,
    sortDirection,
    selectedProgramId,
    derived: { sortedPrograms },
    actions: { setSortColumn, setSortDirection, setSelectedProgramId, toggleFavorite, isFavorite },
  } = useAppState();

  /** Handle column header click: toggle direction if same column, else switch column */
  function handleSort(column: SortColumn) {
    if (column === sortColumn) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  }

  /** Handle row click: select the program */
  function handleRowClick(programId: string) {
    setSelectedProgramId(programId);
  }

  /** Render the sort direction indicator for a column header */
  function renderSortIndicator(column: SortColumn): string {
    if (column !== sortColumn) return '';
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  }

  /** Render the cell value for a given column */
  function renderCell(program: ScoredProgram, column: SortColumn): React.ReactNode {
    switch (column) {
      case 'name':
        return (
          <span>
            {program.name}
            {program.unmapped && (
              <span className="ml-1.5 inline-block text-[11px] bg-yellow-100 border border-yellow-400 rounded px-1 py-px text-yellow-800" title="Location not mapped">
                unmapped
              </span>
            )}
            {isInsufficientData(program) && (
              <span className="ml-1.5 inline-block text-[11px] bg-red-100 border border-red-300 rounded px-1 py-px text-red-800" title="All scores unavailable">
                insufficient data
              </span>
            )}
          </span>
        );
      case 'specialty':
        return program.specialty;
      case 'city':
        return program.city;
      case 'state':
        return program.state;
      case 'fitScore':
        return formatScore(program.fitScore);
      case 'matchScore':
        return program.matchScore !== null ? program.matchScore.toFixed(0) : '—';
      case 'step2Fit':
        return formatScore(program.step2Fit);
      case 'imgFriendliness':
        return formatScore(program.imgFriendliness);
      case 'techHubProximity':
        return formatScore(program.techHubProximity);
      case 'techHubDistance':
        return formatDistance(program.nearestHub);
      default:
        return '';
    }
  }

  if (sortedPrograms.length === 0) {
    return (
      <div className="text-xs overflow-x-auto">
        <div className="p-6 text-center text-gray-500">No programs match the current filters.</div>
      </div>
    );
  }

  return (
    <div className="text-xs overflow-x-auto" role="region" aria-label="Program list">
      <table className="w-full border-collapse min-w-[900px]">
        <thead>
          <tr>
            <th className="sticky top-0 z-10 px-2.5 py-2 text-center bg-brand-indigo text-white text-xs font-semibold whitespace-nowrap w-8" aria-label="Favorite">
              ★
            </th>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className="sticky top-0 z-10 px-2.5 py-2 text-left bg-brand-indigo text-white text-xs font-semibold whitespace-nowrap cursor-pointer select-none hover:bg-brand-purple transition-colors"
                onClick={() => handleSort(col.key)}
                aria-sort={
                  col.key === sortColumn
                    ? sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                {col.label}
                <span className="ml-1 text-[11px]">
                  {renderSortIndicator(col.key)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedPrograms.map((program, index) => {
            const isSelected = program.id === selectedProgramId;
            const favorited = isFavorite(program.id);
            const rowBg = isSelected
              ? 'bg-brand-purple/10 border-l-2 border-l-brand-purple'
              : index % 2 === 0
                ? 'bg-white'
                : 'bg-brand-rose/5';
            return (
              <tr
                key={program.id}
                className={`cursor-pointer transition-colors hover:bg-brand-rose/10 ${rowBg}`}
                onClick={() => handleRowClick(program.id)}
                aria-selected={isSelected}
              >
                <td className="px-2.5 py-1.5 text-center w-8 border-b border-gray-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(program.id);
                    }}
                    className={`bg-transparent border-none cursor-pointer text-base p-0.5 ${favorited ? 'text-brand-mauve' : 'text-gray-300'}`}
                    aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
                    title={favorited ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {favorited ? '★' : '☆'}
                  </button>
                </td>
                {COLUMNS.map((col) => (
                  <td key={col.key} className="px-2.5 py-1.5 border-b border-gray-100 text-gray-800">
                    {renderCell(program, col.key)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
