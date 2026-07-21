import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Cassette } from './types';

// Relative to the repo root; both `record` and replay run with cwd there.
const CASSETTE_DIR = 'cassettes';

/** A cassette file that is missing, malformed, or from an older schema. */
export class CassetteError extends Error {
  readonly kind = 'invalid_cassette' as const;

  constructor(message: string) {
    super(message);
    this.name = 'CassetteError';
  }
}

export function cassettePath(scenario: string): string {
  return join(CASSETTE_DIR, `${scenario}.json`);
}

function isCassette(value: unknown): value is Cassette {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record['scenario'] !== 'string' || !Array.isArray(record['entries'])) return false;
  return record['entries'].every((entry) => {
    if (typeof entry !== 'object' || entry === null) return false;
    const e = entry as Record<string, unknown>;
    return typeof e['fingerprint'] === 'string' && 'response' in e;
  });
}

/**
 * Validate the shape at the load boundary so a stale or hand-edited cassette
 * fails loudly here, naming the file, rather than obscurely deep in ReplayClient.
 */
export function loadCassette(path: string): Cassette {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!isCassette(parsed)) {
    throw new CassetteError(`invalid cassette at ${path}: expected { scenario, entries: [{ fingerprint, request, response }] }`);
  }
  return parsed;
}

/** Pretty-printed and newline-terminated so cassette diffs read cleanly in a PR. */
export function saveCassette(path: string, cassette: Cassette): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(cassette, null, 2)}\n`);
}
