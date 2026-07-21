import { RESOLVE_TOOL_NAME } from '../../agent/resolution';
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

/** Derive per-run metrics purely from the trace (DESIGN Decision 6). */
export function computeMetrics(tracer: CollectingTracer, model: string): RunMetrics {
  const responses = tracer.ofType('model_response');
  const inputTokens = responses.reduce((sum, e) => sum + e.usage.input, 0);
  const outputTokens = responses.reduce((sum, e) => sum + e.usage.output, 0);
  return {
    modelCalls: responses.length,
    inputTokens,
    outputTokens,
    costUsd: costUsd(model, { input: inputTokens, output: outputTokens }),
    toolCalls: tracer.ofType('tool_call').filter((e) => e.tool !== RESOLVE_TOOL_NAME).length,
    guardrailDenials: tracer.ofType('guardrail_decision').filter((d) => !d.allowed).length,
  };
}
