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

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Self-contained HTML report for the hosted link — no external assets, theme-aware. */
export function renderHtml(reports: readonly ScenarioReport[], diff: BaselineDiff): string {
  const passed = reports.filter((r) => r.pass).length;
  const totalCost = reports.reduce((s, r) => s + r.metrics.costUsd, 0);
  const totalTokens = reports.reduce((s, r) => s + r.metrics.inputTokens + r.metrics.outputTokens, 0);
  const blocked = reports.reduce((s, r) => s + r.metrics.guardrailDenials, 0);
  const slipped = reports.reduce((s, r) => s + r.faithfulnessViolations.length, 0);

  const tile = (label: string, value: string, warn = false): string =>
    `<div class="tile${warn ? ' warn' : ''}"><div class="v">${value}</div><div class="l">${label}</div></div>`;

  const rows = reports
    .map(
      (r) => `<tr class="${r.pass ? 'ok' : 'bad'}">
      <td><a href="traces/${esc(r.scenario)}.jsonl">${esc(r.scenario)}</a></td>
      <td>${r.pass ? '✅' : '❌'}</td>
      <td>${r.action ?? '—'}</td>
      <td class="traj">${esc(r.toolSequence.join(' → ') || '—')}</td>
      <td>${esc(r.deniedPolicies.join(', ') || '—')}</td>
      <td class="num">${r.metrics.modelCalls}</td>
      <td class="num">${usd(r.metrics.costUsd)}</td></tr>`,
    )
    .join('\n');

  const regressions =
    diff.regressions.length > 0
      ? `<section class="regress"><h2>⚠️ Regressions vs baseline</h2><ul>${diff.regressions
          .map((r) => `<li><b>${esc(r.scenario)}</b> (${r.kind}): ${esc(r.detail)}</li>`)
          .join('')}</ul></section>`
      : `<p class="clean">No regressions vs baseline.</p>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Eval report — agent-harness</title>
<style>
  :root { color-scheme: light dark; --bg:#fff; --fg:#1a1a1a; --muted:#666; --line:#e5e5e5; --tile:#f6f6f6; --warn:#b3261e; --ok:#1a7f37; }
  @media (prefers-color-scheme: dark) { :root { --bg:#151515; --fg:#eee; --muted:#9a9a9a; --line:#2c2c2c; --tile:#1f1f1f; --warn:#ff6b6b; --ok:#4ade80; } }
  * { box-sizing: border-box; } body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  main { max-width: 900px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
  h1 { font-size: 1.5rem; margin: 0 0 .25rem; } .sub { color:var(--muted); margin:0 0 1.5rem; }
  .tiles { display:flex; flex-wrap:wrap; gap:.75rem; margin-bottom:1.5rem; }
  .tile { flex:1 1 120px; background:var(--tile); border:1px solid var(--line); border-radius:10px; padding:.85rem 1rem; }
  .tile .v { font-size:1.4rem; font-weight:650; } .tile .l { color:var(--muted); font-size:.8rem; margin-top:.15rem; }
  .tile.warn .v { color:var(--warn); }
  h2 { font-size:1rem; margin:1.75rem 0 .6rem; } .clean { color:var(--ok); }
  .regress { border:1px solid var(--warn); border-radius:10px; padding:.5rem 1rem; } .regress h2 { color:var(--warn); margin-top:.5rem; }
  table { width:100%; border-collapse:collapse; font-size:.9rem; } th,td { text-align:left; padding:.5rem .6rem; border-bottom:1px solid var(--line); vertical-align:top; }
  th { color:var(--muted); font-weight:600; } .num { text-align:right; font-variant-numeric:tabular-nums; } .traj { color:var(--muted); }
  tr.bad td:first-child { box-shadow: inset 3px 0 var(--warn); }
</style></head>
<body><main>
  <h1>Eval report</h1>
  <p class="sub">Payments-support agent · replayed offline from committed cassettes · zero live API calls</p>
  <div class="tiles">
    ${tile('scenarios passed', `${passed}/${reports.length}`)}
    ${tile('cost', usd(totalCost))}
    ${tile('tokens', String(totalTokens))}
    ${tile('unsafe blocked', String(blocked))}
    ${tile('unsafe slipped', String(slipped), slipped > 0)}
  </div>
  ${regressions}
  <h2>Scenarios</h2>
  <table><thead><tr><th>Scenario</th><th>Result</th><th>Action</th><th>Trajectory</th><th>Denials</th><th class="num">Calls</th><th class="num">Cost</th></tr></thead>
  <tbody>${rows}</tbody></table>
</main></body></html>
`;
}
