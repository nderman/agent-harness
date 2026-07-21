import { describe, it, expect } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { canonicalStringify, fingerprint } from './fingerprint';

function baseRequest(): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    system: 'You are a payments agent.',
    messages: [{ role: 'user', content: 'refund pay_001' }],
    tools: [{ name: 'lookup_payment', description: 'look up a payment', input_schema: { type: 'object' } }],
  };
}

describe('canonicalStringify', () => {
  it('is independent of object key order', () => {
    expect(canonicalStringify({ a: 1, b: 2 })).toBe(canonicalStringify({ b: 2, a: 1 }));
    expect(canonicalStringify({ x: { p: 1, q: 2 } })).toBe(canonicalStringify({ x: { q: 2, p: 1 } }));
  });

  it('preserves array order', () => {
    expect(canonicalStringify([1, 2, 3])).not.toBe(canonicalStringify([3, 2, 1]));
  });
});

describe('fingerprint', () => {
  it('is stable for the same request', () => {
    expect(fingerprint(baseRequest())).toBe(fingerprint(baseRequest()));
  });

  it('is independent of key order within the request', () => {
    const reordered: Anthropic.MessageCreateParamsNonStreaming = {
      tools: [{ input_schema: { type: 'object' }, description: 'look up a payment', name: 'lookup_payment' }],
      messages: [{ content: 'refund pay_001', role: 'user' }],
      system: 'You are a payments agent.',
      max_tokens: 4096,
      model: 'claude-haiku-4-5',
    };
    expect(fingerprint(reordered)).toBe(fingerprint(baseRequest()));
  });

  it('changes when any of model / system / messages / tools changes', () => {
    const base = fingerprint(baseRequest());
    expect(fingerprint({ ...baseRequest(), model: 'claude-opus-4-8' })).not.toBe(base);
    expect(fingerprint({ ...baseRequest(), system: 'different' })).not.toBe(base);
    expect(fingerprint({ ...baseRequest(), messages: [{ role: 'user', content: 'refund pay_002' }] })).not.toBe(base);
    expect(fingerprint({ ...baseRequest(), tools: [] })).not.toBe(base);
  });

  it('ignores generation knobs like max_tokens (deliberate — see DESIGN Decision 2)', () => {
    expect(fingerprint({ ...baseRequest(), max_tokens: 1 })).toBe(fingerprint(baseRequest()));
  });
});
