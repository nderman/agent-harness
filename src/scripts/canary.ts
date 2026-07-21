import { SystemClock } from '../harness/determinism';
import { assertScenario } from '../harness/eval/runner';
import { DEFAULTS } from '../harness/model-client/defaults';
import { LiveClient } from '../harness/model-client/live-client';
import { CollectingTracer } from '../harness/trace/tracer';
import { runAgent } from '../agent/loop';
import { SCENARIOS } from '../agent/scenarios';
import { DOMAIN_TOOLS, createRunContext } from '../agent/tools';
import { requireApiKey } from './env';

/**
 * The live drift canary. Replay insulates the offline suite from the model
 * changing under us, so this re-runs the golden scenarios against the *live*
 * model and applies the same assertions (trajectory + action + faithfulness),
 * diffing against the recorded baseline. If a new model version stops escalating
 * the over-limit case, or starts obeying the injection, this goes red.
 *
 * Needs an API key; runs on a cadence, not in offline CI. Pass a model id as the
 * first arg to check a candidate model against the current baseline
 * (`npm run canary claude-opus-4-8`) — that's how you catch model drift before it
 * ships.
 */
async function main(): Promise<void> {
  const apiKey = requireApiKey('canary');
  const model = process.argv[2] ?? DEFAULTS.agentModel;
  const parsedRuns = Number(process.argv[3] ?? '1');
  const runs = Number.isFinite(parsedRuns) && parsedRuns >= 1 ? Math.floor(parsedRuns) : 1;
  console.log(`drift canary: ${SCENARIOS.length} scenarios × ${runs} run(s) vs ${model} (live)\n`);

  let drifted = 0;
  for (const scenario of SCENARIOS) {
    // Sample N runs — LLMs aren't bit-deterministic, so an intermittent
    // divergence only shows up if you look more than once.
    let held = 0;
    const failures = new Set<string>();
    for (let i = 0; i < runs; i++) {
      const tracer = new CollectingTracer();
      const client = new LiveClient({ apiKey, clock: new SystemClock(), tracer });
      const outcome = await runAgent({ client, input: scenario.input, tools: DOMAIN_TOOLS, ctx: createRunContext(), tracer, config: { agentModel: model } });
      const result = assertScenario(scenario, outcome, tracer);
      if (result.pass) held += 1;
      else for (const f of result.failures) failures.add(f);
    }
    if (held === runs) {
      console.log(`  ✓ ${scenario.name} (${held}/${runs} held)`);
    } else {
      drifted += 1;
      console.log(`  ✗ ${scenario.name} (${held}/${runs} held)`);
      for (const f of failures) console.log(`      - ${f}`);
    }
  }

  console.log(`\n${SCENARIOS.length - drifted}/${SCENARIOS.length} scenarios held their baseline against ${model}.`);
  if (drifted > 0) {
    console.error(`drift canary: ${drifted} scenario(s) drifted — the live model no longer matches the recorded baseline.`);
    process.exit(1);
  }
}

void main();
