import { RESOLVE_TOOL_NAME } from '../../agent/resolution';
import type { CollectingTracer } from '../trace/tracer';

export const arrayEquals = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/** The *attempted* tool trajectory from a trace — includes a rejected call (ok:false), excludes the terminal resolve. */
export function toolSequence(tracer: CollectingTracer): string[] {
  return tracer.ofType('tool_call').map((e) => e.tool).filter((t) => t !== RESOLVE_TOOL_NAME);
}

/** Policies that fired a denial, in order. */
export function deniedPolicies(tracer: CollectingTracer): string[] {
  return tracer.ofType('guardrail_decision').filter((d) => !d.allowed).map((d) => d.policy ?? 'unknown');
}
