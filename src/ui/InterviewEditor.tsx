/**
 * InterviewEditor — the interview section of the program detail panel:
 * add/remove an interview, schedule details, rating summary + editor, and
 * the program's comparison history (with the "why" notes).
 */

import { useMemo, useState } from 'react';

import type { ScoredProgram } from '../core/types';
import { CRITERIA, MAX_SCORE_TOTAL } from '../core/interview-criteria';
import type { InterviewFormat, InterviewStatus } from '../core/interview-store';
import { useInterviews } from './InterviewState';
import { RatingModal } from './RatingModal';

const inputCls =
  'w-full px-2 py-1 text-[11px] bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-purple/40';

export function InterviewEditor({ program }: { program: ScoredProgram }) {
  const { data, keyForProgram, entries, ranked, actions } = useInterviews();
  const [rating, setRating] = useState(false);

  const key = keyForProgram(program);
  const record = data.records[key];
  const entry = entries.find((e) => e.key === key);
  const rank = ranked.findIndex((e) => e.key === key);

  const history = useMemo(
    () =>
      data.matches
        .filter((m) => m.winner === key || m.loser === key)
        .slice()
        .reverse(),
    [data.matches, key],
  );

  if (!record) {
    return (
      <section className="px-3 py-2.5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] uppercase tracking-wider text-brand-mauve font-semibold m-0">Interview</h3>
          <button
            type="button"
            onClick={() => actions.addInterview(program)}
            className="px-2.5 py-1 text-[11px] font-medium rounded-md cursor-pointer border border-orange-400 text-orange-600 bg-white hover:bg-orange-50"
          >
            + Add to interviews
          </button>
        </div>
      </section>
    );
  }

  const update = actions.updateRecord;
  const nameOf = (k: string) => data.records[k]?.name ?? 'Removed program';

  return (
    <section className="px-3 py-2.5 border-b border-gray-100 bg-orange-50/40">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] uppercase tracking-wider text-brand-mauve font-semibold m-0">
          Interview {entry?.complete ? <span className="text-green-600">★ rated</span> : <span className="text-orange-500">★ {record.status}</span>}
        </h3>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Remove ${record.name} from interviews? Ratings, notes and its comparisons will be deleted.`)) {
              actions.removeInterview(key);
            }
          }}
          className="text-[10px] text-gray-400 hover:text-red-600 bg-transparent border-none cursor-pointer underline"
        >
          Remove
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <label className="block">
          <span className="block text-[10px] text-gray-500">Date</span>
          <input type="date" value={record.date} onChange={(e) => update(key, { date: e.target.value })} className={inputCls} />
        </label>
        <label className="block">
          <span className="block text-[10px] text-gray-500">Time</span>
          <input type="time" value={record.time} onChange={(e) => update(key, { time: e.target.value })} className={inputCls} />
        </label>
        <label className="block">
          <span className="block text-[10px] text-gray-500">Format</span>
          <select value={record.format} onChange={(e) => update(key, { format: e.target.value as InterviewFormat })} className={inputCls}>
            <option value="">—</option>
            <option value="virtual">Virtual</option>
            <option value="in-person">In-person</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-[10px] text-gray-500">Status</span>
          <select value={record.status} onChange={(e) => update(key, { status: e.target.value as InterviewStatus })} className={inputCls}>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
          </select>
        </label>
      </div>
      <label className="block mt-1.5">
        <span className="block text-[10px] text-gray-500">Schedule notes (contact, pre-interview dinner, links…)</span>
        <textarea value={record.scheduleNotes} onChange={(e) => update(key, { scheduleNotes: e.target.value })} rows={2} className={`${inputCls} resize-y`} />
      </label>

      <div className="mt-2 flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-md px-2 py-1.5">
        <div className="text-[11px] text-gray-600 leading-tight">
          <div>
            Rated {entry?.rated ?? 0}/{CRITERIA.length} · <span className="font-semibold text-brand-indigo">{entry?.total ?? 0}/{MAX_SCORE_TOTAL}</span>
          </div>
          {entry && (
            <div className="text-[10px] text-gray-500">
              Elo {Math.round(entry.standing.elo)} · {entry.standing.wins}W–{entry.standing.losses}L
              {rank >= 0 ? ` · Rank #${rank + 1}` : ''}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setRating(true)}
          className="px-2.5 py-1 text-[11px] font-medium rounded-md cursor-pointer border-none text-white bg-brand-purple hover:bg-brand-indigo shrink-0"
        >
          {entry && entry.rated > 0 ? 'Edit ratings' : 'Rate program'}
        </button>
      </div>

      {history.length > 0 && (
        <details className="mt-2">
          <summary className="text-[11px] text-gray-600 cursor-pointer">Comparison history ({history.length})</summary>
          <ul className="m-0 mt-1 p-0 list-none space-y-1">
            {history.map((m) => {
              const won = m.winner === key;
              return (
                <li key={m.id} className="text-[10px] text-gray-600 border-l-2 pl-1.5 border-gray-200">
                  <span className={won ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>{won ? 'Beat' : 'Lost to'}</span>{' '}
                  {nameOf(won ? m.loser : m.winner)}
                  {m.note ? <div className="text-gray-500 italic">“{m.note}”</div> : null}
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {rating && <RatingModal record={record} onClose={() => setRating(false)} />}
    </section>
  );
}
