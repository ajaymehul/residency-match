/**
 * InterviewPanel — replaces the program list in interview mode.
 *
 * Tabs:
 *  - Interviews: every interview, by date, with schedule + rating progress.
 *  - Rank list: one combined FM + IM rank order by Elo (fully rated only),
 *    then programs still awaiting ratings.
 * Plus a search box to add any program as an interview.
 */

import { useDeferredValue, useMemo, useState } from 'react';

import { useAppState } from './AppState';
import { useInterviews, type RankEntry } from './InterviewState';
import { CRITERIA, MAX_SCORE_TOTAL } from '../core/interview-criteria';
import type { ScoredProgram } from '../core/types';
import { SpecBadge } from './ProgramFacts';
import { compareByInterviewTime, formatInterviewWhen, interviewUtc } from '../core/interview-store';
import { formatTimeInZone, localTimeZone, tzAbbreviation } from '../core/timezone';

type Tab = 'interviews' | 'rank';

const th = 'text-left font-medium text-gray-500 px-2 py-1.5 text-[11px] whitespace-nowrap';
const td = 'px-2 py-1.5 text-[11px] text-gray-700 whitespace-nowrap';

function StatusStar({ entry }: { entry: RankEntry }) {
  return entry.complete ? (
    <span className="text-green-600" title="Rating complete">★</span>
  ) : (
    <span className="text-orange-500" title="Scheduled / rating incomplete">★</span>
  );
}

/** Interview time in the viewer's zone, with the program's own time below when it differs. */
function WhenCell({ record }: { record: RankEntry['record'] }) {
  const local = localTimeZone();
  const mine = formatInterviewWhen(record, local);
  const utc = record.time ? interviewUtc(record) : null;
  const there = utc !== null ? formatTimeInZone(utc, record.timeZone) : null;
  const showThere = there !== null && there !== formatTimeInZone(utc!, local);
  return (
    <>
      <div>{mine}</div>
      {showThere && <div className="text-[10px] text-gray-400">{there} program time</div>}
    </>
  );
}

