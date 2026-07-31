// Smoke test: verifies the Vitest + jsdom + fast-check toolchain is wired up.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('project scaffold', () => {
  it('runs tests in a jsdom environment', () => {
    const el = document.createElement('div');
    el.textContent = 'hello';
    expect(el.textContent).toBe('hello');
  });

  it('runs fast-check properties', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        expect(a + b).toBe(b + a);
      }),
      { numRuns: 100 },
    );
  });
});
