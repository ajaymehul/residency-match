/**
 * ProgramDetail — rich side panel showing all scraped data and computed match scores.
 *
 * Displays Step 2 boxplot (with applicant score position), interview rates by type,
 * resident demographics, signal impact, salary, visa, match outcomes, and more.
 */

import { useMemo } from 'react';
import { useAppState } from './AppState';
import { computeMatchScore } from '../core/match-scoring';
import type { MatchResult } from '../core/match-scoring';
import type { EnrichedProgram } from '../core/scraped-data-loader';
import { DEFAULT_TECH_HUBS } from '../core/tech-hubs';

/** Safely render a value, returning "N/A" for errors. */
function safe<T>(fn: () => T, fallback: T | string = 'N/A'): T | string {
  try {
    const result = fn();
    if (result === null || result === undefined) return fallback;
    return result;
  } catch {
    return typeof fallback === 'string' ? fallback : 'N/A';
  }
}

/** Simple horizontal bar component */
function Bar({ value, max = 100, color = 'bg-brand-purple', label }: { value: number; max?: number; color?: string; label?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-gray-600 w-10 text-right">{label ?? `${value}%`}</span>
    </div>
  );
}

/** Boxplot visualization for Step 2 scores */
function ScoreBoxplot({ data, applicantScore, label }: { 
  data: { p10: number; p25: number; median: number; p75: number; p90: number }; 
  applicantScore: number; 
  label: string;
}) {
  const min = Math.min(data.p10, applicantScore) - 5;
  const max = Math.max(data.p90, applicantScore) + 5;
  const range = max - min;
  const toPercent = (v: number) => ((v - min) / range) * 100;

  return (
    <div className="mb-2">
      <div className="text-[10px] text-gray-500 mb-0.5">{label}</div>
      <div className="relative h-6 bg-gray-50 rounded border border-gray-200">
        {/* Whiskers: p10 to p90 line */}
        <div 
          className="absolute top-1/2 h-px bg-gray-400 -translate-y-1/2" 
          style={{ left: `${toPercent(data.p10)}%`, width: `${toPercent(data.p90) - toPercent(data.p10)}%` }} 
        />
        {/* Box: p25 to p75 */}
        <div 
          className="absolute top-1 bottom-1 bg-blue-200 border border-blue-400 rounded-sm" 
          style={{ left: `${toPercent(data.p25)}%`, width: `${toPercent(data.p75) - toPercent(data.p25)}%` }} 
        />
        {/* Median line */}
        <div 
          className="absolute top-0.5 bottom-0.5 w-0.5 bg-blue-700" 
          style={{ left: `${toPercent(data.median)}%` }} 
        />
        {/* Applicant score marker */}
        <div 
          className="absolute top-0 bottom-0 w-0.5 bg-red-500" 
          style={{ left: `${toPercent(applicantScore)}%` }}
          title={`Your score: ${applicantScore}`}
        />
        <div
          className="absolute -top-3 text-[9px] text-red-600 font-bold -translate-x-1/2"
          style={{ left: `${toPercent(applicantScore)}%` }}
        >
          ▼
        </div>
      </div>
      <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
        <span title="10th percentile">P10: {data.p10}</span>
        <span title="25th percentile">P25: {data.p25}</span>
        <span className="font-semibold text-gray-600" title="Median">Med: {data.median}</span>
        <span title="75th percentile">P75: {data.p75}</span>
        <span title="90th percentile">P90: {data.p90}</span>
      </div>
    </div>
  );
}

/** Match score gauge */
function ScoreGauge({ score, label }: { score: number | null; label: string }) {
  if (score === null) return (
    <div className="text-center">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className="text-sm text-gray-300">—</div>
    </div>
  );
  const color = score >= 60 ? 'text-green-600' : score >= 35 ? 'text-yellow-600' : 'text-red-500';
  return (
    <div className="text-center">
      <div className="text-[10px] text-gray-500">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{score.toFixed(0)}</div>
    </div>
  );
}

