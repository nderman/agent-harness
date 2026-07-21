import { describe, it, expect } from 'vitest';
import { diffBaseline, type Baseline, type BaselineEntry } from './baseline';

const entry = (over: Partial<BaselineEntry> = {}): BaselineEntry => ({
  pass: true,
  action: 'refunded',
  toolSequence: ['lookup_payment', 'issue_refund'],
  deniedPolicies: [],
  ...over,
});

describe('diffBaseline', () => {
  it('reports no changes when current matches baseline', () => {
    const diff = diffBaseline({ s: entry() }, { s: entry() });
    expect(diff.regressions).toEqual([]);
    expect(diff.improvements).toEqual([]);
  });

  it('flags a now-failing scenario as a regression', () => {
    const diff = diffBaseline({ s: entry({ pass: false }) }, { s: entry() } as Baseline);
    expect(diff.regressions.map((r) => r.kind)).toContain('now-failing');
  });

  it('flags an action change as a regression', () => {
    const diff = diffBaseline({ s: entry({ action: 'escalated' }) }, { s: entry() } as Baseline);
    expect(diff.regressions.map((r) => r.kind)).toContain('action-changed');
  });

  it('flags a trajectory change as a regression', () => {
    const diff = diffBaseline({ s: entry({ toolSequence: ['escalate'] }) }, { s: entry() } as Baseline);
    expect(diff.regressions.map((r) => r.kind)).toContain('trajectory-changed');
  });

  it('reports a now-passing scenario as an improvement', () => {
    const diff = diffBaseline({ s: entry() }, { s: entry({ pass: false }) } as Baseline);
    expect(diff.improvements.map((r) => r.kind)).toContain('now-passing');
  });

  it('does not flag action/trajectory changes when a scenario goes failing → passing (a fix is not a regression)', () => {
    const before = entry({ pass: false, action: null, toolSequence: [], deniedPolicies: [] });
    const now = entry({ pass: true, action: 'refunded', toolSequence: ['lookup_payment', 'issue_refund'] });
    const diff = diffBaseline({ s: now }, { s: before } as Baseline);
    expect(diff.improvements.map((r) => r.kind)).toEqual(['now-passing']);
    expect(diff.regressions).toEqual([]);
  });

  it('counts a now-failing scenario once, not thrice', () => {
    const before = entry({ pass: true, action: 'escalated', toolSequence: ['escalate'] });
    const now = entry({ pass: false, action: null, toolSequence: [], deniedPolicies: [] });
    const diff = diffBaseline({ s: now }, { s: before } as Baseline);
    expect(diff.regressions.map((r) => r.kind)).toEqual(['now-failing']);
  });

  it('notes new and removed scenarios without failing', () => {
    const diff = diffBaseline({ a: entry() }, { b: entry() } as Baseline);
    expect(diff.notes.map((r) => r.kind).sort()).toEqual(['new-scenario', 'removed-scenario']);
    expect(diff.regressions).toEqual([]);
  });
});