function AddProgramSearch() {
  const { derived } = useAppState();
  const { data, keyForProgram, actions } = useInterviews();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);

  const results = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: ScoredProgram[] = [];
    for (const p of derived.scoredPrograms) {
      if (`${p.name} ${p.city} ${p.state}`.toLowerCase().includes(q)) {
        out.push(p);
        if (out.length >= 8) break;
      }
    }
    return out;
  }, [deferred, derived.scoredPrograms]);

  return (
    <div className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Add an interview: search program, city or state…"
        aria-label="Search programs to add as interviews"
        className="w-72 px-2.5 py-1 text-[11px] bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-purple/40"
      />
      {results.length > 0 && (
        <ul className="absolute z-[1100] mt-1 w-[26rem] max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg m-0 p-0 list-none">
          {results.map((p) => {
            const added = Boolean(data.records[keyForProgram(p)]);
            return (
              <li key={p.id} className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-gray-50 last:border-b-0">
                <div className="min-w-0 text-[11px]">
                  <div className="truncate text-gray-800 flex items-center gap-1">
                    <SpecBadge specialty={p.specialty} /> <span className="truncate">{p.name}</span>
                  </div>
                  <div className="text-[10px] text-gray-400">{p.city}, {p.state}</div>
                </div>
                <button
                  type="button"
                  disabled={added}
                  onClick={() => {
                    actions.addInterview(p);
                    setQuery('');
                  }}
                  className={`shrink-0 px-2 py-0.5 text-[10px] rounded border cursor-pointer ${
                    added ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-default' : 'border-orange-400 text-orange-600 bg-white hover:bg-orange-50'
                  }`}
                >
                  {added ? 'Added' : '+ Add'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function InterviewPanel() {
  const { selectedProgramId, actions: appActions } = useAppState();
  const { entries, ranked, pending, setCompareOpen } = useInterviews();
  const [tab, setTab] = useState<Tab>('interviews');

  const byDate = useMemo(
    () =>
      entries
        .slice()
        .sort((a, b) => compareByInterviewTime(a.record, b.record)),
    [entries],
  );

  const select = (e: RankEntry) => {
    if (e.program) appActions.setSelectedProgramId(e.program.id);
  };
  const rowCls = (e: RankEntry) =>
    `border-t border-gray-50 cursor-pointer hover:bg-brand-purple/5 ${e.program && e.program.id === selectedProgramId ? 'bg-brand-purple/10' : ''}`;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-1">
          {(
            [
              ['interviews', `Interviews (${entries.length})`],
              ['rank', `Rank list (${ranked.length})`],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md border cursor-pointer ${
                tab === t ? 'bg-brand-indigo text-white border-brand-indigo' : 'bg-white text-gray-600 border-gray-300 hover:border-brand-purple'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <AddProgramSearch />
          <button
            type="button"
            onClick={() => setCompareOpen(true)}
            disabled={ranked.length < 2}
            title={ranked.length < 2 ? 'Fully rate at least 2 programs to compare' : 'Compare two programs'}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md border-none ${
              ranked.length < 2 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
            }`}
          >
            ⚔ Compare
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="text-[12px] text-gray-400 text-center mt-6 px-4">
            No interviews yet. Search above, or select a program and use “Add to interviews” in the detail panel.
          </p>
        ) : tab === 'interviews' ? (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th} />
                <th className={th}>Program</th>
                <th className={th}>Location</th>
                <th className={th}>When (your time, {tzAbbreviation(Date.now(), localTimeZone())})</th>
                <th className={th}>Format</th>
                <th className={th}>Rated</th>
                <th className={th}>Total</th>
              </tr>
            </thead>
            <tbody>
              {byDate.map((e) => (
                <tr key={e.key} className={rowCls(e)} onClick={() => select(e)}>
                  <td className={td}><StatusStar entry={e} /></td>
                  <td className={`${td} max-w-[22rem] truncate`}>
                    <SpecBadge specialty={e.record.specialty} /> {e.record.name}
                  </td>
                  <td className={td}>{e.record.city}, {e.record.state}</td>
                  <td className={td}><WhenCell record={e.record} /></td>
                  <td className={td}>{e.record.format === 'in-person' ? 'In-person' : e.record.format === 'virtual' ? 'Virtual' : '—'}</td>
                  <td className={td}>{e.rated}/{CRITERIA.length}</td>
                  <td className={td}>{e.rated ? `${e.total}/${MAX_SCORE_TOTAL}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>#</th>
                <th className={th}>Program</th>
                <th className={th}>Location</th>
                <th className={th}>Elo</th>
                <th className={th}>W–L</th>
                <th className={th}>Criteria total</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((e, i) => (
                <tr key={e.key} className={rowCls(e)} onClick={() => select(e)}>
                  <td className={`${td} font-semibold text-brand-indigo`}>{i + 1}</td>
                  <td className={`${td} max-w-[22rem] truncate`}>
                    <SpecBadge specialty={e.record.specialty} /> {e.record.name}
                  </td>
                  <td className={td}>{e.record.city}, {e.record.state}</td>
                  <td className={`${td} font-semibold`}>{Math.round(e.standing.elo)}</td>
                  <td className={td}>{e.standing.wins}–{e.standing.losses}</td>
                  <td className={td}>{e.total}/{MAX_SCORE_TOTAL}</td>
                </tr>
              ))}
              {pending.length > 0 && (
                <tr>
                  <td colSpan={6} className="px-2 pt-3 pb-1 text-[10px] uppercase tracking-wider text-gray-400">
                    Awaiting full rating — not ranked yet
                  </td>
                </tr>
              )}
              {pending.map((e) => (
                <tr key={e.key} className={`${rowCls(e)} text-gray-400`} onClick={() => select(e)}>
                  <td className={td}><StatusStar entry={e} /></td>
                  <td className={`${td} max-w-[22rem] truncate`}>
                    <SpecBadge specialty={e.record.specialty} /> {e.record.name}
                  </td>
                  <td className={td}>{e.record.city}, {e.record.state}</td>
                  <td className={`${td} text-gray-400`}>{Math.round(e.standing.elo)}</td>
                  <td className={td}>—</td>
                  <td className={td}>{e.rated}/{CRITERIA.length} rated</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {tab === 'rank' && ranked.length > 0 && (
        <p className="m-0 px-2 py-1 text-[10px] text-gray-400 border-t border-gray-100">
          Ranked by Elo only. Every program starts at 1500; only your head-to-head picks move it. The criteria total is shown for reference.
        </p>
      )}
    </div>
  );
}
