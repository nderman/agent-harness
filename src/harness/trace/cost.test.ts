import { describe, it, expect } from 'vitest';
import { costUsd } from './cost';

describe('costUsd', () => {
  it('prices haiku input+output', () => {
    expect(costUsd('claude-haiku-4-5', { input: 1_000_000, output: 1_000_000 })).toBeCloseTo(6.0);
  });

  it('prices opus higher', () => {
    expect(costUsd('claude-opus-4-8', { input: 1_000_000, output: 0 })).toBeCloseTo(5.0);
  });

  it('throws on an unknown model rather than silently pricing at $0', () => {
    expect(() => costUsd('mystery-model', { input: 1000, output: 1000 })).toThrow(/no pricing/);
  });
});
