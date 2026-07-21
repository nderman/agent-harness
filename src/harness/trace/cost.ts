/**
 * Cost is derived from usage, never stored on the event (DESIGN Decision 6:
 * reports are pure functions of traces). Prices are USD per 1M tokens.
 */
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-opus-4-8': { input: 5.0, output: 25.0 },
};

export function costUsd(model: string, tokens: { input: number; output: number }): number {
  const price = PRICING[model] ?? { input: 0, output: 0 };
  return (tokens.input * price.input + tokens.output * price.output) / 1_000_000;
}
