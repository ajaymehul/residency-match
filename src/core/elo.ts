/**
 * Elo ranking for interviewed programs.
 *
 * Ratings are never stored. They are recomputed by replaying the match
 * history from each program's seed, where the seed comes from its current
 * criteria ratings. That means:
 *  - editing a criterion score later re-ranks correctly (the seed moves and
 *    every match is replayed on top of it),
 *  - undoing or deleting a match is exact,
 *  - removing an interview drops its matches from the replay.
 *
 * Every program starts at the same 1500, regardless of its criteria ratings.
 * Only head-to-head picks move Elo. A 100-point gap ≈ 64% expected win rate.
 */

export const ELO_BASE = 1500;
export const ELO_K = 32;

export interface EloMatch {
  id: string;
  winner: string;
  loser: string;
  /** Why the winner was preferred (free text). */
  note?: string;
  /** Epoch ms. */
  at: number;
}

export interface EloStanding {
  elo: number;
  wins: number;
  losses: number;
}

/** Probability that a player rated `ra` beats one rated `rb`. */
export function expectedScore(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

/** New [winner, loser] ratings after one game. */
export function applyResult(winner: number, loser: number, k = ELO_K): [number, number] {
  const delta = k * (1 - expectedScore(winner, loser));
  return [winner + delta, loser - delta];
}

/**
 * Replay `matches` in order, starting every key at ELO_BASE. Matches that
 * reference a key not in `keys` (e.g. a removed interview) or a self-match
 * are skipped.
 */
export function computeStandings(
  keys: Iterable<string>,
  matches: readonly EloMatch[],
  k = ELO_K,
): Map<string, EloStanding> {
  const standings = new Map<string, EloStanding>();
  for (const key of keys) {
    standings.set(key, { elo: ELO_BASE, wins: 0, losses: 0 });
  }
  for (const m of matches) {
    if (m.winner === m.loser) continue;
    const w = standings.get(m.winner);
    const l = standings.get(m.loser);
    if (!w || !l) continue;
    const [nw, nl] = applyResult(w.elo, l.elo, k);
    w.elo = nw;
    l.elo = nl;
    w.wins += 1;
    l.losses += 1;
  }
  return standings;
}

/** Order-independent key for a pair of programs. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

/**
 * Pick two programs to compare. Random, but weighted toward pairs that have
 * met less often and are closer in Elo (the most informative games). Avoids
 * repeating `avoid` unless it is the only possible pair.
 * Returns null when fewer than two candidates exist.
 */
export function pickPair(
  candidates: ReadonlyArray<{ key: string; elo: number }>,
  matches: readonly EloMatch[],
  rng: () => number = Math.random,
  avoid?: readonly [string, string] | null,
): [string, string] | null {
  if (candidates.length < 2) return null;

  const met = new Map<string, number>();
  for (const m of matches) {
    const pk = pairKey(m.winner, m.loser);
    met.set(pk, (met.get(pk) ?? 0) + 1);
  }
  const avoidKey = avoid ? pairKey(avoid[0], avoid[1]) : null;

  const pairs: Array<{ a: string; b: string; w: number }> = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      const pk = pairKey(a.key, b.key);
      const n = met.get(pk) ?? 0;
      const closeness = Math.exp(-Math.abs(a.elo - b.elo) / 200);
      pairs.push({ a: a.key, b: b.key, w: (pk === avoidKey ? 0 : closeness / Math.pow(1 + n, 2)) });
    }
  }

  let total = pairs.reduce((s, p) => s + p.w, 0);
  if (total <= 0) {
    // Only the avoided pair exists — allow it.
    for (const p of pairs) p.w = 1;
    total = pairs.length;
  }

  let r = rng() * total;
  let chosen = pairs[pairs.length - 1];
  for (const p of pairs) {
    if (p.w <= 0) continue; // never land on a zero-weight (avoided) pair
    chosen = p;
    if (r < p.w) break;
    r -= p.w;
  }
  // Randomize left/right placement so position doesn't bias picks.
  return rng() < 0.5 ? [chosen.a, chosen.b] : [chosen.b, chosen.a];
}