export function ProgramDetail() {
  const { derived, applicantScore, matchWeights, actions } = useAppState();
  const program = derived.selectedProgram as EnrichedProgram | null;

  const matchResult: MatchResult | null = useMemo(() => {
    if (!program || !program.scraped) return null;
    return computeMatchScore(program, applicantScore, matchWeights, DEFAULT_TECH_HUBS);
  }, [program, applicantScore, matchWeights]);

  if (!program) {
    return (
      <aside className="flex items-center justify-center h-full text-gray-400 text-sm p-4" role="complementary">
        <p className="text-center">Select a program from the map or list to see details</p>
      </aside>
    );
  }

  const scraped = (program as EnrichedProgram).scraped;
  const favorited = actions.isFavorite(program.id);

  return (
    <aside
      className="bg-white overflow-y-auto h-full"
      role="complementary"
      aria-label="Program Detail"
    >
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-3 z-10">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => actions.toggleFavorite(program.id)}
              className={`bg-transparent border-none cursor-pointer text-lg p-0 ${favorited ? 'text-brand-mauve' : 'text-gray-300'}`}
              aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
            >
              {favorited ? '★' : '☆'}
            </button>
            <h2 className="text-sm font-serif font-semibold text-brand-indigo m-0 leading-tight">
              {safe(() => program.name)}
            </h2>
          </div>
          <button
            onClick={() => actions.setSelectedProgramId(null)}
            className="text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer text-lg leading-none p-0.5"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5">
          {safe(() => `${program.city}, ${program.state}`)} • {safe(() => program.region)}
        </div>
        {program.url && (
          <a href={program.url} target="_blank" rel="noopener noreferrer"
            className="inline-block mt-1.5 px-2.5 py-1 bg-brand-purple text-white text-[10px] rounded hover:bg-brand-indigo transition-colors no-underline">
            View on Residency Explorer →
          </a>
        )}
      </div>

      {/* Match Score Summary */}
      {matchResult && (
        <section className="px-3 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] uppercase tracking-wider text-brand-mauve font-semibold m-0">Match Chance</h3>
            <div className={`text-2xl font-bold ${
              (matchResult.matchScore ?? 0) >= 60 ? 'text-green-600' : 
              (matchResult.matchScore ?? 0) >= 35 ? 'text-yellow-600' : 'text-red-500'
            }`}>
              {matchResult.matchScore !== null ? matchResult.matchScore.toFixed(0) : '—'}
              <span className="text-xs text-gray-400 font-normal">/100</span>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-1">
            <ScoreGauge score={matchResult.signals.scoreFit} label="Score" />
            <ScoreGauge score={matchResult.signals.imgInterviewRate} label="IMG Rate" />
            <ScoreGauge score={matchResult.signals.selectivity} label="Select." />
            <ScoreGauge score={matchResult.signals.imgRepresentation} label="IMG Rep" />
            <ScoreGauge score={matchResult.signals.techHubProximity} label="City" />
          </div>
        </section>
      )}

      {/* Step 2 CK Scores Boxplot */}
      {matchResult && (matchResult.usImgScoreRange || matchResult.allScoreRange) && (
        <section className="px-3 py-2 border-b border-gray-100">
          <h3 className="text-[11px] uppercase tracking-wider text-brand-mauve font-semibold mb-2">
            Step 2 CK Scores (Invited Applicants)
          </h3>
          {matchResult.usImgScoreRange && (
            <ScoreBoxplot data={matchResult.usImgScoreRange} applicantScore={applicantScore} label="US IMG Invited" />
          )}
          {matchResult.allScoreRange && (
            <ScoreBoxplot data={matchResult.allScoreRange} applicantScore={applicantScore} label="All Invited" />
          )}
          <div className="text-[10px] text-gray-400 mt-1">
            Red line = your score ({applicantScore}). Box = 25th-75th percentile.
          </div>
        </section>
      )}

      {/* Interview Rates by Applicant Type */}
      {scraped?.interview_rates_by_type && (
        <section className="px-3 py-2 border-b border-gray-100">
          <h3 className="text-[11px] uppercase tracking-wider text-brand-mauve font-semibold mb-1.5">Interview Rates by Type</h3>
          {Object.entries(scraped.interview_rates_by_type.series).map(([type, rate]) => (
            <div key={type} className="mb-1">
              <div className="flex justify-between text-[11px]">
                <span className={type === 'US IMG' ? 'font-bold text-brand-indigo' : 'text-gray-600'}>{type}</span>
                <span className={type === 'US IMG' ? 'font-bold text-brand-indigo' : 'text-gray-500'}>{rate}%</span>
              </div>
              <Bar value={rate} color={type === 'US IMG' ? 'bg-brand-purple' : 'bg-gray-300'} label={`${rate}%`} />
            </div>
          ))}
          {scraped.interview_rates_by_type.parameters && (
            <div className="text-[10px] text-gray-400 mt-1.5 border-t border-gray-50 pt-1">
              Applicants: US MD: {scraped.interview_rates_by_type.parameters.countUsmd ?? '—'}, 
              US DO: {scraped.interview_rates_by_type.parameters.countUsdo ?? '—'}, 
              <span className="font-semibold"> US IMG: {scraped.interview_rates_by_type.parameters.countUsimg ?? '—'}</span>, 
              Non-US IMG: {scraped.interview_rates_by_type.parameters.countFmg ?? '—'}
            </div>
          )}
        </section>
      )}

      {/* Signal Impact */}
      {scraped?.signal_rates && (
        <section className="px-3 py-2 border-b border-gray-100">
          <h3 className="text-[11px] uppercase tracking-wider text-brand-mauve font-semibold mb-1.5">Signal Impact</h3>
          {Object.entries(scraped.signal_rates.series).map(([type, rate]) => (
            <div key={type} className="mb-1">
              <div className="flex justify-between text-[11px] text-gray-600">
                <span>{type}</span>
                <span>{rate}%</span>
              </div>
              <Bar value={rate} color={type === 'Sent' ? 'bg-green-500' : 'bg-gray-300'} label={`${rate}%`} />
            </div>
          ))}
          {scraped.signal_rates.parameters && (
            <div className="text-[10px] text-gray-400 mt-1">
              Sent: {scraped.signal_rates.parameters.countSent ?? '—'}, 
              Did Not Send: {scraped.signal_rates.parameters.countDidNotSend ?? '—'}
            </div>
          )}
        </section>
      )}

      {/* Current Resident Composition */}
      {scraped?.resident_student_type && (
        <section className="px-3 py-2 border-b border-gray-100">
          <h3 className="text-[11px] uppercase tracking-wider text-brand-mauve font-semibold mb-1.5">Current Residents by Type</h3>
          {Object.entries(scraped.resident_student_type.series).map(([type, pct]) => (
            <div key={type} className="mb-1">
              <div className="flex justify-between text-[11px]">
                <span className={type === 'US-IMG' ? 'font-bold text-brand-indigo' : 'text-gray-600'}>{type}</span>
                <span className={type === 'US-IMG' ? 'font-bold' : ''}>{pct}%</span>
              </div>
              <Bar value={pct} color={type === 'US-IMG' ? 'bg-brand-purple' : 'bg-gray-300'} label={`${pct}%`} />
            </div>
          ))}
        </section>
      )}

      {/* Application Trends */}
      {scraped?.application_trends_2026 && (
        <section className="px-3 py-2 border-b border-gray-100">
          <h3 className="text-[11px] uppercase tracking-wider text-brand-mauve font-semibold mb-1.5">2026 Application Data</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs m-0">
            <dt className="text-gray-500">Total Applicants</dt>
            <dd className="text-gray-800 font-medium m-0">{scraped.application_trends_2026.eras_applicants ?? 'N/A'}</dd>
            <dt className="text-gray-500">Invited to Interview</dt>
            <dd className="text-gray-800 font-medium m-0">{scraped.application_trends_2026.invited_to_interview ?? 'N/A'}</dd>
            <dt className="text-gray-500">Overall Interview Rate</dt>
            <dd className="text-gray-800 font-medium m-0">{scraped.application_trends_2026.interview_rate_pct != null ? `${scraped.application_trends_2026.interview_rate_pct}%` : 'N/A'}</dd>
          </dl>
        </section>
      )}

      {/* Match Outcomes */}
      {scraped?.match_outcomes_2026 && (
        <section className="px-3 py-2 border-b border-gray-100">
          <h3 className="text-[11px] uppercase tracking-wider text-brand-mauve font-semibold mb-1.5">2026 Match Outcomes</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs m-0">
            {scraped.match_outcomes_2026.categorical_offered != null && (
              <>
                <dt className="text-gray-500">Categorical Positions</dt>
                <dd className="text-gray-800 font-medium m-0">{scraped.match_outcomes_2026.categorical_offered} offered, {scraped.match_outcomes_2026.categorical_filled} filled</dd>
              </>
            )}
            {scraped.match_outcomes_2026.preliminary_offered != null && (
              <>
                <dt className="text-gray-500">Preliminary Positions</dt>
                <dd className="text-gray-800 font-medium m-0">{scraped.match_outcomes_2026.preliminary_offered} offered, {scraped.match_outcomes_2026.preliminary_filled} filled</dd>
              </>
            )}
          </dl>
        </section>
      )}

      {/* Visa & Training */}
      <section className="px-3 py-2 border-b border-gray-100">
        <h3 className="text-[11px] uppercase tracking-wider text-brand-mauve font-semibold mb-1.5">Program Info</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs m-0">
          {scraped?.program_director && (
            <>
              <dt className="text-gray-500">Director</dt>
              <dd className="text-gray-800 font-medium m-0">{scraped.program_director}</dd>
            </>
          )}
          {scraped?.acgme_code && (
            <>
              <dt className="text-gray-500">ACGME Code</dt>
              <dd className="text-gray-800 font-medium m-0">{scraped.acgme_code}</dd>
            </>
          )}
          {scraped?.training?.setting && (
            <>
              <dt className="text-gray-500">Setting</dt>
              <dd className="text-gray-800 font-medium m-0">{scraped.training.setting}</dd>
            </>
          )}
          {scraped?.training?.total_residents != null && (
            <>
              <dt className="text-gray-500">Total Residents</dt>
              <dd className="text-gray-800 font-medium m-0">{scraped.training.total_residents}</dd>
            </>
          )}
          {scraped?.visa_sponsorship && (
            <>
              <dt className="text-gray-500">Visa</dt>
              <dd className="text-gray-800 font-medium m-0">
                J-1: {scraped.visa_sponsorship.j1 ? '✓' : '✗'} | 
                H-1B: {scraped.visa_sponsorship.h1b ? '✓' : '✗'}
                {scraped.visa_sponsorship.f1 !== undefined && ` | F-1: ${scraped.visa_sponsorship.f1 ? '✓' : '✗'}`}
              </dd>
            </>
          )}
          {scraped?.prior_gme_required !== undefined && (
            <>
              <dt className="text-gray-500">Prior GME Required</dt>
              <dd className="text-gray-800 font-medium m-0">{scraped.prior_gme_required ? 'Yes' : 'No'}</dd>
            </>
          )}
        </dl>
      </section>

      {/* Salary */}
      {(Array.isArray(scraped?.salary_table) || Array.isArray(scraped?.salary)) && (
        <section className="px-3 py-2 border-b border-gray-100">
          <h3 className="text-[11px] uppercase tracking-wider text-brand-mauve font-semibold mb-1.5">Salary</h3>
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left font-medium py-0.5">Year</th>
                <th className="text-right font-medium py-0.5">Salary</th>
                <th className="text-right font-medium py-0.5">Vacation</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(scraped.salary_table) ? scraped.salary_table : Array.isArray(scraped.salary) ? scraped.salary : []).map((row: any) => (
                <tr key={row.year} className="border-t border-gray-50">
                  <td className="py-0.5 text-gray-700">PGY-{row.year}</td>
                  <td className="py-0.5 text-right text-gray-800 font-medium">
                    ${(row.salary || 0).toLocaleString()}
                  </td>
                  <td className="py-0.5 text-right text-gray-600">
                    {row.vacationDays || row.vacation_days || '—'} days
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Nearest Major City */}
      {matchResult?.nearestHub && (
        <section className="px-3 py-2 border-b border-gray-100">
          <h3 className="text-[11px] uppercase tracking-wider text-brand-mauve font-semibold mb-1.5">Nearest Major City</h3>
          <div className="text-xs text-gray-700">
            <span className="font-medium">{matchResult.nearestHub.name}</span>
            <span className="text-gray-500"> — {matchResult.nearestHub.distanceMiles.toFixed(0)} miles</span>
          </div>
        </section>
      )}

      {/* Program Strengths */}
      {scraped?.program_strengths && (
        <section className="px-3 py-2 border-b border-gray-100">
          <h3 className="text-[11px] uppercase tracking-wider text-brand-mauve font-semibold mb-1.5">Program Strengths</h3>
          <p className="text-[11px] text-gray-600 m-0 leading-relaxed">{scraped.program_strengths}</p>
        </section>
      )}

      {/* Contact */}
      <section className="px-3 py-2 pb-4">
        <h3 className="text-[11px] uppercase tracking-wider text-brand-mauve font-semibold mb-1.5">Contact</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs m-0">
          {scraped?.email && (
            <>
              <dt className="text-gray-500">Email</dt>
              <dd className="text-gray-800 m-0"><a href={`mailto:${scraped.email}`} className="text-brand-purple hover:underline">{scraped.email}</a></dd>
            </>
          )}
          {scraped?.phone && (
            <>
              <dt className="text-gray-500">Phone</dt>
              <dd className="text-gray-800 m-0">{scraped.phone}</dd>
            </>
          )}
          {scraped?.website && (
            <>
              <dt className="text-gray-500">Website</dt>
              <dd className="text-gray-800 m-0"><a href={scraped.website} target="_blank" rel="noopener noreferrer" className="text-brand-purple hover:underline text-[11px] break-all">{scraped.website}</a></dd>
            </>
          )}
        </dl>
      </section>
    </aside>
  );
}
