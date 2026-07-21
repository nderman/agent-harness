import { describe, it, expect } from 'vitest';
import { SequentialIdGenerator } from '../harness/determinism';
import { cassettePath, loadCassette } from '../harness/cassette/store';
import { ReplayClient } from '../harness/cassette/replay-client';
import { CollectingTracer } from '../harness/trace/tracer';
import { createPaymentsDb } from './payments-db';
import { runAgent } from './loop';
import { HAPPY_PATH_REFUND } from './scenarios';
import { DOMAIN_TOOLS, type ToolContext } from './tools';

/**
 * The centrepiece, exercised: the real agent loop drives lookup → refund →
 * resolve end to end against recorded model responses, with no API key and no
 * network. Fingerprints line up between record and replay only because the run
 * state (clock, ids, seeded db) is deterministic — this is Phase 0's determinism
 * seam paying off.
 */
describe('happy-path refund, replayed from a cassette (offline)', () => {
  function makeCtx(): ToolContext {
    const ids = new SequentialIdGenerator();
    return { db: createPaymentsDb(ids), ids };
  }

  it('resolves the refund without any live model call', async () => {
    const ctx = makeCtx();
    const cassette = loadCassette(cassettePath(HAPPY_PATH_REFUND.name));
    const tracer = new CollectingTracer();
    const client = new ReplayClient(cassette, tracer);

    const outcome = await runAgent({ client, input: HAPPY_PATH_REFUND.input, tools: DOMAIN_TOOLS, ctx, tracer });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.resolution.action).toBe('refunded');
      expect(outcome.resolution.references).toContain('re_1'); // deterministic refund id
    }
    expect(ctx.db.findById('pay_001')?.status).toBe('refunded');
    // every model turn was served from the cassette
    expect(tracer.ofType('model_response')).toHaveLength(cassette.entries.length);
  });
});
