import { describe, it, expect } from 'vitest';
import { CollectingTracer } from '../trace/tracer';
import { computeMetrics } from './metrics';

describe('computeMetrics', () => {
  it('sums tokens, counts calls (excluding resolve), and prices the run at the traced model', () => {
    const tracer = new CollectingTracer();
    tracer.emit({ type: 'model_request', model: 'claude-haiku-4-5', messageCount: 1 });
    tracer.emit({ type: 'model_response', stopReason: 'tool_use', usage: { input: 1000, output: 100 }, latencyMs: 0 });
    tracer.emit({ type: 'tool_call', tool: 'lookup_payment', ok: true, input: {}, reason: undefined });
    tracer.emit({ type: 'guardrail_decision', tool: 'issue_refund', allowed: false, policy: 'ceiling', reason: 'over' });
    tracer.emit({ type: 'tool_call', tool: 'resolve', ok: true, input: {}, reason: undefined });

    const m = computeMetrics(tracer);
    expect(m).toMatchObject({ modelCalls: 1, inputTokens: 1000, outputTokens: 100, toolCalls: 1, guardrailDenials: 1 });
    expect(m.costUsd).toBeCloseTo((1000 * 1 + 100 * 5) / 1_000_000);
  });
});
