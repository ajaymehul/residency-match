/**
 * Compact program facts for interview-time decisions: resident makeup
 * (US MD / DO / US-IMG / Non-US IMG), program director, size, salary, visa,
 * setting. Deliberately omits application/interview-rate data — once you
 * have the interview it no longer matters.
 */

import type { ScoredProgram } from '../core/types';
import type { EnrichedProgram } from '../core/scraped-data-loader';

/** Loosely-typed view of scraped fields the typed interface doesn't declare. */
type Loose = Record<string, unknown>;

/** Scraped yes/no fields arrive as "Yes"/"No" strings or booleans. */
export function yesNo(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'yes' || s === 'true') return true;
    if (s === 'no' || s === 'false') return false;
  }
  return null;
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[$,\s]/g, ''));
    return Number.isFinite(n) && v.trim() !== '' ? n : null;
  }
  return null;
}

export interface ProgramFactsData {
  director: string | null;
  setting: string | null;
  lengthYears: string | null;
  positionsOffered: number | null;
  positionsFilled: number | null;
  totalResidents: number | null;
  salaryPgy1: number | null;
  salaryPgy3: number | null;
  vacationDays: number | null;
  j1: boolean | null;
  h1b: boolean | null;
  makeup: Array<{ label: string; pct: number }>;
}

const MAKEUP_LABELS: Array<[string, string]> = [
  ['US MD Graduates', 'US MD'],
  ['US DO Graduates', 'US DO'],
  ['US-IMG', 'US-IMG'],
  ['Non-US IMG', 'Non-US IMG'],
];

export function programFacts(program: ScoredProgram | null): ProgramFactsData | null {
  const scraped = program ? ((program as unknown as EnrichedProgram).scraped as unknown as Loose | undefined) : undefined;
  if (!scraped) return null;

  const match = (scraped.match_outcomes_2026 ?? {}) as Loose;
  const training = (scraped.training ?? {}) as Loose;
  const visa = (scraped.visa_sponsorship ?? {}) as Loose;
  const rst = ((scraped.resident_student_type as Loose | undefined)?.series ?? {}) as Record<string, unknown>;

  const salaryRows = (Array.isArray(scraped.salary) ? scraped.salary : Array.isArray(scraped.salary_table) ? scraped.salary_table : []) as Loose[];
  const salaryAt = (i: number) => (salaryRows[i] ? toNumber(salaryRows[i].salary) : null);

  const makeup: Array<{ label: string; pct: number }> = [];
  for (const [src, label] of MAKEUP_LABELS) {
    const n = toNumber(rst[src]);
    if (n !== null) makeup.push({ label, pct: n });
  }

  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

  return {
    director: str(scraped.program_director),
    setting: str(scraped.institutional_setting) ?? str(training.setting),
    lengthYears: str(scraped.training_length_years) ?? (toNumber(training.length_years)?.toString() ?? null),
    positionsOffered: toNumber(match.positions_offered),
    positionsFilled: toNumber(match.positions_filled),
    totalResidents: toNumber(training.total_residents),
    salaryPgy1: salaryAt(0),
    salaryPgy3: salaryAt(2),
    vacationDays: salaryRows[0] ? toNumber(salaryRows[0].vacationDays ?? salaryRows[0].vacation_days) : null,
    j1: yesNo(visa.j1),
    h1b: yesNo(visa.h1b),
    makeup,
  };
}

const money = (n: number | null) => (n === null ? '—' : `$${Math.round(n).toLocaleString()}`);
const mark = (b: boolean | null) => (b === null ? '—' : b ? '✓' : '✗');

const MAKEUP_COLORS: Record<string, string> = {
  'US MD': 'bg-sky-400',
  'US DO': 'bg-emerald-400',
  'US-IMG': 'bg-brand-purple',
  'Non-US IMG': 'bg-amber-400',
};

/** Stacked bar + legend for current-resident makeup. */
export function ResidentMakeup({ makeup }: { makeup: ProgramFactsData['makeup'] }) {
  const total = makeup.reduce((s, m) => s + m.pct, 0);
  if (makeup.length === 0 || total <= 0) {
    return <div className="text-[11px] text-gray-400">Resident makeup not reported</div>;
  }
  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100">
        {makeup.map((m) => (
          <div key={m.label} className={MAKEUP_COLORS[m.label] ?? 'bg-gray-300'} style={{ width: `${(m.pct / total) * 100}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1 text-[10px] text-gray-600">
        {makeup.map((m) => (
          <span key={m.label} className="inline-flex items-center gap-1">
            <span className={`inline-block w-2 h-2 rounded-sm ${MAKEUP_COLORS[m.label] ?? 'bg-gray-300'}`} />
            {m.label} {m.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

export function ProgramFacts({ program }: { program: ScoredProgram | null }) {
  const f = programFacts(program);
  if (!f) return <div className="text-[11px] text-gray-400">No program data available</div>;

  const seats = f.positionsOffered ?? (f.totalResidents !== null ? Math.round(f.totalResidents / 3) : null);
  const seatsEstimated = f.positionsOffered === null && f.totalResidents !== null;

  return (
    <div className="space-y-2">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Current residents</div>
        <ResidentMakeup makeup={f.makeup} />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px] m-0">
        <dt className="text-gray-500">Program director</dt>
        <dd className="text-gray-800 m-0">{f.director ?? '—'}</dd>
        <dt className="text-gray-500">Setting</dt>
        <dd className="text-gray-800 m-0">{f.setting ?? '—'}</dd>
        <dt className="text-gray-500">Seats / year</dt>
        <dd className="text-gray-800 m-0">
          {seats === null ? '—' : `${seatsEstimated ? '~' : ''}${seats}`}
          {f.positionsFilled !== null && f.positionsOffered !== null ? ` (filled ${f.positionsFilled})` : ''}
        </dd>
        <dt className="text-gray-500">Total residents</dt>
        <dd className="text-gray-800 m-0">{f.totalResidents ?? '—'}</dd>
        <dt className="text-gray-500">Length</dt>
        <dd className="text-gray-800 m-0">{f.lengthYears ? `${f.lengthYears} yr` : '—'}</dd>
        <dt className="text-gray-500">Salary PGY-1 / 3</dt>
        <dd className="text-gray-800 m-0">{money(f.salaryPgy1)} / {money(f.salaryPgy3)}</dd>
        <dt className="text-gray-500">Vacation</dt>
        <dd className="text-gray-800 m-0">{f.vacationDays !== null ? `${f.vacationDays} days` : '—'}</dd>
        <dt className="text-gray-500">Visa</dt>
        <dd className="text-gray-800 m-0">J-1 {mark(f.j1)} · H-1B {mark(f.h1b)}</dd>
      </dl>
    </div>
  );
}

/** FM / IM pill. */
export function SpecBadge({ specialty }: { specialty: string }) {
  const fm = specialty === 'Family Medicine';
  return (
    <span className={`inline-block px-1 py-0.5 rounded text-[9px] font-semibold ${fm ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
      {fm ? 'FM' : 'IM'}
    </span>
  );
}
