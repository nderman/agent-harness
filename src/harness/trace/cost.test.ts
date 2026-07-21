import { describe, it, expect } from 'vitest';
import { costUsd } from './cost';

describe('costUsd', () => {
  it('prices haiku input+output', () => {
    expect(costUsd('claude-haiku-4-5', { input: 1_000_000, output: 1_000_000 })).toBeCloseTo(6.0);
  });

  it('prices opus higher', () => {
    expect(costUsd('claude-opus-4-8', { input: 1_000_000, output: 0 })).toBeCloseTo(5.0);
  });

  it('returns 0 for an unknown model rather than throwing', () => {
    expect(costUsd('mystery-model', { input: 1000, output: 1000 })).toBe(0);
  });
});
