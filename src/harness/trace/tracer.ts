import type { TraceEvent, Tracer } from './types';

/** Keeps every event in memory — for tests, the demo, and (Phase 4) reports. */
export class CollectingTracer implements Tracer {
  readonly events: TraceEvent[] = [];

  emit(event: TraceEvent): void {
    this.events.push(event);
  }

  ofType<T extends TraceEvent['type']>(type: T): Extract<TraceEvent, { type: T }>[] {
    return this.events.filter((e): e is Extract<TraceEvent, { type: T }> => e.type === type);
  }
}

/** Discards events — the default when a caller doesn't care about tracing. */
export const nullTracer: Tracer = {
  emit() {},
};
