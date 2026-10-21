import { describe, it, expect } from 'vitest';
import {
  CRITERIA,
  MAX_SCORE_TOTAL,
  isRatingComplete,
  ratedCount,
  scoreTotal,
  type Ratings,
} from '../interview-criteria';
import {
  ELO_BASE,
  applyResult,
  computeStandings,
  expectedScore,
  pairKey,
  pickPair,
  type EloMatch,
} from '../elo';
import { deserializeInterviewData, interviewKey, newInterviewRecord } from '../interview-store';

function allScores(score: number): Ratings {
  return Object.fromEntries(CRITERIA.map((c) => [c.id, score])) as Ratings;
}

function match(id: string, winner: string, loser: string, note = ''): EloMatch {
  return { id, winner, loser, note, at: Number(id.replace(/\D/g, '')) || 0 };
}

describe('interview criteria', () => {
  it('has the 15 Program_Rankings.md criteria, unweighted, max total 75', () => {
    expect(CRITERIA).toHaveLength(15);
    expect(MAX_SCORE_TOTAL).toBe(75);
    expect(CRITERIA.every((c) => !('weight' in c))).toBe(true);
  });

  it('computes a plain score total, count, and completeness', () => {
    expect(scoreTotal(allScores(5))).toBe(75);
    expect(scoreTotal(allScores(1))).toBe(15);
    const partial: Ratings = { location: 5, research: 1 };
    expect(scoreTotal(partial)).toBe(6);
    expect(ratedCount(partial)).toBe(2);
    expect(isRatingComplete(partial)).toBe(false);
    expect(isRatingComplete(allScores(3))).toBe(true);
  });

  it('ignores invalid scores', () => {
    const bad = { location: 7, workLife: 0, salary: 2.5 } as unknown as Ratings;
    expect(ratedCount(bad)).toBe(0);
    expect(scoreTotal(bad)).toBe(0);
  });
});

describe('Elo', () => {
  it('starts every program at 1500 with no matches', () => {
    const s = computeStandings(['a', 'b'], []);
    expect(s.get('a')).toEqual({ elo: ELO_BASE, wins: 0, losses: 0 });
    expect(s.get('b')!.elo).toBe(ELO_BASE);
  });

  it('expected score is 0.5 for equal ratings and symmetric', () => {
    expect(expectedScore(1500, 1500)).toBe(0.5);
    expect(expectedScore(1600, 1500) + expectedScore(1500, 1600)).toBeCloseTo(1);
  });

  it('a win conserves total rating and rewards upsets more', () => {
    const [w, l] = applyResult(1500, 1500);
    expect(w + l).toBeCloseTo(3000);
    expect(w - 1500).toBeCloseTo(16);
    const [upsetWinner] = applyResult(1400, 1600);
    const [favWinner] = applyResult(1600, 1400);
    expect(upsetWinner - 1400).toBeGreaterThan(favWinner - 1600);
  });

  it('replays matches in order and tracks W/L', () => {
    const s = computeStandings(['a', 'b', 'c'], [match('1', 'a', 'b'), match('2', 'a', 'c'), match('3', 'b', 'c')]);
    expect(s.get('a')!.wins).toBe(2);
    expect(s.get('c')!.losses).toBe(2);
    expect(s.get('a')!.elo).toBeGreaterThan(s.get('b')!.elo);
    expect(s.get('b')!.elo).toBeGreaterThan(s.get('c')!.elo);
  });

  it('skips matches for removed programs and self-matches', () => {
    const s = computeStandings(['a'], [match('1', 'a', 'gone'), match('2', 'a', 'a')]);
    expect(s.get('a')!.elo).toBe(1500);
    expect(s.get('a')!.wins).toBe(0);
  });

  it('undoing the last match restores the prior standings exactly', () => {
    const matches = [match('1', 'a', 'b'), match('2', 'b', 'a')];
    const before = computeStandings(['a', 'b'], matches.slice(0, 1));
    const undone = computeStandings(['a', 'b'], matches.slice(0, -1));
    expect(undone).toEqual(before);
  });

  it('pairKey is order-independent', () => {
    expect(pairKey('x', 'y')).toBe(pairKey('y', 'x'));
  });

  it('pickPair returns null for <2 candidates and two distinct keys otherwise', () => {
    expect(pickPair([{ key: 'a', elo: 1500 }], [])).toBeNull();
    const p = pickPair(
      [
        { key: 'a', elo: 1500 },
        { key: 'b', elo: 1500 },
        { key: 'c', elo: 1500 },
      ],
      [],
      () => 0.3,
    );
    expect(p).not.toBeNull();
    expect(p![0]).not.toBe(p![1]);
  });

  it('pickPair avoids the just-played pair when an alternative exists', () => {
    const cands = [
      { key: 'a', elo: 1500 },
      { key: 'b', elo: 1500 },
      { key: 'c', elo: 1500 },
    ];
    for (const r of [0, 0.1, 0.4, 0.7, 0.99]) {
      const p = pickPair(cands, [], () => r, ['a', 'b']);
      expect(pairKey(p![0], p![1])).not.toBe(pairKey('a', 'b'));
    }
  });

  it('pickPair still returns the avoided pair when it is the only one', () => {
    const p = pickPair([{ key: 'a', elo: 1500 }, { key: 'b', elo: 1500 }], [], () => 0.5, ['a', 'b']);
    expect(pairKey(p![0], p![1])).toBe(pairKey('a', 'b'));
  });
});

describe('interview store', () => {
  it('keys by specialty + guid so FM and IM never collide', () => {
    expect(interviewKey('Family Medicine', 'g1')).not.toBe(interviewKey('Internal Medicine', 'g1'));
  });

  it('round-trips a record and drops malformed data', () => {
    const key = interviewKey('Internal Medicine', 'g1');
    const rec = {
      ...newInterviewRecord({ key, name: 'Prog', specialty: 'Internal Medicine', city: 'X', state: 'NY' }, 1),
      ratings: { location: 4, bogus: 3, salary: 9 },
      criterionNotes: { location: 'near family', bogus: 'x' },
      status: 'completed',
    };
    const parsed = deserializeInterviewData(
      JSON.parse(
        JSON.stringify({
          records: { [key]: rec, broken: { specialty: 'Surgery' } },
          matches: [{ id: 'm1', winner: key, loser: 'z', note: 'why', at: 5 }, { id: 2 }],
        }),
      ),
    );
    expect(Object.keys(parsed.records)).toEqual([key]);
    expect(parsed.records[key].ratings).toEqual({ location: 4 });
    expect(parsed.records[key].criterionNotes).toEqual({ location: 'near family' });
    expect(parsed.records[key].status).toBe('completed');
    expect(parsed.matches).toHaveLength(1);
    expect(parsed.matches[0].note).toBe('why');
  });

  it('returns empty data for garbage input', () => {
    expect(deserializeInterviewData(null)).toEqual({ records: {}, matches: [] });
    expect(deserializeInterviewData('nope')).toEqual({ records: {}, matches: [] });
  });
});
