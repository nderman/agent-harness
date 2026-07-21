/**
 * Every tunable in one place, overridable per call site, never a magic number
 * scattered through the code. Whatever was in effect for a run is recorded in
 * its trace, so a report never leaves you guessing which settings produced it.
 */
export const DEFAULTS = {
  agentModel: 'claude-haiku-4-5',
  maxTokens: 4096,
  timeoutMs: 60_000,
  /** Transport retries — handled by the SDK (see DESIGN Decision 8). */
  maxRetries: 3,
  /** Model-behaviour re-prompts per run — handled by the agent loop. */
  maxReprompts: 2,
  /** Hard stop for tool-call loops that never resolve. */
  loopCap: 10,
} as const;

export type Defaults = typeof DEFAULTS;
