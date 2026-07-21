import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CassetteError, loadCassette, saveCassette } from './store';
import type { Cassette } from './types';

function tempFile(name: string): string {
  return join(mkdtempSync(join(tmpdir(), 'cassette-')), name);
}

describe('loadCassette / saveCassette', () => {
  it('round-trips a valid cassette', () => {
    const path = tempFile('c.json');
    const cassette: Cassette = { scenario: 't', entries: [] };
    saveCassette(path, cassette);
    expect(loadCassette(path)).toEqual(cassette);
  });

  it('throws CassetteError, naming the failure, for a malformed entry', () => {
    const path = tempFile('bad.json');
    writeFileSync(path, JSON.stringify({ scenario: 't', entries: [{ nope: true }] }));
    expect(() => loadCassette(path)).toThrow(CassetteError);
    expect(() => loadCassette(path)).toThrow(/invalid cassette at/);
  });

  it('rejects a value that is not a cassette object', () => {
    const path = tempFile('arr.json');
    writeFileSync(path, JSON.stringify([1, 2, 3]));
    expect(() => loadCassette(path)).toThrow(CassetteError);
  });
});
