/**
 * ExportButton — exports favorited programs as a CSV download.
 *
 * Columns: Name, Specialty, City, State, Region, Step2 Range, Fit Score,
 * Step2 Fit, IMG Friendliness, Tech Hub Proximity, Nearest Hub, Distance (mi), URL.
 */

import { useAppState } from './AppState';
import { UNAVAILABLE } from '../core/types';
import type { FieldValue, ScoreRange, SubScore, ScoredProgram } from '../core/types';

/** Format a SubScore for CSV: number → fixed 1 decimal, UNAVAILABLE → "N/A" */
function formatSubScoreCsv(score: SubScore): string {
  if (score === UNAVAILABLE) return 'N/A';
  return score.toFixed(1);
}

/** Format a FieldValue<ScoreRange> for CSV: "low-high" or "N/A" */
function formatScoreRangeCsv(field: FieldValue<ScoreRange> | undefined): string {
  if (!field || field.kind !== 'present') return 'N/A';
  return `${field.value.low}-${field.value.high}`;
}

/** Escape a CSV field: wrap in quotes if it contains commas, quotes, or newlines. */
function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Generate a CSV row from a ScoredProgram. */
function programToCsvRow(program: ScoredProgram): string {
  const fields = [
    program.name,
    program.specialty,
    program.city,
    program.state,
    program.region,
    formatScoreRangeCsv(program.step2Range),
    formatSubScoreCsv(program.fitScore),
    formatSubScoreCsv(program.step2Fit),
    formatSubScoreCsv(program.imgFriendliness),
    formatSubScoreCsv(program.techHubProximity),
    program.nearestHub?.name ?? 'N/A',
    program.nearestHub ? program.nearestHub.distanceMiles.toFixed(1) : 'N/A',
    program.url ?? '',
  ];
  return fields.map(escapeCsv).join(',');
}

export function ExportButton() {
  const { favorites, derived } = useAppState();

  const handleExport = () => {
    const favoritedPrograms = derived.scoredPrograms.filter((p) =>
      favorites.has(p.id),
    );

    if (favoritedPrograms.length === 0) {
      alert('No favorited programs to export. Star some programs first!');
      return;
    }

    const header = 'Name,Specialty,City,State,Region,Step2 Range,Fit Score,Step2 Fit,IMG Friendliness,Tech Hub Proximity,Nearest Hub,Distance (mi),URL';
    const rows = favoritedPrograms.map(programToCsvRow);
    const csv = [header, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'favorites.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className="w-full mt-3 px-4 py-2 bg-brand-purple text-white text-xs font-medium rounded-md hover:bg-brand-indigo transition-colors cursor-pointer border-none"
    >
      Export Favorites as CSV ({favorites.size})
    </button>
  );
}
