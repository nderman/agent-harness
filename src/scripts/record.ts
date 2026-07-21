import { SystemClock } from '../harness/determinism';
import { RecordingClient } from '../harness/cassette/recording-client';
import { cassettePath, saveCassette } from '../harness/cassette/store';
import { LiveClient } from '../harness/model-client/live-client';
import { runAgent } from '../agent/loop';
import { SCENARIOS } from '../agent/scenarios';
import { DOMAIN_TOOLS, createRunContext } from '../agent/tools';
import { requireApiKey } from './env';

/**
 * Re-record cassettes against the live model. Run only after an intentional
 * prompt/tool/schema change — the cassette diff is a reviewed artifact. Each
 * scenario runs the real agent loop through a RecordingClient, and the captured
 * request→response pairs are written to `cassettes/<scenario>.json`.
 */
async function main(): Promise<void> {
  const apiKey = requireApiKey('record');
  const only = process.argv[2];
  const scenarios = only ? SCENARIOS.filter((s) => s.name === only) : SCENARIOS;
  if (only && scenarios.length === 0) {
    console.error(`record: no scenario named "${only}". Known: ${SCENARIOS.map((s) => s.name).join(', ')}`);
    process.exit(1);
  }

  const failed: string[] = [];
  for (const scenario of scenarios) {
    // Same deterministic run state replay uses, so recorded fingerprints match.
    const client = new RecordingClient(new LiveClient({ apiKey, clock: new SystemClock() }));
    const outcome = await runAgent({ client, input: scenario.input, tools: DOMAIN_TOOLS, ctx: createRunContext() });
    if (!outcome.ok) {
      // Don't abort the batch on one failure (e.g. a transient API error) —
      // record the rest and report which to re-run.
      console.error(`record: scenario "${scenario.name}" did not resolve (${outcome.reason}: ${outcome.detail}); skipping.`);
      failed.push(scenario.name);
      continue;
    }

    const cassette = client.cassette(scenario.name);
    saveCassette(cassettePath(scenario.name), cassette);
    console.log(`recorded ${cassette.entries.length} turn(s) → ${cassettePath(scenario.name)}`);
  }

  if (failed.length > 0) {
    console.error(`record: ${failed.length} scenario(s) failed — re-run with e.g. \`npm run record ${failed[0]}\`: ${failed.join(', ')}`);
    process.exit(1);
  }
}

void main();
