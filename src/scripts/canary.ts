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
  console.log(`drift canary: ${SCENARIOS.length} scenarios vs ${model} (live)\n`);

  let failed = 0;
  for (const scenario of SCENARIOS) {
    const tracer = new CollectingTracer();
    const client = new LiveClient({ apiKey, clock: new SystemClock(), tracer });
    const outcome = await runAgent({
      client,
      input: scenario.input,
      tools: DOMAIN_TOOLS,
      ctx: createRunContext(),
      tracer,
      config: { agentModel: model },
    });
    const result = assertScenario(scenario, outcome, tracer);
    if (result.pass) {
      console.log(`  ✓ ${scenario.name}`);
    } else {
      failed++;
      console.log(`  ✗ ${scenario.name}`);
      for (const f of result.failures) console.log(`      - ${f}`);
    }
  }

  console.log(`\n${SCENARIOS.length - failed}/${SCENARIOS.length} scenarios held their baseline against ${model}.`);
  if (failed > 0) {
    console.error(`drift canary: ${failed} scenario(s) drifted — the live model no longer matches the recorded baseline.`);
    process.exit(1);
  }
}

void main();
