import type { BaselineDiff } from './baseline';
import type { RunMetrics } from './metrics';

export interface ScenarioReport {
  scenario: string;
  pass: boolean;
  failures: string[];
  action: string | null;
  toolSequence: string[];
  deniedPolicies: string[];
  /** Structural inconsistencies between the message and what actually happened. */
  faithfulnessViolations: string[];
  metrics: RunMetrics;
}

const usd = (n: number): string => `$${n.toFixed(5)}`;

/** Render the eval run as markdown. Pure function of the run data (Decision 6). */
export function renderMarkdown(reports: readonly ScenarioReport[], diff: BaselineDiff): string {
  const passed = reports.filter((r) => r.pass).length;
  const totalCost = reports.reduce((s, r) => s + r.metrics.costUsd, 0);
  const totalTokens = reports.reduce((s, r) => s + r.metrics.inputTokens + r.metrics.outputTokens, 0);
  const out: string[] = [];

  out.push('# Eval report', '');
  out.push(`**${passed}/${reports.length}** scenarios passed · **${usd(totalCost)}** · **${totalTokens}** tokens · replayed offline`, '');

  // The dangerous error, weighted on its own — never averaged into the pass rate.
  const blocked = reports.reduce((s, r) => s + r.metrics.guardrailDenials, 0);
  const slipped = reports.reduce((s, r) => s + r.faithfulnessViolations.length, 0);
  out.push('## Safety');
  out.push(`- Unsafe actions **blocked** by guardrails: **${blocked}**`);
  out.push(`- Unsafe / inconsistent output that **slipped through** (faithfulness violations): **${slipped}**`, '');

  if (diff.regressions.length > 0) {
    out.push('## ⚠️ Regressions vs baseline', '');
    for (const r of diff.regressions) out.push(`- **${r.scenario}** (${r.kind}): ${r.detail}`);
    out.push('');
  } else {
    out.push('_No regressions vs baseline._', '');
  }
  if (diff.improvements.length > 0) {
    out.push('## Improvements', '');
    for (const r of diff.improvements) out.push(`- **${r.scenario}**: ${r.detail}`);
    out.push('');
  }

  out.push('## Scenarios', '');
  out.push('| Scenario | Result | Action | Trajectory | Denials | Model calls | Cost |');
  out.push('|---|---|---|---|---|---|---|');
  for (const r of reports) {
    out.push(
      `| ${r.scenario} | ${r.pass ? '✅ pass' : '❌ fail'} | ${r.action ?? '—'} | ${r.toolSequence.join(' → ') || '—'} | ${r.deniedPolicies.join(', ') || '—'} | ${r.metrics.modelCalls} | ${usd(r.metrics.costUsd)} |`,
    );
  }
  out.push('');

  const failed = reports.filter((r) => !r.pass);
  if (failed.length > 0) {
    out.push('## Failures', '');
    for (const r of failed) {
      out.push(`### ${r.scenario}`);
      for (const f of r.failures) out.push(`- ${f}`);
      out.push('');
    }
  }

  return `${out.join('\n')}\n`;
}
