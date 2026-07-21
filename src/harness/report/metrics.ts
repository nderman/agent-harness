import { deniedPolicies, toolSequence } from '../eval/trajectory';
import { costUsd } from '../trace/cost';
import type { CollectingTracer } from '../trace/tracer';

export interface RunMetrics {
  modelCalls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  toolCalls: number;
  guardrailDenials: number;
}

/**
 * Derive per-run metrics purely from the trace (DESIGN Decision 6), including
 * the model actually used (read from `model_request`, not assumed). An empty
 * trace — e.g. a replay miss — prices to $0 with no model to look up.
 */
export function computeMetrics(tracer: CollectingTracer): RunMetrics {
  const responses = tracer.ofType('model_response');
  const inputTokens = responses.reduce((sum, e) => sum + e.usage.input, 0);
  const outputTokens = responses.reduce((sum, e) => sum + e.usage.output, 0);
  const model = tracer.ofType('model_request')[0]?.model;
  return {
    modelCalls: responses.length,
    inputTokens,
    outputTokens,
    costUsd: model === undefined ? 0 : costUsd(model, { input: inputTokens, output: outputTokens }),
    toolCalls: toolSequence(tracer).length,
    guardrailDenials: deniedPolicies(tracer).length,
  };
}
