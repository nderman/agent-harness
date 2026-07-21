import { describe, it, expect } from 'vitest';
import { toJsonl } from './jsonl';

describe('toJsonl', () => {
  it('emits one JSON object per line, newline-terminated', () => {
    const out = toJsonl([
      { type: 'run_started', input: 'hi' },
      { type: 'model_request', model: 'claude-haiku-4-5', messageCount: 1 },
    ]);
    expect(out.trimEnd().split('\n')).toEqual([
      '{"type":"run_started","input":"hi"}',
      '{"type":"model_request","model":"claude-haiku-4-5","messageCount":1}',
    ]);
    expect(out.endsWith('\n')).toBe(true);
  });

  it('produces an empty-ish string for no events', () => {
    expect(toJsonl([])).toBe('\n');
  });
});
