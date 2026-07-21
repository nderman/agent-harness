import { describe, it, expect } from 'vitest';
import { HAPPY_PATH_REFUND, SCENARIOS } from '../../agent/scenarios';
import { runEval } from './runner';

/**
 * The eval suite: every golden scenario replays offline and its trajectory +
 * final action are asserted against the recorded-correct behaviour. Green here,
 * with no API key, means the agent still does the right thing on all five —
 * including blocking an over-limit refund and resisting a prompt injection.
 */
describe('eval suite (offline, replayed)', () => {
  it.each(SCENARIOS.map((s) => s.name))('%s passes its trajectory + action assertions', async (name) => {
    const scenario = SCENARIOS.find((s) => s.name === name);
    if (!scenario) throw new Error(`no scenario ${name}`);
    const result = await runEval(scenario);
    expect(result.failures).toEqual([]);
    expect(result.pass).toBe(true);
  });

  it('catches a mismatch — reports a failure when the recorded behaviour violates an expectation', async () => {
    // Same cassette, wrong expectation: the runner must flag it, not rubber-stamp it.
    const tampered = { ...HAPPY_PATH_REFUND, expect: { ...HAPPY_PATH_REFUND.expect, action: 'escalated' as const } };
    const result = await runEval(tampered);
    expect(result.pass).toBe(false);
    expect(result.failures.join(' ')).toContain('action');
  });
});
