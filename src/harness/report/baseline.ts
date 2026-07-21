import type { ResolutionAction } from '../../agent/resolution';
import { arrayEquals } from '../eval/trajectory';

/**
 * Regression detection: a committed snapshot of each scenario's *actual*
 * behaviour (pass, action, trajectory, guardrail outcomes). Re-running the suite
 * and diffing against it flags drift — a scenario that flipped, changed action,
 * or took a different path — independent of the hand-written expectations. That
 * catches a behaviour change even if someone forgot to update `scenario.expect`.
 */
export interface BaselineEntry {
  pass: boolean;
  action: ResolutionAction | null;
  toolSequence: string[];
  deniedPolicies: string[];
}

export type Baseline = Record<string, BaselineEntry>;

export interface Change {
  scenario: string;
  kind: 'now-failing' | 'now-passing' | 'action-changed' | 'trajectory-changed' | 'new-scenario' | 'removed-scenario';
  detail: string;
}

export interface BaselineDiff {
  regressions: Change[];
  improvements: Change[];
  notes: Change[];
}

export function diffBaseline(current: Record<string, BaselineEntry>, baseline: Baseline): BaselineDiff {
  const diff: BaselineDiff = { regressions: [], improvements: [], notes: [] };

  for (const [scenario, now] of Object.entries(current)) {
    const before = baseline[scenario];
    if (!before) {
      diff.notes.push({ scenario, kind: 'new-scenario', detail: 'not in baseline' });
      continue;
    }
    // A pass-state flip is the headline; the action/trajectory necessarily change
    // with it, so don't double-report those — gate them on the pass state being
    // unchanged (otherwise a fix reads as regressions and reds CI).
    if (before.pass && !now.pass) {
      diff.regressions.push({ scenario, kind: 'now-failing', detail: 'passed in baseline, now fails' });
      continue;
    }
    if (!before.pass && now.pass) {
      diff.improvements.push({ scenario, kind: 'now-passing', detail: 'failed in baseline, now passes' });
      continue;
    }
    if (!before.pass && !now.pass) continue; // both failing — a behaviour diff between two broken runs is noise

    // Both passing: a changed action or path is a genuine behaviour drift.
    if (before.action !== now.action) {
      diff.regressions.push({ scenario, kind: 'action-changed', detail: `${before.action ?? '—'} → ${now.action ?? '—'}` });
    }
    if (!arrayEquals(before.toolSequence, now.toolSequence) || !arrayEquals(before.deniedPolicies, now.deniedPolicies)) {
      diff.regressions.push({
        scenario,
        kind: 'trajectory-changed',
        detail: `tools [${before.toolSequence.join(', ')}]→[${now.toolSequence.join(', ')}], denials [${before.deniedPolicies.join(', ')}]→[${now.deniedPolicies.join(', ')}]`,
      });
    }
  }

  for (const scenario of Object.keys(baseline)) {
    if (!current[scenario]) diff.notes.push({ scenario, kind: 'removed-scenario', detail: 'in baseline but not run' });
  }

  return diff;
}
