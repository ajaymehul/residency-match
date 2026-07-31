/**
 * ProgramDetail — side panel showing all parsed fields and computed scores
 * for the selected program.
 *
 * Every field is wrapped in a per-field try/catch so one failing field
 * never blanks the panel (Req 9.3). Missing/invalid fields show "N/A" (Req 9.2).
 *
 * Requirements: 5.3, 6.4, 7.4, 7.6, 9.1, 9.2, 9.3, 9.4
 */

import { useAppState } from './AppState';
import { scorePosition } from '../core/scoring';
import { UNAVAILABLE } from '../core/types';
import type { FieldValue, ScoreRange, SubScore, Weights } from '../core/types';

/** Safely render a value, returning "N/A" for missing/invalid/errors. */
function safeField<T>(fn: () => T): T | string {
  try {
    return fn();
  } catch {
    return 'N/A';
  }
}

/** Format a FieldValue<number> as a percentage for display. */
function formatFieldPercent(field: FieldValue<number> | undefined): string {
  if (!field || field.kind !== 'present') return 'N/A';
  return `${(field.value * 100).toFixed(1)}%`;
}

/** Format a ScoreRange field as "low-high" or "N/A". */
function formatScoreRange(field: FieldValue<ScoreRange> | undefined): string {
  if (!field || field.kind !== 'present') return 'N/A';
  return `${field.value.low}-${field.value.high}`;
}

/** Format a SubScore for display. */
function formatSubScore(score: SubScore | undefined): string {
  if (score === undefined || score === UNAVAILABLE) return 'N/A';
  return score.toFixed(1);
}

/** Format weights as percentages. */
function formatWeights(weights: Weights): string {
  const total = weights.step2 + weights.img + weights.proximity;
  if (total === 0) return 'Step2: 33%, IMG: 33%, Proximity: 33%';
  const s2 = ((weights.step2 / total) * 100).toFixed(0);
  const img = ((weights.img / total) * 100).toFixed(0);
  const prox = ((weights.proximity / total) * 100).toFixed(0);
  return `Step2: ${s2}%, IMG: ${img}%, Proximity: ${prox}%`;
}

