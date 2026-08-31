/**
 * Program interest signals — specialty-specific tiers, limits, and pure
 * counting/validation helpers.
 *
 * Signal tiers differ by specialty:
 *  - Internal Medicine: 3 "gold" + 12 "silver" (two tiers)
 *  - Family Medicine:   5 "signal"            (single flat tier)
 *
 * Tier values are specialty-exclusive (gold/silver belong to IM, signal to
 * FM), so a single `Map<programId, SignalTier>` across all specialties can be
 * counted per-tier unambiguously.
 *
 * Everything here is pure and framework-free so it can be unit-tested and
 * reused by the AppState store, the SignalManager modal, and the CSV export.
 */

import type { Specialty } from './types';

/** A signal tier. gold/silver are Internal Medicine; signal is Family Medicine. */
export type SignalTier = 'gold' | 'silver' | 'signal';

/** Map of program id → assigned signal tier. */
export type SignalMap = Map<string, SignalTier>;

/** Per-tier maximum a user may assign. */
export const SIGNAL_LIMITS: Record<SignalTier, number> = {
  gold: 3,
  silver: 12,
  signal: 5,
};

/** Human-readable label for a tier. */
export const SIGNAL_LABELS: Record<SignalTier, string> = {
  gold: 'Gold',
  silver: 'Silver',
  signal: 'Signal',
};

/** Config describing one tier available to a specialty. */
export interface SignalTierConfig {
  tier: SignalTier;
  label: string;
  limit: number;
}

/**
 * The ordered list of signal tiers available to a specialty.
 * IM: [gold, silver]; FM: [signal].
 */
export function signalTiersFor(specialty: Specialty): SignalTierConfig[] {
  if (specialty === 'Internal Medicine') {
    return [
      { tier: 'gold', label: SIGNAL_LABELS.gold, limit: SIGNAL_LIMITS.gold },
      { tier: 'silver', label: SIGNAL_LABELS.silver, limit: SIGNAL_LIMITS.silver },
    ];
  }
  return [{ tier: 'signal', label: SIGNAL_LABELS.signal, limit: SIGNAL_LIMITS.signal }];
}

/** True if the given tier belongs to the given specialty's tier system. */
export function tierBelongsToSpecialty(tier: SignalTier, specialty: Specialty): boolean {
  return signalTiersFor(specialty).some((t) => t.tier === tier);
}

/** The specialty that owns a tier (gold/silver → IM, signal → FM). */
export function specialtyForTier(tier: SignalTier): Specialty {
  return tier === 'signal' ? 'Family Medicine' : 'Internal Medicine';
}

/** Count assignments per tier across the whole signal map. */
export function tierCounts(signals: SignalMap): Record<SignalTier, number> {
  const counts: Record<SignalTier, number> = { gold: 0, silver: 0, signal: 0 };
  for (const tier of signals.values()) {
    counts[tier] += 1;
  }
  return counts;
}

/** Remaining capacity for a tier (limit minus current count, never negative). */
export function remainingForTier(signals: SignalMap, tier: SignalTier): number {
  return Math.max(0, SIGNAL_LIMITS[tier] - tierCounts(signals)[tier]);
}

/**
 * Whether assigning `tier` to `programId` keeps every tier within its limit.
 * Re-assigning a program already at that tier is always allowed (no-op), and
 * moving a program between tiers correctly frees its old tier.
 */
export function canAssign(signals: SignalMap, programId: string, tier: SignalTier): boolean {
  const projected = new Map(signals);
  projected.set(programId, tier);
  return isValid(projected);
}

/** True if no tier exceeds its limit. */
export function isValid(signals: SignalMap): boolean {
  const counts = tierCounts(signals);
  return (
    counts.gold <= SIGNAL_LIMITS.gold &&
    counts.silver <= SIGNAL_LIMITS.silver &&
    counts.signal <= SIGNAL_LIMITS.signal
  );
}

/**
 * Validate a signal map and return the list of over-limit tiers with
 * human-readable messages. Empty array ⇔ valid.
 */
export function validationErrors(signals: SignalMap): string[] {
  const counts = tierCounts(signals);
  const errors: string[] = [];
  for (const tier of ['gold', 'silver', 'signal'] as SignalTier[]) {
    if (counts[tier] > SIGNAL_LIMITS[tier]) {
      errors.push(
        `${SIGNAL_LABELS[tier]}: ${counts[tier]} selected, limit is ${SIGNAL_LIMITS[tier]} (remove ${counts[tier] - SIGNAL_LIMITS[tier]}).`,
      );
    }
  }
  return errors;
}

/** Serialize a signal map to a plain object for localStorage. */
export function serializeSignals(signals: SignalMap): Record<string, SignalTier> {
  return Object.fromEntries(signals);
}

/** Parse a stored plain object back into a signal map, ignoring bad entries. */
export function deserializeSignals(raw: unknown): SignalMap {
  const map: SignalMap = new Map();
  if (raw && typeof raw === 'object') {
    for (const [id, tier] of Object.entries(raw as Record<string, unknown>)) {
      if (tier === 'gold' || tier === 'silver' || tier === 'signal') {
        map.set(id, tier);
      }
    }
  }
  return map;
}
