import { SequentialIdGenerator, SystemClock } from '../harness/determinism';
import { LiveClient } from '../harness/model-client/live-client';
import { CollectingTracer } from '../harness/trace/tracer';
import { createPaymentsDb } from '../agent/payments-db';
import { runAgent } from '../agent/loop';
import { DOMAIN_TOOLS } from '../agent/tools';

// Load .env for local runs; an already-exported ANTHROPIC_API_KEY still works.
try {
  process.loadEnvFile('.env');
} catch {
  // no .env file — rely on the ambient environment
}

/**
 * One live scenario end-to-end against the real model (Phase 1 gate). This is
 * the only path that needs an API key; everything else runs offline via the
 * fake client (and, from Phase 2, cassettes).
 */
async function main(): Promise<void> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    console.error('demo: set ANTHROPIC_API_KEY to run the live demo.');
    process.exit(1);
  }

  const ids = new SequentialIdGenerator();
  const db = createPaymentsDb(ids);
  const tracer = new CollectingTracer();
  const client = new LiveClient({ apiKey, clock: new SystemClock(), tracer });

  const input = 'Hi, please refund my payment pay_001 in full — the order was cancelled.';
  console.log(`\n> customer: ${input}\n`);

  const outcome = await runAgent({ client, input, tools: DOMAIN_TOOLS, ctx: { db, ids }, tracer });

  console.log('--- trace ---');
  for (const event of tracer.events) console.log(event);

  console.log('\n--- outcome ---');
  console.log(JSON.stringify(outcome, null, 2));

  if (!outcome.ok) process.exit(1);
  console.log(`\npay_001 status is now: ${db.findById('pay_001')?.status}`);
}

void main();
