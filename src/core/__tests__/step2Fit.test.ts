import { describe, it, expect } from 'vitest';
import { step2Fit } from '../scoring';
import { UNAVAILABLE } from '../types';
import type { FieldValue, ScoreRange } from '../types';

describe('step2Fit', () => {
  const present = (low: number, high: number): FieldValue<ScoreRange> => ({
    kind: 'present',
    value: { low, high },
  });

  describe('returns UNAVAILABLE for missing/invalid ranges', () => {
    it('returns UNAVAILABLE for missing range', () => {
      expect(step2Fit(230, { kind: 'missing' })).toBe(UNAVAILABLE);
    });

    it('returns UNAVAILABLE for invalid range', () => {
      expect(step2Fit(230, { kind: 'invalid', raw: 'bad' })).toBe(UNAVAILABLE);
    });
  });

  describe('score >= mid returns 100', () => {
    it('score exactly at midpoint', () => {
      // range 200-240, mid = 220
      expect(step2Fit(220, present(200, 240))).toBe(100);
    });

    it('score above midpoint', () => {
      // range 200-240, mid = 220
      expect(step2Fit(250, present(200, 240))).toBe(100);
    });
  });

  describe('low <= score < mid: linear interpolation from 70 to 100', () => {
    it('score at low bound returns 70', () => {
      // range 200-240, mid = 220
      expect(step2Fit(200, present(200, 240))).toBe(70);
    });

    it('score halfway between low and mid returns 85', () => {
      // range 200-240, mid = 220; halfway = 210
      expect(step2Fit(210, present(200, 240))).toBe(85);
    });

    it('score just below mid', () => {
      // range 200-240, mid = 220; score = 219
      const result = step2Fit(219, present(200, 240));
      // (219 - 200) / (220 - 200) * 30 + 70 = 19/20 * 30 + 70 = 28.5 + 70 = 98.5
      expect(result).toBeCloseTo(98.5);
    });
  });

  describe('score < low: max(0, 70 * (1 - (low - score) / 30))', () => {
    it('score 1 point below low', () => {
      // range 200-240, score = 199
      // 70 * (1 - 1/30) = 70 * (29/30) ≈ 67.67
      const result = step2Fit(199, present(200, 240));
      expect(result).toBeCloseTo(70 * (1 - 1 / 30));
    });

    it('score 15 points below low', () => {
      // range 200-240, score = 185
      // 70 * (1 - 15/30) = 70 * 0.5 = 35
      expect(step2Fit(185, present(200, 240))).toBe(35);
    });

    it('score 30 points below low returns 0', () => {
      // range 200-240, score = 170
      // 70 * (1 - 30/30) = 70 * 0 = 0
      expect(step2Fit(170, present(200, 240))).toBe(0);
    });

    it('score more than 30 points below low returns 0', () => {
      // range 200-240, score = 100
      // 70 * (1 - 100/30) = 70 * (negative) → max(0, ...) = 0
      expect(step2Fit(100, present(200, 240))).toBe(0);
    });
  });

  describe('output is always in [0, 100]', () => {
    it('never exceeds 100 for very high scores', () => {
      expect(step2Fit(999, present(200, 240))).toBe(100);
    });

    it('never goes below 0 for very low scores', () => {
      expect(step2Fit(0, present(200, 240))).toBe(0);
    });
  });

  describe('edge cases with equal low and high', () => {
    it('range with low === high: mid = low = high; score at mid returns 100', () => {
      // range 220-220, mid = 220
      expect(step2Fit(220, present(220, 220))).toBe(100);
    });

    it('range with low === high: score below low', () => {
      // range 220-220, mid = 220, score = 210
      // 70 * (1 - 10/30) = 70 * (2/3) ≈ 46.67
      const result = step2Fit(210, present(220, 220));
      expect(result).toBeCloseTo(70 * (2 / 3));
    });
  });
});
