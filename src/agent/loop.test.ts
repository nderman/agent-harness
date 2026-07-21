import { describe, it, expect } from 'vitest';
import { SequentialIdGenerator } from '../harness/determinism';
import {
  FakeModelClient,
  assistantMessage,
  textBlock,
  toolUseTurn,
} from '../harness/model-client/fake-client';
import { makeModelClientError } from '../harness/model-client/types';
import { CollectingTracer } from '../harness/trace/tracer';
import { createPaymentsDb } from './payments-db';
import { runAgent } from './loop';
import { DOMAIN_TOOLS, type ToolContext } from './tools';

function makeCtx(): ToolContext {
  const ids = new SequentialIdGenerator();
  return { db: createPaymentsDb(ids), ids };
}

describe('runAgent — happy path', () => {
  it('looks up, refunds, and resolves against the scripted seam', async () => {
    const ctx = makeCtx();
    const client = new FakeModelClient([
      toolUseTurn('tu1', 'lookup_payment', { payment_id: 'pay_001' }),
      toolUseTurn('tu2', 'issue_refund', { payment_id: 'pay_001', amount: 4250, reason: 'order cancelled' }),
      toolUseTurn('tu3', 'resolve', { action: 'refunded', message: 'Refunded €42.50.', references: ['re_1', 'pay_001'] }),
    ]);
    const tracer = new CollectingTracer();

    const outcome = await runAgent({ client, input: 'refund pay_001', tools: DOMAIN_TOOLS, ctx, tracer });

    expect(outcome).toEqual({ ok: true, resolution: { action: 'refunded', message: 'Refunded €42.50.', references: ['re_1', 'pay_001'] } });
    expect(ctx.db.findById('pay_001')?.status).toBe('refunded');
    expect(client.requests).toHaveLength(3);
    // the tools list the model saw includes the terminal resolve tool
    expect(client.requests[0]?.tools?.map((t) => t.name)).toEqual(['lookup_payment', 'issue_refund', 'escalate', 'resolve']);
    expect(tracer.ofType('run_completed')).toEqual([{ type: 'run_completed', ok: true, reason: undefined }]);
  });
});

describe('runAgent — model-behaviour re-prompts (bounded)', () => {
  it('recovers when a schema-invalid tool call is followed by a valid resolution', async () => {
    const ctx = makeCtx();
    const client = new FakeModelClient([
      toolUseTurn('tu1', 'issue_refund', { payment_id: 'pay_001', amount: -5, reason: '' }), // Gate 1 rejects
      toolUseTurn('tu2', 'resolve', { action: 'answered', message: 'Sorted.', references: [] }),
    ]);

    const outcome = await runAgent({ client, input: 'help', tools: DOMAIN_TOOLS, ctx });

    expect(outcome.ok).toBe(true);
    expect(ctx.db.findById('pay_001')?.status).toBe('captured'); // the bad refund never executed
  });

  it('fails with reprompt_exhausted once the bound is passed', async () => {
    const ctx = makeCtx();
    const client = new FakeModelClient([
      toolUseTurn('tu1', 'issue_refund', { amount: -5 }),
      toolUseTurn('tu2', 'issue_refund', { amount: -5 }),
    ]);

    const outcome = await runAgent({ client, input: 'help', tools: DOMAIN_TOOLS, ctx, config: { maxReprompts: 1 } });

    expect(outcome).toMatchObject({ ok: false, reason: 'reprompt_exhausted' });
  });

  it('attributes the failure to its cause — an empty turn does not spend the invalid-emission budget', async () => {
    // With one shared counter this would bail at the empty turn as `no_resolution`;
    // with independent budgets it runs on and fails as `reprompt_exhausted`.
    const ctx = makeCtx();
    const client = new FakeModelClient([
      toolUseTurn('t1', 'issue_refund', { amount: -5 }), // invalid emission #1
      assistantMessage([textBlock('thinking...')], 'end_turn'), // one empty turn
      toolUseTurn('t2', 'issue_refund', { amount: -5 }), // invalid emission #2 → over cap
    ]);

    const outcome = await runAgent({ client, input: 'help', tools: DOMAIN_TOOLS, ctx, config: { maxReprompts: 1 } });

    expect(outcome).toMatchObject({ ok: false, reason: 'reprompt_exhausted' });
    expect(client.requests).toHaveLength(3); // did not bail early at the empty turn
  });

  it('recovers when resolve is called with invalid arguments then corrected', async () => {
    const ctx = makeCtx();
    const client = new FakeModelClient([
      toolUseTurn('r1', 'resolve', { action: 'refunded' }), // missing message + references
      toolUseTurn('r2', 'resolve', { action: 'answered', message: 'All set.', references: [] }),
    ]);

    const outcome = await runAgent({ client, input: 'help', tools: DOMAIN_TOOLS, ctx });

    expect(outcome).toMatchObject({ ok: true, resolution: { action: 'answered' } });
  });

  it('stops at the loop cap when the model keeps calling tools without resolving', async () => {
    const ctx = makeCtx();
    const client = new FakeModelClient([
      toolUseTurn('t1', 'lookup_payment', { payment_id: 'pay_001' }),
      toolUseTurn('t2', 'lookup_payment', { payment_id: 'pay_001' }),
    ]);

    const outcome = await runAgent({ client, input: 'help', tools: DOMAIN_TOOLS, ctx, config: { loopCap: 2 } });

    expect(outcome).toMatchObject({ ok: false, reason: 'loop_cap' });
    expect(client.requests).toHaveLength(2); // exactly loopCap iterations, no more
  });

  it('fails with no_resolution when the model never calls resolve', async () => {
    const ctx = makeCtx();
    const client = new FakeModelClient([
      assistantMessage([textBlock('I cannot help with that.')], 'end_turn'),
      assistantMessage([textBlock('Still cannot help.')], 'end_turn'),
    ]);

    const outcome = await runAgent({ client, input: 'help', tools: DOMAIN_TOOLS, ctx, config: { maxReprompts: 1 } });

    expect(outcome).toMatchObject({ ok: false, reason: 'no_resolution' });
  });
});

describe('runAgent — fail-fast on model-call errors', () => {
  it('does not retry a request bug (fail-fast)', async () => {
    const ctx = makeCtx();
    const client = new FakeModelClient([
      makeModelClientError({ kind: 'request', status: 400, message: 'bad request', cause: undefined }),
    ]);

    const outcome = await runAgent({ client, input: 'help', tools: DOMAIN_TOOLS, ctx });

    expect(outcome).toMatchObject({ ok: false, reason: 'request_error', detail: 'bad request' });
    expect(client.requests).toHaveLength(1); // called once, no retry
  });

  it('surfaces an exhausted transport failure as transport_error', async () => {
    const ctx = makeCtx();
    const client = new FakeModelClient([
      makeModelClientError({ kind: 'transport', status: 529, message: 'overloaded', cause: undefined }),
    ]);

    const outcome = await runAgent({ client, input: 'help', tools: DOMAIN_TOOLS, ctx });

    expect(outcome).toMatchObject({ ok: false, reason: 'transport_error' });
  });
});