export function ProgramDetail() {
  const { derived, applicantScore, weights, actions } = useAppState();
  const program = derived.selectedProgram;

  if (!program) {
    return null;
  }

  const position = safeField(() => scorePosition(applicantScore, program.step2Range));
  const favorited = actions.isFavorite(program.id);

  return (
    <aside
      className="bg-white border-l-[3px] border-l-brand-purple rounded-sm"
      role="complementary"
      aria-label="Program Detail"
    >
      {/* Header */}
      <div className="flex items-start justify-between p-3 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => actions.toggleFavorite(program.id)}
            className={`bg-transparent border-none cursor-pointer text-xl p-0.5 ${favorited ? 'text-brand-mauve' : 'text-gray-300'}`}
            aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
            title={favorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            {favorited ? '★' : '☆'}
          </button>
          <h2 className="text-base font-serif font-semibold text-brand-indigo m-0 leading-tight">
            {safeField(() => program.name || 'N/A')}
          </h2>
        </div>
        <button
          onClick={() => actions.setSelectedProgramId(null)}
          className="text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer text-xl leading-none p-1"
          aria-label="Close detail panel"
        >
          ×
        </button>
      </div>

      {/* Program URL */}
      {program.url && (
        <div className="px-3 pb-2">
          <button
            onClick={() => window.open(program.url, '_blank')}
            className="px-3 py-1.5 bg-brand-purple text-white text-xs rounded-md hover:bg-brand-indigo transition-colors cursor-pointer border-none"
          >
            Go to Program →
          </button>
        </div>
      )}

      {/* Location */}
      <section className="px-3 py-2 border-t border-gray-100">
        <h3 className="text-[11px] uppercase tracking-wider text-brand-mauve font-semibold mb-1.5">Location</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs m-0">
          <dt className="text-gray-500">Specialty</dt>
          <dd className="text-gray-800 font-medium m-0">{safeField(() => program.specialty || 'N/A')}</dd>
          <dt className="text-gray-500">City</dt>
          <dd className="text-gray-800 font-medium m-0">{safeField(() => program.city || 'N/A')}</dd>
          <dt className="text-gray-500">State</dt>
          <dd className="text-gray-800 font-medium m-0">{safeField(() => program.state || 'N/A')}</dd>
          <dt className="text-gray-500">Region</dt>
          <dd className="text-gray-800 font-medium m-0">{safeField(() => program.region || 'N/A')}</dd>
        </dl>
      </section>

      {/* Score Ranges */}
      <section className="px-3 py-2 border-t border-gray-100">
        <h3 className="text-[11px] uppercase tracking-wider text-brand-mauve font-semibold mb-1.5">Score Ranges</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs m-0">
          <dt className="text-gray-500">Step 2 CK Range</dt>
          <dd className="text-gray-800 font-medium m-0">{safeField(() => formatScoreRange(program.step2Range))}</dd>
          <dt className="text-gray-500">COMLEX Range</dt>
          <dd className="text-gray-800 font-medium m-0">{safeField(() => formatScoreRange(program.comlexRange))}</dd>
        </dl>
      </section>

      {/* Signal Rates */}
      <section className="px-3 py-2 border-t border-gray-100">
        <h3 className="text-[11px] uppercase tracking-wider text-brand-mauve font-semibold mb-1.5">Signal Rates</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs m-0">
          {safeField(() => {
            const entries = Object.entries(program.signalRates || {});
            if (entries.length === 0) return <><dt className="text-gray-500">Signal Rates</dt><dd className="text-gray-800 m-0">N/A</dd></>;
            return entries.map(([key, value]) => (
              <span key={key}>
                <dt className="text-gray-500">{key}</dt>
                <dd className="text-gray-800 font-medium m-0">{formatFieldPercent(value)}</dd>
              </span>
            ));
          })}
        </dl>
      </section>

      {/* Acceptance Rates */}
      <section className="px-3 py-2 border-t border-gray-100">
        <h3 className="text-[11px] uppercase tracking-wider text-brand-mauve font-semibold mb-1.5">Acceptance Rates</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs m-0">
          <dt className="text-gray-500">In-State</dt>
          <dd className="text-gray-800 font-medium m-0">{safeField(() => formatFieldPercent(program.inStateRate))}</dd>
          <dt className="text-gray-500">Out-of-State</dt>
          <dd className="text-gray-800 font-medium m-0">{safeField(() => formatFieldPercent(program.outOfStateRate))}</dd>
          <dt className="text-gray-500">US IMG Rate (raw)</dt>
          <dd className="text-gray-800 font-medium m-0">{safeField(() => formatFieldPercent(program.usImgRate))}</dd>
        </dl>
      </section>

      {/* Scoring */}
      <section className="px-3 py-2 border-t border-gray-100">
        <h3 className="text-[11px] uppercase tracking-wider text-brand-mauve font-semibold mb-1.5">Scoring</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs m-0">
          <dt className="text-gray-500">Fit Score</dt>
          <dd className="text-gray-800 font-semibold m-0">{safeField(() => formatSubScore(program.fitScore))}</dd>

          <dt className="text-gray-500">Step2 Fit</dt>
          <dd className="text-gray-800 font-medium m-0">
            {safeField(() => formatSubScore(program.step2Fit))}
            {safeField(() => {
              const pos = typeof position === 'string' && position !== 'N/A'
                ? ` (${position})`
                : position === 'N/A'
                  ? ''
                  : '';
              return pos;
            })}
            {safeField(() =>
              !program.availability.step2 ? <span className="text-gray-400 ml-1">[unavailable]</span> : null
            )}
          </dd>

          <dt className="text-gray-500">Score Position</dt>
          <dd className="text-gray-800 font-medium m-0">{safeField(() => typeof position === 'string' ? position : 'N/A')}</dd>

          <dt className="text-gray-500">IMG Friendliness</dt>
          <dd className="text-gray-800 font-medium m-0">
            {safeField(() => formatSubScore(program.imgFriendliness))}
            {safeField(() => {
              const raw = formatFieldPercent(program.usImgRate);
              return raw !== 'N/A' ? ` (raw: ${raw})` : '';
            })}
            {safeField(() =>
              !program.availability.img ? <span className="text-gray-400 ml-1">[unavailable]</span> : null
            )}
          </dd>

          <dt className="text-gray-500">Tech Hub Proximity</dt>
          <dd className="text-gray-800 font-medium m-0">
            {safeField(() => formatSubScore(program.techHubProximity))}
            {safeField(() => {
              if (program.nearestHub) {
                return ` (${program.nearestHub.name}, ${program.nearestHub.distanceMiles.toFixed(1)} mi)`;
              }
              return '';
            })}
            {safeField(() =>
              !program.availability.proximity ? <span className="text-gray-400 ml-1">[unavailable]</span> : null
            )}
          </dd>

          <dt className="text-gray-500">Weights Used</dt>
          <dd className="text-gray-800 font-medium m-0">{safeField(() => formatWeights(weights))}</dd>

          <dt className="text-gray-500">Unavailable Sub-scores</dt>
          <dd className="text-gray-800 font-medium m-0">
            {safeField(() => {
              const unavail: string[] = [];
              if (!program.availability.step2) unavail.push('Step2 Fit');
              if (!program.availability.img) unavail.push('IMG Friendliness');
              if (!program.availability.proximity) unavail.push('Tech Hub Proximity');
              return unavail.length > 0 ? unavail.join(', ') : 'None';
            })}
          </dd>
        </dl>
      </section>

      {/* Nearest Tech Hub */}
      <section className="px-3 py-2 border-t border-gray-100">
        <h3 className="text-[11px] uppercase tracking-wider text-brand-mauve font-semibold mb-1.5">Nearest Tech Hub</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs m-0">
          <dt className="text-gray-500">Hub</dt>
          <dd className="text-gray-800 font-medium m-0">{safeField(() => program.nearestHub?.name ?? 'N/A')}</dd>
          <dt className="text-gray-500">Distance</dt>
          <dd className="text-gray-800 font-medium m-0">
            {safeField(() =>
              program.nearestHub
                ? `${program.nearestHub.distanceMiles.toFixed(1)} miles`
                : 'N/A'
            )}
          </dd>
        </dl>
      </section>
    </aside>
  );
}
