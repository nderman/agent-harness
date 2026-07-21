import { describe, it, expect } from 'vitest';
import type { Resolution } from '../../agent/resolution';
import { CollectingTracer } from '../trace/tracer';
import { checkFaithfulness } from './faithfulness';

function tracerWithRefund(ok: boolean): CollectingTracer {
  const tracer = new CollectingTracer();
  tracer.emit({ type: 'tool_call', tool: 'issue_refund', ok, input: {}, reason: ok ? undefined : 'denied' });
  return tracer;
}

describe('checkFaithfulness', () => {
  it('passes a refunded resolution backed by a successful refund', () => {
    const r: Resolution = { action: 'refunded', message: 'Your payment has been refunded.', references: ['re_1'] };
    expect(checkFaithfulness(r, tracerWithRefund(true))).toEqual([]);
  });

  it('catches a message claiming a refund the run never performed (the dangerous case)', () => {
    const r: Resolution = { action: 'escalated', message: 'Good news — your payment has been refunded.', references: ['tkt_1'] };
    const violations = checkFaithfulness(r, new CollectingTracer()); // no refund in the trace
    expect(violations.join(' ')).toContain('claims a completed refund');
  });

  it('catches action=refunded with no refund in the trace', () => {
    const r: Resolution = { action: 'refunded', message: 'All done.', references: ['re_1'] };
    expect(checkFaithfulness(r, new CollectingTracer()).join(' ')).toContain('no successful refund');
  });

  it('catches a refund that happened but was reported as escalated', () => {
    const r: Resolution = { action: 'escalated', message: 'Escalated to a human.', references: ['tkt_1'] };
    expect(checkFaithfulness(r, tracerWithRefund(true)).join(' ')).toContain('refund occurred');
  });

  it('catches a refunded action whose references cite no refund id', () => {
    const r: Resolution = { action: 'refunded', message: 'Refunded.', references: ['pay_001'] };
    expect(checkFaithfulness(r, tracerWithRefund(true)).join(' ')).toContain('no refund id');
  });
});
