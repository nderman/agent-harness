import { SequentialIdGenerator, SystemClock } from '../harness/determinism';
import { RecordingClient } from '../harness/cassette/recording-client';
import { cassettePath, saveCassette } from '../harness/cassette/store';
import { LiveClient } from '../harness/model-client/live-client';
import { createPaymentsDb } from '../agent/payments-db';
import { runAgent } from '../agent/loop';
import { SCENARIOS } from '../agent/scenarios';
import { DOMAIN_TOOLS } from '../agent/tools';
import { requireApiKey } from './env';

/**
 * Re-record cassettes against the live model. Run only after an intentional
 * prompt/tool/schema change — the cassette diff is a reviewed artifact. Each
 * scenario runs the real agent loop through a RecordingClient, and the captured
 * request→response pairs are written to `cassettes/<scenario>.json`.
 */
async function main(): Promise<void> {
  const apiKey = requireApiKey('record');

  for (const scenario of SCENARIOS) {
    // Fresh, deterministic run state — the same setup replay will use, so the
    // recorded request fingerprints match on replay.
    const ids = new SequentialIdGenerator();
    const db = createPaymentsDb(ids);
    const client = new RecordingClient(new LiveClient({ apiKey, clock: new SystemClock() }));

    const outcome = await runAgent({ client, input: scenario.input, tools: DOMAIN_TOOLS, ctx: { db, ids } });
    if (!outcome.ok) {
      console.error(`record: scenario "${scenario.name}" did not resolve (${outcome.reason}: ${outcome.detail}); not writing a cassette.`);
      process.exit(1);
    }

    const cassette = client.cassette(scenario.name);
    const path = cassettePath(scenario.name);
    saveCassette(path, cassette);
    console.log(`recorded ${cassette.entries.length} turn(s) → ${path}`);
  }
}

void main();
