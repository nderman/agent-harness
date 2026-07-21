import { describe, it, expect } from 'vitest';
import { cassettePath, loadCassette } from '../harness/cassette/store';
import { replayScenario } from '../harness/eval/runner';
import { HAPPY_PATH_REFUND } from './scenarios';

/**
 * The centrepiece, exercised: the real agent loop drives lookup → refund →
 * resolve end to end against recorded model responses, with no API key and no
 * network. Fingerprints line up between record and replay only because the run
 * state (clock, ids, seeded db) is deterministic — Phase 0's determinism seam.
 */
describe('happy-path refund, replayed from a cassette (offline)', () => {
  it('resolves the refund without any live model call', async () => {
    const { outcome, tracer, ctx } = await replayScenario(HAPPY_PATH_REFUND);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.resolution.action).toBe('refunded');
      expect(outcome.resolution.references).toContain('re_1'); // deterministic refund id
    }
    expect(ctx.db.findById('pay_001')?.status).toBe('refunded');

    // every model turn was served from the cassette
    const cassette = loadCassette(cassettePath(HAPPY_PATH_REFUND.name));
    expect(tracer.ofType('model_response')).toHaveLength(cassette.entries.length);
  });
});
