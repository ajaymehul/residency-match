import { describe, it, expect } from 'vitest';
import { scorePosition } from '../scoring';
import type { FieldValue, ScoreRange } from '../types';

describe('scorePosition', () => {
  const range: FieldValue<ScoreRange> = { kind: 'present', value: { low: 200, high: 250 } };

  it('returns "below" when applicant score is less than low bound', () => {
    expect(scorePosition(199, range)).toBe('below');
    expect(scorePosition(100, range)).toBe('below');
  });

  it('returns "above" when applicant score is greater than high bound', () => {
    expect(scorePosition(251, range)).toBe('above');
    expect(scorePosition(300, range)).toBe('above');
  });

  it('returns "within" when applicant score equals the low bound', () => {
    expect(scorePosition(200, range)).toBe('within');
  });

  it('returns "within" when applicant score equals the high bound', () => {
    expect(scorePosition(250, range)).toBe('within');
  });

  it('returns "within" when applicant score is between low and high', () => {
    expect(scorePosition(225, range)).toBe('within');
  });

  it('returns null when range is missing', () => {
    const missing: FieldValue<ScoreRange> = { kind: 'missing' };
    expect(scorePosition(223, missing)).toBeNull();
  });

  it('returns null when range is invalid', () => {
    const invalid: FieldValue<ScoreRange> = { kind: 'invalid', raw: 'bad' };
    expect(scorePosition(223, invalid)).toBeNull();
  });
});
