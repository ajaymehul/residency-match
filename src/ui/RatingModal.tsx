/**
 * RatingModal — score a program 1–5 on each Program_Rankings.md criterion,
 * with free-form notes per criterion plus pros / cons / overall impression.
 *
 * Edits are staged locally and only written on Save, so you can revisit and
 * revise scores at any time without half-finished changes leaking out.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  CRITERIA,
  MAX_SCORE_TOTAL,
  ratedCount,
  scoreTotal,
  type CriterionId,
  type Ratings,
} from '../core/interview-criteria';
import type { InterviewRecord } from '../core/interview-store';
import { useInterviews } from './InterviewState';

const SCORE_HINT: Record<number, string> = {
  1: 'Poor — significant drawback',
  2: 'Below average — a concern',
  3: 'Neutral / average',
  4: 'Good — clear positive',
  5: 'Excellent — major reason to rank high',
};

export function RatingModal({ record, onClose }: { record: InterviewRecord; onClose: () => void }) {
  const { actions } = useInterviews();

  const [ratings, setRatings] = useState<Ratings>(() => ({ ...record.ratings }));
  const [notes, setNotes] = useState<Partial<Record<CriterionId, string>>>(() => ({ ...record.criterionNotes }));
  const [pros, setPros] = useState(record.pros);
  const [cons, setCons] = useState(record.cons);
  const [overall, setOverall] = useState(record.overall);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const setScore = (id: CriterionId, score: number) => {
    setRatings((prev) => {
      const next = { ...prev };
      if (next[id] === score) delete next[id]; // click again to clear
      else next[id] = score;
      return next;
    });
  };

  const setNote = (id: CriterionId, text: string) => {
    setNotes((prev) => ({ ...prev, [id]: text }));
  };

  const handleSave = () => {
    const cleanNotes: Partial<Record<CriterionId, string>> = {};
    for (const [id, text] of Object.entries(notes)) {
      if (text && text.trim()) cleanNotes[id as CriterionId] = text.trim();
    }
    actions.updateRecord(record.key, {
      ratings,
      criterionNotes: cleanNotes,
      pros,
      cons,
      overall,
      // Rating a program implies the interview happened.
      ...(ratedCount(ratings) > 0 ? { status: 'completed' as const } : {}),
    });
    onClose();
  };

  const total = scoreTotal(ratings);
  const rated = ratedCount(ratings);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={onClose} role="presentation">
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Rate ${record.name}`}
      >
        <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-gray-200">
          <div className="min-w-0">
            <h2 className="text-sm font-serif font-semibold text-brand-indigo m-0 truncate">Rate: {record.name}</h2>
            <p className="text-[11px] text-gray-500 mt-0.5 mb-0">
              {record.specialty === 'Family Medicine' ? 'FM' : 'IM'} · {record.city}, {record.state} · {rated}/{CRITERIA.length} rated ·{' '}
              <span className="font-semibold text-brand-indigo">{total}/{MAX_SCORE_TOTAL}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer text-lg leading-none p-0.5" aria-label="Close">
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-3 flex-1 space-y-2.5">
          {CRITERIA.map((c) => {
            const score = ratings[c.id];
            return (
              <div key={c.id} className="border border-gray-100 rounded-md p-2 bg-gray-50/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-gray-800">{c.label}</div>
                    <div className="text-[10px] text-gray-500">{c.description}</div>
                  </div>
                  <div className="flex gap-1 shrink-0" role="group" aria-label={`${c.label} score`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setScore(c.id, n)}
                        title={SCORE_HINT[n]}
                        aria-pressed={score === n}
                        className={`w-7 h-7 text-[12px] rounded-md border cursor-pointer transition-colors ${
                          score === n
                            ? 'bg-brand-purple text-white border-brand-purple'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-brand-purple'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={notes[c.id] ?? ''}
                  onChange={(e) => setNote(c.id, e.target.value)}
                  placeholder="Notes (optional)"
                  rows={1}
                  aria-label={`${c.label} notes`}
                  className="mt-1.5 w-full px-2 py-1 text-[11px] border border-gray-200 rounded resize-y focus:outline-none focus:ring-1 focus:ring-brand-purple/40 bg-white"
                />
              </div>
            );
          })}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
            {(
              [
                ['Pros', pros, setPros],
                ['Cons', cons, setCons],
                ['Overall impression', overall, setOverall],
              ] as const
            ).map(([label, value, set]) => (
              <label key={label} className="block">
                <span className="block text-[11px] font-medium text-gray-700 mb-0.5">{label}</span>
                <textarea
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  rows={3}
                  className="w-full px-2 py-1 text-[11px] border border-gray-200 rounded resize-y focus:outline-none focus:ring-1 focus:ring-brand-purple/40"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between gap-2">
          <span className="text-[11px] text-gray-500">
            {rated < CRITERIA.length
              ? `Rate all ${CRITERIA.length} criteria to include this program in the rank list and comparisons.`
              : 'All criteria rated.'}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 cursor-pointer">
              Cancel
            </button>
            <button onClick={handleSave} className="px-3 py-1.5 text-xs font-medium rounded-md border-none cursor-pointer text-white bg-brand-purple hover:bg-brand-indigo">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
