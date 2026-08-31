import { describe, it, expect } from 'vitest';
import type { SignalMap, SignalTier } from '../signals';
import {
  SIGNAL_LIMITS,
  signalTiersFor,
  tierBelongsToSpecialty,
  specialtyForTier,
  tierCounts,
  remainingForTier,
  canAssign,
  isValid,
  validationErrors,
  serializeSignals,
  deserializeSignals,
} from '../signals';

/** Build a SignalMap with `count` entries of `tier`, ids prefixed uniquely. */
function makeSignals(spec: Array<[SignalTier, number]>): SignalMap {
  const map: SignalMap = new Map();
  let n = 0;
  for (const [tier, count] of spec) {
    for (let i = 0; i < count; i++) {
      map.set(`${tier}-${n++}`, tier);
    }
  }
  return map;
}

describe('signalTiersFor', () => {
  it('gives IM two tiers: 3 gold + 12 silver', () => {
    const tiers = signalTiersFor('Internal Medicine');
    expect(tiers.map((t) => t.tier)).toEqual(['gold', 'silver']);
    expect(tiers.find((t) => t.tier === 'gold')?.limit).toBe(3);
    expect(tiers.find((t) => t.tier === 'silver')?.limit).toBe(12);
  });

  it('gives FM a single flat tier: 5 signals', () => {
    const tiers = signalTiersFor('Family Medicine');
    expect(tiers.map((t) => t.tier)).toEqual(['signal']);
    expect(tiers[0].limit).toBe(5);
  });
});

describe('tier ↔ specialty mapping', () => {
  it('assigns gold/silver to IM and signal to FM', () => {
    expect(specialtyForTier('gold')).toBe('Internal Medicine');
    expect(specialtyForTier('silver')).toBe('Internal Medicine');
    expect(specialtyForTier('signal')).toBe('Family Medicine');
  });

  it('checks tier membership per specialty', () => {
    expect(tierBelongsToSpecialty('gold', 'Internal Medicine')).toBe(true);
    expect(tierBelongsToSpecialty('signal', 'Internal Medicine')).toBe(false);
    expect(tierBelongsToSpecialty('signal', 'Family Medicine')).toBe(true);
    expect(tierBelongsToSpecialty('gold', 'Family Medicine')).toBe(false);
  });
});

describe('tierCounts & remainingForTier', () => {
  it('counts each tier independently', () => {
    const s = makeSignals([['gold', 2], ['silver', 5], ['signal', 1]]);
    expect(tierCounts(s)).toEqual({ gold: 2, silver: 5, signal: 1 });
  });

  it('reports remaining capacity, floored at 0', () => {
    const s = makeSignals([['gold', 3], ['silver', 10]]);
    expect(remainingForTier(s, 'gold')).toBe(0);
    expect(remainingForTier(s, 'silver')).toBe(2);
    expect(remainingForTier(s, 'signal')).toBe(5);
  });
});

describe('isValid & validationErrors', () => {
  it('accepts a full-but-legal IM board (3 gold + 12 silver)', () => {
    const s = makeSignals([['gold', 3], ['silver', 12]]);
    expect(isValid(s)).toBe(true);
    expect(validationErrors(s)).toEqual([]);
  });

  it('accepts a full-but-legal FM board (5 signals)', () => {
    const s = makeSignals([['signal', 5]]);
    expect(isValid(s)).toBe(true);
  });

  it('flags an over-limit gold tier with a helpful message', () => {
    const s = makeSignals([['gold', 4], ['silver', 12]]);
    expect(isValid(s)).toBe(false);
    const errs = validationErrors(s);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain('Gold');
    expect(errs[0]).toContain('limit is 3');
  });

  it('flags multiple over-limit tiers at once', () => {
    const s = makeSignals([['gold', 4], ['silver', 13]]);
    expect(validationErrors(s)).toHaveLength(2);
  });
});

describe('canAssign', () => {
  it('allows assigning when the target tier has room', () => {
    const s = makeSignals([['gold', 2], ['silver', 12]]);
    expect(canAssign(s, 'new-prog', 'gold')).toBe(true);
  });

  it('rejects assigning a new program to a full tier', () => {
    const s = makeSignals([['gold', 3], ['silver', 12]]);
    expect(canAssign(s, 'new-prog', 'gold')).toBe(false);
  });

  it('treats re-assigning a program to its own tier as a no-op (allowed)', () => {
    const s = makeSignals([['gold', 3], ['silver', 12]]);
    const existingGoldId = [...s.entries()].find(([, t]) => t === 'gold')![0];
    expect(canAssign(s, existingGoldId, 'gold')).toBe(true);
  });

  it('frees the old tier when moving a program between tiers', () => {
    // silver is full (12), gold has room (2). Moving an existing silver → gold
    // is fine: gold 2→3 (ok), silver 12→11 (ok).
    const s = makeSignals([['gold', 2], ['silver', 12]]);
    const existingSilverId = [...s.entries()].find(([, t]) => t === 'silver')![0];
    expect(canAssign(s, existingSilverId, 'gold')).toBe(true);
  });
});

describe('edge case: 3 gold + 12 silver full, resolve room for a 4th gold', () => {
  it('is invalid mid-rearrangement and valid once a silver is dropped', () => {
    // Start full and legal.
    const start = makeSignals([['gold', 3], ['silver', 12]]);
    expect(isValid(start)).toBe(true);

    const goldIds = [...start.entries()].filter(([, t]) => t === 'gold').map(([id]) => id);
    const silverIds = [...start.entries()].filter(([, t]) => t === 'silver').map(([id]) => id);

    // Stage: add a new program as gold → gold 4/3 (over).
    const staged = new Map(start);
    staged.set('new-gold', 'gold');
    expect(isValid(staged)).toBe(false);
    expect(tierCounts(staged).gold).toBe(4);

    // Demote one existing gold → silver: gold 3, silver 13 (silver now over).
    staged.set(goldIds[0], 'silver');
    expect(tierCounts(staged)).toMatchObject({ gold: 3, silver: 13 });
    expect(isValid(staged)).toBe(false);

    // Drop one silver: gold 3, silver 12 → valid.
    staged.delete(silverIds[0]);
    expect(tierCounts(staged)).toMatchObject({ gold: 3, silver: 12 });
    expect(isValid(staged)).toBe(true);
  });
});

describe('serialize / deserialize', () => {
  it('round-trips a signal map', () => {
    const s = makeSignals([['gold', 2], ['silver', 3]]);
    const round = deserializeSignals(JSON.parse(JSON.stringify(serializeSignals(s))));
    expect(round).toEqual(s);
  });

  it('drops entries with invalid tier values', () => {
    const parsed = deserializeSignals({ a: 'gold', b: 'bogus', c: 'signal' });
    expect(parsed.get('a')).toBe('gold');
    expect(parsed.has('b')).toBe(false);
    expect(parsed.get('c')).toBe('signal');
  });

  it('returns an empty map for non-object input', () => {
    expect(deserializeSignals(null).size).toBe(0);
    expect(deserializeSignals('nope').size).toBe(0);
  });
});

describe('SIGNAL_LIMITS constant', () => {
  it('matches the documented per-tier limits', () => {
    expect(SIGNAL_LIMITS).toEqual({ gold: 3, silver: 12, signal: 5 });
  });
});
