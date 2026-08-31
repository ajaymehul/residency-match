/**
 * SignalManager — a modal for managing interest signals for one specialty.
 *
 * Works on a *staged* copy of the specialty's signals so the user can freely
 * rearrange (drop, change tier, reassign the newly-added program) before
 * committing. Save is disabled until every tier is within its limit.
 *
 * Opened in two ways:
 *  - Add mode: `pending` is the program the user just tried to signal at a
 *    tier that is full. It starts in the staged map at that tier (over
 *    capacity), and the user must free room before saving.
 *  - Manage mode: no `pending`; just review and edit existing signals.
 *
 * Handles the edge case (IM, 3 gold + 12 silver full, add a 4th gold): the
 * user can demote a gold → silver, drop a silver, and keep the new program as
 * gold — all staged, validated live, then saved atomically.
 */

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppState } from './AppState';
import type { Specialty, ScoredProgram } from '../core/types';
import type { SignalMap, SignalTier } from '../core/signals';
import {
  SIGNAL_LABELS,
  signalTiersFor,
  tierBelongsToSpecialty,
  tierCounts,
  validationErrors,
} from '../core/signals';

export interface SignalPending {
  programId: string;
  tier: SignalTier;
}

interface SignalManagerProps {
  open: boolean;
  specialty: Specialty;
  pending?: SignalPending | null;
  onClose: () => void;
}

const TIER_BADGE: Record<SignalTier, string> = {
  gold: 'bg-amber-100 text-amber-800 border border-amber-300',
  silver: 'bg-slate-100 text-slate-700 border border-slate-300',
  signal: 'bg-brand-purple/10 text-brand-indigo border border-brand-purple/30',
};

export function SignalManager({ open, specialty, pending, onClose }: SignalManagerProps) {
  const { signals, derived, actions } = useAppState();

  const tiers = signalTiersFor(specialty);
  const pendingId = pending?.programId ?? null;

  // Fast lookup of program metadata by id.
  const programsById = useMemo(() => {
    const map = new Map<string, ScoredProgram>();
    for (const p of derived.scoredPrograms) map.set(p.id, p);
    return map;
  }, [derived.scoredPrograms]);

  // Staged working copy: this specialty's committed signals + the pending add.
  const [staged, setStaged] = useState<SignalMap>(new Map());

  useEffect(() => {
    if (!open) return;
    const init: SignalMap = new Map();
    for (const [id, tier] of signals) {
      if (tierBelongsToSpecialty(tier, specialty)) init.set(id, tier);
    }
    if (pending) init.set(pending.programId, pending.tier);
    setStaged(init);
    // Re-seed only when the modal opens or the add target changes; while open,
    // `signals` has no other writer so it won't clobber in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, specialty, pendingId, pending?.tier]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const counts = tierCounts(staged);
  const errors = validationErrors(staged);
  const valid = errors.length === 0;

  const changeTier = (id: string, tier: SignalTier) => {
    setStaged((prev) => {
      const next = new Map(prev);
      next.set(id, tier);
      return next;
    });
  };

  const removeOne = (id: string) => {
    setStaged((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  const handleSave = () => {
    if (!valid) return;
    // Merge staged back into the global map: drop this specialty's old entries,
    // then add the staged ones. Other specialty's signals are untouched.
    const next = new Map(signals);
    for (const [id, tier] of signals) {
      if (tierBelongsToSpecialty(tier, specialty)) next.delete(id);
    }
    for (const [id, tier] of staged) next.set(id, tier);
    actions.setSignals(next);
    onClose();
  };

  // Programs grouped by tier, each sorted by name.
  const rowsByTier = (tier: SignalTier): string[] =>
    [...staged.entries()]
      .filter(([, t]) => t === tier)
      .map(([id]) => id)
      .sort((a, b) => {
        const na = programsById.get(a)?.name ?? a;
        const nb = programsById.get(b)?.name ?? b;
        return na.localeCompare(nb);
      });

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Manage ${specialty} signals`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-sm font-serif font-semibold text-brand-indigo m-0">
              Manage {specialty === 'Internal Medicine' ? 'IM' : 'FM'} Signals
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5 mb-0">
              {tiers.map((t) => `${t.label} ${counts[t.tier]}/${t.limit}`).join('  •  ')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer text-lg leading-none p-0.5"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-4 py-3 flex-1 space-y-4">
          {pending && staged.get(pending.programId) && (
            <div className="text-[11px] text-brand-indigo bg-brand-purple/5 border border-brand-purple/20 rounded px-2.5 py-1.5">
              Adding <span className="font-semibold">{programsById.get(pending.programId)?.name ?? pending.programId}</span>.
              {' '}Free up room in an over-limit tier below, then Save.
            </div>
          )}

          {tiers.map((t) => {
            const ids = rowsByTier(t.tier);
            const over = counts[t.tier] > t.limit;
            return (
              <section key={t.tier}>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-[11px] uppercase tracking-wider font-semibold text-brand-mauve m-0">
                    {t.label}
                  </h3>
                  <span className={`text-[11px] font-medium ${over ? 'text-red-600' : 'text-gray-500'}`}>
                    {counts[t.tier]}/{t.limit}
                  </span>
                </div>
                {ids.length === 0 ? (
                  <p className="text-[11px] text-gray-400 m-0 italic">None selected</p>
                ) : (
                  <ul className="m-0 p-0 list-none space-y-1">
                    {ids.map((id) => {
                      const prog = programsById.get(id);
                      const isPending = id === pendingId;
                      return (
                        <li
                          key={id}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded border ${
                            isPending ? 'border-brand-purple/40 bg-brand-purple/5' : 'border-gray-100 bg-gray-50'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] text-gray-800 truncate flex items-center gap-1.5">
                              <span className={`inline-block px-1 py-0.5 rounded text-[9px] font-semibold ${TIER_BADGE[t.tier]}`}>
                                {SIGNAL_LABELS[t.tier]}
                              </span>
                              <span className="truncate">{prog?.name ?? id}</span>
                              {isPending && (
                                <span className="text-[9px] font-bold text-brand-indigo uppercase">New</span>
                              )}
                            </div>
                            {prog && (
                              <div className="text-[10px] text-gray-400 truncate">
                                {prog.city}, {prog.state}
                              </div>
                            )}
                          </div>

                          {/* Tier switch (only when >1 tier, i.e. IM) */}
                          {tiers.length > 1 && (
                            <div className="flex rounded overflow-hidden border border-gray-200 shrink-0">
                              {tiers.map((opt) => (
                                <button
                                  key={opt.tier}
                                  onClick={() => changeTier(id, opt.tier)}
                                  className={`px-1.5 py-0.5 text-[10px] cursor-pointer border-none ${
                                    staged.get(id) === opt.tier
                                      ? 'bg-brand-purple text-white'
                                      : 'bg-white text-gray-500 hover:bg-gray-100'
                                  }`}
                                  aria-pressed={staged.get(id) === opt.tier}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          )}

                          <button
                            onClick={() => removeOne(id)}
                            className="text-gray-400 hover:text-red-600 bg-transparent border-none cursor-pointer text-xs shrink-0 px-1"
                            aria-label={`Unsignal ${prog?.name ?? id}`}
                            title="Remove signal"
                          >
                            ✕
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-4 py-3">
          {!valid && (
            <ul className="m-0 mb-2 pl-4 text-[11px] text-red-600 space-y-0.5">
              {errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!valid}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border-none cursor-pointer text-white ${
                valid ? 'bg-brand-purple hover:bg-brand-indigo' : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
