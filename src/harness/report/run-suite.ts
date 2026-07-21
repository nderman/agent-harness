import { RESOLVE_TOOL_NAME } from '../../agent/resolution';
import { SCENARIOS } from '../../agent/scenarios';
import { ReplayMissError } from '../cassette/replay-client';
import { DEFAULTS } from '../model-client/defaults';
import { assertScenario, replayScenario } from '../eval/runner';
import { checkFaithfulness } from '../eval/faithfulness';
import type { TraceEvent } from '../trace/types';
import type { BaselineEntry } from './baseline';
import { computeMetrics, type RunMetrics } from './metrics';
import type { ScenarioReport } from './render';

const emptyMetrics: RunMetrics = { modelCalls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, toolCalls: 0, guardrailDenials: 0 };

export interface SuiteRun {
  reports: ScenarioReport[];
  /** Full trace per scenario, keyed by name — for writing JSONL / browsing. */
  traces: Record<string, readonly TraceEvent[]>;
}

/**
 * Run the whole eval suite offline. A stale cassette (a replay miss — the
 * prompt/tools drifted) is caught and recorded as a hard failure rather than
 * crashing the run, so the report and baseline diff still surface it.
 */
export async function runSuite(): Promise<SuiteRun> {
  const reports: ScenarioReport[] = [];
  const traces: Record<string, readonly TraceEvent[]> = {};
  for (const scenario of SCENARIOS) {
    try {
      const { outcome, tracer } = await replayScenario(scenario);
      const result = assertScenario(scenario, outcome, tracer);
      reports.push({
        scenario: scenario.name,
        pass: result.pass,
        failures: result.failures,
        action: outcome.ok ? outcome.resolution.action : null,
        toolSequence: tracer.ofType('tool_call').map((e) => e.tool).filter((t) => t !== RESOLVE_TOOL_NAME),
        deniedPolicies: tracer.ofType('guardrail_decision').filter((d) => !d.allowed).map((d) => d.policy ?? 'unknown'),
        faithfulnessViolations: outcome.ok ? checkFaithfulness(outcome.resolution, tracer) : [],
        metrics: computeMetrics(tracer, DEFAULTS.agentModel),
      });
      traces[scenario.name] = tracer.events;
    } catch (error) {
      if (!(error instanceof ReplayMissError)) throw error;
      reports.push({ scenario: scenario.name, pass: false, failures: [error.message], action: null, toolSequence: [], deniedPolicies: [], faithfulnessViolations: [], metrics: emptyMetrics });
      traces[scenario.name] = [];
    }
  }
  return { reports, traces };
}

export function toBaseline(reports: readonly ScenarioReport[]): Record<string, BaselineEntry> {
  const baseline: Record<string, BaselineEntry> = {};
  for (const r of reports) {
    baseline[r.scenario] = { pass: r.pass, action: r.action, toolSequence: r.toolSequence, deniedPolicies: r.deniedPolicies };
  }
  return baseline;
}
