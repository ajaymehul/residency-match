import { describe, it, expect } from 'vitest';
import { bestSignalSentRate } from '../match-scoring';
import type { ScrapedProgram } from '../scraped-data-loader';

/** Minimal ScrapedProgram carrying just the signal_rates block. */
function withSignalRates(series: Record<string, number> | undefined): ScrapedProgram {
  return {
    guid: 'g',
    url: 'u',
    ...(series ? { signal_rates: { series, parameters: {} } } : {}),
  } as unknown as ScrapedProgram;
}

describe('bestSignalSentRate', () => {
  it('returns the FM flat "Sent" rate', () => {
    expect(bestSignalSentRate(withSignalRates({ Sent: 74, 'Did Not Send': 45 }))).toBe(74);
  });

  it('returns the best (Gold) rate for the IM two-tier schema', () => {
    expect(
      bestSignalSentRate(
        withSignalRates({ 'Gold Sent': 36, 'Silver Sent': 25, 'Did Not Send': 4 }),
      ),
    ).toBe(36);
  });

  it('uses Silver when it exceeds Gold', () => {
    expect(
      bestSignalSentRate(withSignalRates({ 'Gold Sent': 20, 'Silver Sent': 30, 'Did Not Send': 4 })),
    ).toBe(30);
  });

  it('returns null when signal_rates is absent', () => {
    expect(bestSignalSentRate(withSignalRates(undefined))).toBeNull();
  });

  it('returns null when no sent-rate keys are present', () => {
    expect(bestSignalSentRate(withSignalRates({ 'Did Not Send': 4 }))).toBeNull();
  });

  it('clamps out-of-range values into 0–100', () => {
    expect(bestSignalSentRate(withSignalRates({ Sent: 150 }))).toBe(100);
    expect(bestSignalSentRate(withSignalRates({ Sent: -5 }))).toBe(0);
  });
});
