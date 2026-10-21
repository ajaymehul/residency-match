/**
 * CompareGame — full-screen overlay for head-to-head Elo comparisons.
 *
 * Shows two fully rated programs (any specialty mix) side by side: criteria
 * scores + notes, pros/cons/overall, and program facts (resident makeup, PD,
 * size, salary, visa). Pick the one you'd rank higher, optionally noting why.
 * ← / → pick, Esc closes. Undo restores the last pair and note.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { CRITERIA, MAX_SCORE_TOTAL } from '../core/interview-criteria';
import { pairKey, pickPair } from '../core/elo';
import { useInterviews, type RankEntry } from './InterviewState';
import { ProgramFacts, SpecBadge } from './ProgramFacts';

function scoreCls(mine: number | undefined, theirs: number | undefined): string {
  if (mine === undefined || theirs === undefined || mine === theirs) return 'text-gray-700';
  return mine > theirs ? 'text-green-600 font-bold' : 'text-red-500';
}

function ProgramHeader({ entry, rank, side, onPick }: { entry: RankEntry; rank: number; side: 'A' | 'B'; onPick: () => void }) {
  const r = entry.record;
  return (
    <div className="flex-1 min-w-0 border border-gray-200 rounded-lg p-3 bg-white">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13px] font-serif font-semibold text-brand-indigo leading-tight">{r.name}</div>
          <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
            <SpecBadge specialty={r.specialty} /> {r.city}, {r.state}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-brand-indigo leading-none">{Math.round(entry.standing.elo)}</div>
          <div className="text-[10px] text-gray-400">Elo · #{rank + 1} · {entry.standing.wins}–{entry.standing.losses}</div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px] text-gray-600">
          Criteria total <span className="font-semibold">{entry.total}/{MAX_SCORE_TOTAL}</span>
        </span>
        <button
          type="button"
          onClick={onPick}
          className="px-3 py-1.5 text-xs font-semibold rounded-md border-none cursor-pointer text-white bg-brand-purple hover:bg-brand-indigo"
        >
          {side === 'A' ? '← ' : ''}Rank this higher{side === 'B' ? ' →' : ''}
        </button>
      </div>
    </div>
  );
}

export function CompareGame() {
  const { ranked, data, actions, setCompareOpen } = useInterviews();

  const byKey = useMemo(() => new Map(ranked.map((e, i) => [e.key, { entry: e, rank: i }])), [ranked]);
  const candidates = useMemo(() => ranked.map((e) => ({ key: e.key, elo: e.standing.elo })), [ranked]);

  const [pair, setPair] = useState<[string, string] | null>(() => pickPair(candidates, data.matches));
  const [note, setNote] = useState('');

  const close = useCallback(() => setCompareOpen(false), [setCompareOpen]);

  const a = pair ? byKey.get(pair[0]) : undefined;
  const b = pair ? byKey.get(pair[1]) : undefined;
  const valid = Boolean(a && b);

  const next = useCallback(
    (avoid: [string, string] | null) => {
      setPair(pickPair(candidates, data.matches, Math.random, avoid));
      setNote('');
    },
    [candidates, data.matches],
  );

  const pick = useCallback(
    (side: 'A' | 'B') => {
      if (!pair || !valid) return;
      const [left, right] = pair;
      const [winner, loser] = side === 'A' ? [left, right] : [right, left];
      actions.recordMatch(winner, loser, note);
      next(pair);
    },
    [pair, valid, actions, note, next],
  );

  const undo = () => {
    const last = data.matches[data.matches.length - 1];
    if (!last) return;
    actions.undoLastMatch();
    setPair([last.winner, last.loser]);
    setNote(last.note ?? '');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if (e.key === 'ArrowLeft') pick('A');
      else if (e.key === 'ArrowRight') pick('B');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, pick]);

  const headToHead = useMemo(() => {
    if (!pair) return [];
    const pk = pairKey(pair[0], pair[1]);
    return data.matches.filter((m) => pairKey(m.winner, m.loser) === pk).slice().reverse();
  }, [pair, data.matches]);

  const nameOf = (k: string) => data.records[k]?.name ?? 'Removed program';

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-3" role="presentation" onClick={close}>
      <div
        className="bg-gray-50 rounded-lg shadow-2xl w-full max-w-6xl h-[94vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Compare programs"
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white rounded-t-lg">
          <div>
            <h2 className="text-sm font-serif font-semibold text-brand-indigo m-0">Which would you rank higher?</h2>
            <p className="text-[10px] text-gray-500 m-0">
              {data.matches.length} comparisons · {ranked.length} rated programs (FM + IM combined) · ← / → to pick
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={undo}
              disabled={data.matches.length === 0}
              className="px-2.5 py-1 text-[11px] rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ↶ Undo last
            </button>
            <button type="button" onClick={close} className="text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer text-xl leading-none px-1" aria-label="Close">
              ×
            </button>
          </div>
        </div>

        {!valid || !a || !b ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-gray-500">
            {ranked.length < 2 ? 'Fully rate at least two programs to start comparing.' : 'Ready for the next pair.'}
            {ranked.length >= 2 && (
              <button type="button" onClick={() => next(null)} className="px-3 py-1.5 text-xs rounded-md border-none text-white bg-brand-purple cursor-pointer">
                Next pair
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              <div className="flex gap-3">
                <ProgramHeader entry={a.entry} rank={a.rank} side="A" onPick={() => pick('A')} />
                <ProgramHeader entry={b.entry} rank={b.rank} side="B" onPick={() => pick('B')} />
              </div>

              <table className="w-full border-collapse bg-white rounded-lg overflow-hidden text-[11px]">
                <thead>
                  <tr className="bg-gray-100 text-gray-500">
                    <th className="text-left font-medium px-2 py-1.5 w-[38%]">A</th>
                    <th className="font-medium px-2 py-1.5">Criterion</th>
                    <th className="text-left font-medium px-2 py-1.5 w-[38%]">B</th>
                  </tr>
                </thead>
                <tbody>
                  {CRITERIA.map((c) => {
                    const sa = a.entry.record.ratings[c.id];
                    const sb = b.entry.record.ratings[c.id];
                    return (
                      <tr key={c.id} className="border-t border-gray-100 align-top">
                        <td className="px-2 py-1">
                          <span className={`inline-block w-5 ${scoreCls(sa, sb)}`}>{sa ?? '—'}</span>
                          <span className="text-gray-500 italic">{a.entry.record.criterionNotes[c.id] ?? ''}</span>
                        </td>
                        <td className="px-2 py-1 text-center text-gray-700 whitespace-nowrap">
                          {c.label}
                        </td>
                        <td className="px-2 py-1">
                          <span className={`inline-block w-5 ${scoreCls(sb, sa)}`}>{sb ?? '—'}</span>
                          <span className="text-gray-500 italic">{b.entry.record.criterionNotes[c.id] ?? ''}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="grid grid-cols-2 gap-3">
                {[a.entry, b.entry].map((e) => (
                  <div key={e.key} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                    {(
                      [
                        ['Pros', e.record.pros],
                        ['Cons', e.record.cons],
                        ['Overall', e.record.overall],
                      ] as const
                    ).map(([label, text]) => (
                      <div key={label}>
                        <div className="text-[10px] uppercase tracking-wider text-gray-400">{label}</div>
                        <div className="text-[11px] text-gray-700 whitespace-pre-wrap">{text || '—'}</div>
                      </div>
                    ))}
                    <div className="border-t border-gray-100 pt-2">
                      <ProgramFacts program={e.program} />
                    </div>
                  </div>
                ))}
              </div>

              {headToHead.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Previous head-to-head</div>
                  <ul className="m-0 p-0 list-none space-y-1">
                    {headToHead.map((m) => (
                      <li key={m.id} className="text-[11px] text-gray-600 flex items-start justify-between gap-2">
                        <span>
                          <span className="font-semibold text-green-600">{nameOf(m.winner)}</span> over {nameOf(m.loser)}
                          {m.note ? <span className="italic text-gray-500"> — “{m.note}”</span> : null}
                        </span>
                        <button
                          type="button"
                          onClick={() => actions.deleteMatch(m.id)}
                          className="text-[10px] text-gray-400 hover:text-red-600 bg-transparent border-none cursor-pointer shrink-0"
                          title="Delete this comparison"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 bg-white px-4 py-2.5 rounded-b-lg flex items-center gap-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Why is one better? (saved with this comparison)"
                aria-label="Comparison note"
                className="flex-1 px-2 py-1 text-[11px] border border-gray-300 rounded resize-none focus:outline-none focus:ring-1 focus:ring-brand-purple/40"
              />
              <button type="button" onClick={() => pick('A')} className="px-3 py-2 text-xs font-semibold rounded-md border-none cursor-pointer text-white bg-brand-purple hover:bg-brand-indigo">
                ← A is better
              </button>
              <button type="button" onClick={() => next(pair)} className="px-3 py-2 text-xs rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 cursor-pointer">
                Skip
              </button>
              <button type="button" onClick={() => pick('B')} className="px-3 py-2 text-xs font-semibold rounded-md border-none cursor-pointer text-white bg-brand-purple hover:bg-brand-indigo">
                B is better →
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
