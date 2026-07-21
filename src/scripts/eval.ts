import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { diffBaseline, type Baseline } from '../harness/report/baseline';
import { renderHtml, renderMarkdown } from '../harness/report/render';
import { runSuite, toBaseline } from '../harness/report/run-suite';
import { writeTrace } from '../harness/trace/jsonl';

const BASELINE_PATH = 'evals/baseline.json';
const REPORT_DIR = 'report';

/**
 * Offline eval runner: replays every scenario (no API key), writes a markdown
 * report + one JSONL trace per scenario, and diffs the actual behaviour against
 * the committed baseline. Regressions or failures exit non-zero, so this gates
 * CI. `--update-baseline` re-snapshots the baseline after an intentional change.
 */
async function main(): Promise<void> {
  const update = process.argv.includes('--update-baseline');
  const { reports, traces } = await runSuite();
  const current = toBaseline(reports);

  const baseline: Baseline = existsSync(BASELINE_PATH) ? (JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Baseline) : {};
  const diff = diffBaseline(current, baseline);

  // One trace file per scenario, for the report and for browsing.
  for (const [name, events] of Object.entries(traces)) {
    writeTrace(`${REPORT_DIR}/traces/${name}.jsonl`, events);
  }

  mkdirSync(REPORT_DIR, { recursive: true });
  const markdown = renderMarkdown(reports, diff);
  writeFileSync(`${REPORT_DIR}/eval-report.md`, markdown);
  writeFileSync(`${REPORT_DIR}/index.html`, renderHtml(reports, diff));
  console.log(markdown);

  if (update) {
    // A replay miss is a broken recording, not agent behaviour — never freeze it in.
    const stale = reports.filter((r) => r.failures.some((f) => f.includes('Replay miss')));
    if (stale.length > 0) {
      console.error(`refusing to update baseline — ${stale.length} stale cassette(s): ${stale.map((r) => r.scenario).join(', ')}. Re-record first.`);
      process.exit(1);
    }
    const failing = reports.filter((r) => !r.pass);
    if (failing.length > 0) console.warn(`warning: baselining ${failing.length} failing scenario(s): ${failing.map((r) => r.scenario).join(', ')}`);

    const sorted: Baseline = {};
    for (const key of Object.keys(current).sort()) sorted[key] = current[key]!;
    mkdirSync('evals', { recursive: true });
    writeFileSync(BASELINE_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
    console.log(`baseline updated → ${BASELINE_PATH}`);
    return;
  }

  const failed = reports.filter((r) => !r.pass).length;
  if (failed > 0 || diff.regressions.length > 0) {
    console.error(`eval: ${failed} failing, ${diff.regressions.length} regression(s) vs baseline.`);
    process.exit(1);
  }
}

void main();
