import { describe, it, expect } from 'vitest';
import { SequentialIdGenerator } from '../harness/determinism';
import { createPaymentsDb } from './payments-db';
import { DOMAIN_TOOLS, escalateTool, issueRefundTool, lookupPaymentTool, type ToolContext } from './tools';

function makeCtx(): ToolContext {
  const ids = new SequentialIdGenerator();
  return { db: createPaymentsDb(ids), ids };
}

describe('lookup_payment', () => {
  it('finds by id', () => {
    const out = lookupPaymentTool.invoke({ payment_id: 'pay_001' }, makeCtx());
    expect(out).toEqual({ status: 'ok', result: { found: true, payment: expect.objectContaining({ id: 'pay_001' }) } });
  });

  it('finds by email', () => {
    const out = lookupPaymentTool.invoke({ customer_email: 'alice@example.com' }, makeCtx());
    expect(out.status).toBe('ok');
    expect(out).toMatchObject({ result: { found: true, payments: [{ id: 'pay_001' }] } });
  });

  it('reports not found for an unknown id', () => {
    const out = lookupPaymentTool.invoke({ payment_id: 'pay_999' }, makeCtx());
    expect(out).toEqual({ status: 'ok', result: { found: false } });
  });
});

describe('issue_refund', () => {
  it('refunds a known payment and returns a refund with a deterministic id', () => {
    const ctx = makeCtx();
    const out = issueRefundTool.invoke({ payment_id: 'pay_001', amount: 4250, reason: 'cancelled' }, ctx);
    expect(out).toMatchObject({ status: 'ok', result: { ok: true, refund: { id: 're_1', amount: 4250 } } });
    expect(ctx.db.findById('pay_001')?.status).toBe('refunded');
  });

  it('rejects malformed arguments at Gate 1 without touching the db', () => {
    const ctx = makeCtx();
    const out = issueRefundTool.invoke({ payment_id: 'pay_001', amount: -5, reason: '' }, ctx);
    expect(out.status).toBe('invalid');
    expect(ctx.db.findById('pay_001')?.status).toBe('captured');
  });

  it('returns a structured error (not a throw) for an unknown payment', () => {
    const out = issueRefundTool.invoke({ payment_id: 'pay_999', amount: 1, reason: 'x' }, makeCtx());
    expect(out).toMatchObject({ status: 'ok', result: { ok: false } });
  });
});

describe('escalate', () => {
  it('opens a ticket with a deterministic id', () => {
    const out = escalateTool.invoke({ reason: 'ambiguous request', priority: 'high' }, makeCtx());
    expect(out).toEqual({ status: 'ok', result: { ticket_id: 'tkt_1', priority: 'high' } });
  });

  it('rejects an out-of-range priority at Gate 1', () => {
    const out = escalateTool.invoke({ reason: 'x', priority: 'urgent' }, makeCtx());
    expect(out.status).toBe('invalid');
  });
});

describe('DOMAIN_TOOLS', () => {
  it('exposes each tool with an object input schema for the API', () => {
    expect(DOMAIN_TOOLS.map((t) => t.name)).toEqual(['lookup_payment', 'issue_refund', 'escalate']);
    for (const tool of DOMAIN_TOOLS) {
      expect(tool.inputSchema).toMatchObject({ type: 'object' });
      expect(tool.inputSchema).not.toHaveProperty('$schema');
    }
  });
});
