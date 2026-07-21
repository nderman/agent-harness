/**
 * Observability is event-sourced: every meaningful step is a typed event, and
 * reports (Phase 4) are pure functions of these events. This union holds only
 * what Phase 1 actually emits; later phases extend it (guardrail decisions in
 * Phase 3, cost in Phase 4) rather than bolt on a parallel logging path.
 */
export type TraceEvent =
  | { type: 'run_started'; input: string }
  | { type: 'model_request'; model: string; messageCount: number }
  | { type: 'model_response'; stopReason: string | null; usage: { input: number; output: number }; latencyMs: number }
  | { type: 'model_error'; kind: 'transport' | 'request'; status: number | undefined; message: string; latencyMs: number }
  | { type: 'tool_call'; tool: string; ok: boolean }
  | { type: 'run_completed'; ok: boolean; reason: string | undefined };

export interface Tracer {
  emit(event: TraceEvent): void;
}
