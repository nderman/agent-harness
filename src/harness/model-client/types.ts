import type Anthropic from '@anthropic-ai/sdk';

/**
 * The seam between the agent and the model (DESIGN Decision 1). Everything
 * model-shaped — the live SDK, record, replay, and test fakes — implements this
 * one method, so record/replay and tracing decorate a single interface instead
 * of a parallel path. Non-streaming only (streaming is a documented non-goal).
 */
export interface ModelClient {
  createMessage(request: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
}

/**
 * Normalized failure of a model call (DESIGN Decision 8). Two classes, two
 * recoveries: `transport` is capacity/network (already retried by the SDK, so a
 * thrown one is terminal for the run); `request` is a config bug (400/401/404)
 * that must fail fast — retrying it is a loop, not a recovery. Model-*behaviour*
 * errors (bad args, no resolution) are not failures of the call and live in the
 * loop as bounded re-prompts, not here.
 */
export type ModelClientError =
  | { kind: 'transport'; status: number | undefined; message: string; cause: unknown }
  | { kind: 'request'; status: number; message: string; cause: unknown };

const MARKER = Symbol.for('agent-harness.ModelClientError');

export function makeModelClientError(err: ModelClientError): ModelClientError & { [MARKER]: true } {
  return { ...err, [MARKER]: true };
}

export function isModelClientError(value: unknown): value is ModelClientError {
  return typeof value === 'object' && value !== null && MARKER in value;
}
