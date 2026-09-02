/**
 * ExportButton — exports favorited programs as a CSV download.
 *
 * Columns: Name, Specialty, City, State, Region, Step2 Range, Fit Score,
 * Step2 Fit, IMG Friendliness, Tech Hub Proximity, Nearest Hub, Distance (mi),
 * US IMG Applicants, US IMG Interviewed (est.), US IMG Interview Rate (%),
 * IMG Residents (%), Signal Sent Rate (%), Signal Not Sent Rate (%), URL.
 */

import { useAppState } from './AppState';
import { UNAVAILABLE } from '../core/types';
import type { FieldValue, ScoreRange, SubScore, ScoredProgram } from '../core/types';
import type { EnrichedProgram } from '../core/scraped-data-loader';
import type { SignalMap } from '../core/signals';
import { SIGNAL_LABELS } from '../core/signals';

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

/** Format a number for CSV, or "N/A" when null/undefined/NaN. */
function formatNumberCsv(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return String(value);
}

/** Format a percentage for CSV (value is already a percent, e.g. 42.3 → "42.3%"). */
function formatPercentCsv(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value}%`;
}

/**
 * IMG-related metrics pulled from the raw scraped chart data. The scraped
 * object is attached at runtime (see scoreProgram/loadScrapedPrograms) but
 * isn't declared on ScoredProgram, so we reach it through a cast — the same
 * pattern ProgramDetail.tsx uses.
 */
function imgMetrics(program: ScoredProgram) {
  const scraped = (program as unknown as EnrichedProgram).scraped;

  // Number of US IMG applicants (raw count from interview_rates_by_type params).
  const usImgApplicants = scraped?.interview_rates_by_type?.parameters?.countUsimg;
  // US IMG interview rate as a percentage (share of US IMG applicants invited).
  const usImgInterviewPct = scraped?.interview_rates_by_type?.series?.['US IMG'];
  // Estimated count of US IMG interviewed = applicants × rate.
  const usImgInterviewed =
    usImgApplicants != null && usImgInterviewPct != null
      ? Math.round((usImgApplicants * usImgInterviewPct) / 100)
      : undefined;

  // IMG share of current residents = US-IMG + Non-US IMG percentages.
  const residents = scraped?.resident_student_type?.series;
  let imgResidentPct: number | undefined;
  if (residents) {
    const usImg = residents['US-IMG'] ?? 0;
    const nonUsImg = residents['Non-US IMG'] ?? 0;
    imgResidentPct = usImg + nonUsImg;
  }

  // Signal impact: interview rate when a signal was sent vs. not sent.
  // FM uses 'Sent'; IM uses 'Gold Sent'/'Silver Sent' — take the best available.
  const signal = scraped?.signal_rates?.series;
  const sentCandidates = [signal?.['Sent'], signal?.['Gold Sent'], signal?.['Silver Sent']].filter(
    (v): v is number => typeof v === 'number',
  );
  const signalSentPct = sentCandidates.length > 0 ? Math.max(...sentCandidates) : undefined;
  const signalNotSentPct = signal?.['Did Not Send'];

  return {
    usImgApplicants,
    usImgInterviewed,
    usImgInterviewPct,
    imgResidentPct,
    signalSentPct,
    signalNotSentPct,
  };
}

/** Escape a CSV field: wrap in quotes if it contains commas, quotes, or newlines. */
function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Generate a CSV row from a ScoredProgram. `signals` supplies the interest tier. */
function programToCsvRow(program: ScoredProgram, signals: SignalMap): string {
  const img = imgMetrics(program);
  const tier = signals.get(program.id);
  const fields = [
    tier ? SIGNAL_LABELS[tier] : '',
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
    formatNumberCsv(img.usImgApplicants),
    formatNumberCsv(img.usImgInterviewed),
    formatPercentCsv(img.usImgInterviewPct),
    formatPercentCsv(img.imgResidentPct),
    formatPercentCsv(img.signalSentPct),
    formatPercentCsv(img.signalNotSentPct),
    program.url ?? '',
  ];
  return fields.map(escapeCsv).join(',');
}

/** Short label for a specialty, used in the button and export filename. */
function specialtyShortLabel(specialty: string): string {
  if (specialty === 'Family Medicine') return 'FM';
  if (specialty === 'Internal Medicine') return 'IM';
  return specialty;
}

/** Filesystem-safe token for a specialty, used in the download filename. */
function specialtyFileToken(specialty: string): string {
  return specialtyShortLabel(specialty).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

const CSV_HEADER =
  'Signal,Name,Specialty,City,State,Region,Step2 Range,Fit Score,Step2 Fit,IMG Friendliness,Tech Hub Proximity,Nearest Hub,Distance (mi),US IMG Applicants,US IMG Interviewed (est.),US IMG Interview Rate (%),IMG Residents (%),Signal Sent Rate (%),Signal Not Sent Rate (%),URL';

/** Build a CSV string and trigger a browser download. */
function downloadCsv(programs: ScoredProgram[], signals: SignalMap, filename: string): void {
  const rows = programs.map((p) => programToCsvRow(p, signals));
  const csv = [CSV_HEADER, ...rows].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ExportButton() {
  const { favorites, filters, derived, signals } = useAppState();

  // All favorited programs, then narrow to the selected specialty (if any).
  const favoritedPrograms = derived.scoredPrograms.filter((p) => favorites.has(p.id));
  const selectedSpecialty = filters.specialty;
  const exportPrograms = selectedSpecialty
    ? favoritedPrograms.filter((p) => p.specialty === selectedSpecialty)
    : favoritedPrograms;

  const handleExport = () => {
    if (exportPrograms.length === 0) {
      const scope = selectedSpecialty
        ? `${specialtyShortLabel(selectedSpecialty)} favorited programs`
        : 'favorited programs';
      alert(`No ${scope} to export. Star some programs first!`);
      return;
    }

    const filename = selectedSpecialty
      ? `favorites-${specialtyFileToken(selectedSpecialty)}.csv`
      : 'favorites.csv';
    downloadCsv(exportPrograms, signals, filename);
  };

  const label = selectedSpecialty
    ? `Export ${specialtyShortLabel(selectedSpecialty)} Favorites as CSV (${exportPrograms.length})`
    : `Export All Favorites as CSV (${exportPrograms.length})`;

  return (
    <button
      type="button"
      onClick={handleExport}
      className="w-full mt-3 px-4 py-2 bg-brand-purple text-white text-xs font-medium rounded-md hover:bg-brand-indigo transition-colors cursor-pointer border-none"
    >
      {label}
    </button>
  );
}
