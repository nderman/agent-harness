import { describe, it, expect } from 'vitest';
import { SequentialIdGenerator } from '../harness/determinism';
import { createPaymentsDb } from './payments-db';
import { DOMAIN_TOOLS, escalateTool, issueRefundTool, lookupPaymentTool, type RegisteredTool, type ToolContext } from './tools';

function makeCtx(): ToolContext {
  const ids = new SequentialIdGenerator();
  return { db: createPaymentsDb(ids), ids };
}

/** Gate 1 + execute, skipping Gate 2 — for exercising parse/run in isolation. */
function parseAndRun(tool: RegisteredTool, input: unknown, ctx: ToolContext): unknown {
  const parsed = tool.parse(input);
  if (!parsed.ok) throw new Error(`parse failed: ${parsed.error}`);
  return tool.run(parsed.value, ctx);
}

describe('lookup_payment', () => {
  it('finds by id and by email, and reports not-found', () => {
    const ctx = makeCtx();
    expect(parseAndRun(lookupPaymentTool, { payment_id: 'pay_001' }, ctx)).toMatchObject({ found: true, payment: { id: 'pay_001' } });
    expect(parseAndRun(lookupPaymentTool, { customer_email: 'alice@example.com' }, ctx)).toMatchObject({ found: true, payments: [{ id: 'pay_001' }] });
    expect(parseAndRun(lookupPaymentTool, { payment_id: 'pay_999' }, ctx)).toEqual({ found: false });
  });

  it('is not gated by a policy (read-only)', () => {
    expect(lookupPaymentTool.policy).toBeUndefined();
  });
});

describe('issue_refund', () => {
  it('rejects malformed arguments at Gate 1 (parse)', () => {
    expect(issueRefundTool.parse({ payment_id: 'pay_001', amount: -5, reason: '' })).toMatchObject({ ok: false });
  });

  it('refunds when run on parsed, allowed input', () => {
    const ctx = makeCtx();
    const result = parseAndRun(issueRefundTool, { payment_id: 'pay_001', amount: 4250, reason: 'cancelled' }, ctx);
    expect(result).toMatchObject({ ok: true, refund: { id: 're_1', amount: 4250 } });
    expect(ctx.db.findById('pay_001')?.status).toBe('refunded');
  });

  it('carries a Gate 2 policy that denies an over-ceiling refund', () => {
    const ctx = makeCtx();
    expect(issueRefundTool.policy).toBeDefined();
    expect(issueRefundTool.policy?.({ payment_id: 'pay_002', amount: 120000, reason: 'x' }, ctx)).toMatchObject({
      allowed: false,
      policy: 'ceiling',
    });
  });
});

describe('escalate', () => {
  it('opens a ticket with a deterministic id', () => {
    expect(parseAndRun(escalateTool, { reason: 'ambiguous', priority: 'high' }, makeCtx())).toEqual({ ticket_id: 'tkt_1', priority: 'high' });
  });

  it('rejects an out-of-range priority at Gate 1', () => {
    expect(escalateTool.parse({ reason: 'x', priority: 'urgent' })).toMatchObject({ ok: false });
  });
});

describe('DOMAIN_TOOLS', () => {
  it('exposes each tool with an object input schema and no leaked $schema', () => {
    expect(DOMAIN_TOOLS.map((t) => t.name)).toEqual(['lookup_payment', 'issue_refund', 'escalate']);
    for (const tool of DOMAIN_TOOLS) {
      expect(tool.inputSchema).toMatchObject({ type: 'object' });
      expect(tool.inputSchema).not.toHaveProperty('$schema');
    }
  });
});
