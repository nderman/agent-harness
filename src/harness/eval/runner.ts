import { ReplayClient } from '../cassette/replay-client';
import { cassettePath, loadCassette } from '../cassette/store';
import { CollectingTracer } from '../trace/tracer';
import { runAgent, type AgentOutcome } from '../../agent/loop';
import { RESOLVE_TOOL_NAME } from '../../agent/resolution';
import type { Scenario } from '../../agent/scenarios';
import { DOMAIN_TOOLS, createRunContext, type ToolContext } from '../../agent/tools';
import { checkFaithfulness } from './faithfulness';

export interface EvalResult {
  scenario: string;
  pass: boolean;
  failures: string[];
}

const arrayEquals = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Replay one scenario's agent loop against its cassette, offline. Returns the
 * outcome, the full trace, and the run context — shared by the eval runner and
 * the replay integration test so their setup can't drift.
 */
export async function replayScenario(scenario: Scenario): Promise<{ outcome: AgentOutcome; tracer: CollectingTracer; ctx: ToolContext }> {
  const ctx = createRunContext();
  const tracer = new CollectingTracer();
  const client = new ReplayClient(loadCassette(cassettePath(scenario.name)), tracer);
  const outcome = await runAgent({ client, input: scenario.input, tools: DOMAIN_TOOLS, ctx, tracer });
  return { outcome, tracer, ctx };
}

/**
 * The assertions, over a completed run — trajectory (what the agent did) first,
 * then final action, then deterministic faithfulness of the message. Pure over
 * the outcome + trace, so it runs identically whether the run came from a
 * cassette (offline eval) or the live model (drift canary).
 */
export function assertScenario(scenario: Scenario, outcome: AgentOutcome, tracer: CollectingTracer): EvalResult {
  if (!outcome.ok) {
    return { scenario: scenario.name, pass: false, failures: [`run failed: ${outcome.reason} (${outcome.detail})`] };
  }

  const { expect } = scenario;
  const failures: string[] = [];

  // The *attempted* trajectory: a denied or schema-invalid call (ok:false) still
  // appears here; only the terminal resolve is excluded.
  const calledTools = tracer.ofType('tool_call').map((e) => e.tool).filter((t) => t !== RESOLVE_TOOL_NAME);
  if (!arrayEquals(calledTools, expect.toolSequence)) {
    failures.push(`tool sequence: expected [${expect.toolSequence.join(', ')}], got [${calledTools.join(', ')}]`);
  }

  const denied = tracer.ofType('guardrail_decision').filter((d) => !d.allowed).map((d) => d.policy ?? 'unknown');
  if (!arrayEquals(denied, expect.deniedPolicies ?? [])) {
    failures.push(`denied policies: expected [${(expect.deniedPolicies ?? []).join(', ')}], got [${denied.join(', ')}]`);
  }

  if (outcome.resolution.action !== expect.action) {
    failures.push(`action: expected ${expect.action}, got ${outcome.resolution.action}`);
  }

  if (expect.references && !expect.references(outcome.resolution.references)) {
    failures.push(`references predicate failed: got [${outcome.resolution.references.join(', ')}]`);
  }

  failures.push(...checkFaithfulness(outcome.resolution, tracer));

  return { scenario: scenario.name, pass: failures.length === 0, failures };
}

/** Run a scenario offline against its cassette and assert (DESIGN Decision 5). */
export async function runEval(scenario: Scenario): Promise<EvalResult> {
  const { outcome, tracer } = await replayScenario(scenario);
  return assertScenario(scenario, outcome, tracer);
}
