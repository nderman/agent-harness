import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { TraceEvent } from './types';

/** One JSON object per line — greppable, diffable, streamable. */
export function toJsonl(events: readonly TraceEvent[]): string {
  return `${events.map((e) => JSON.stringify(e)).join('\n')}\n`;
}

export function writeTrace(path: string, events: readonly TraceEvent[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, toJsonl(events));
}
