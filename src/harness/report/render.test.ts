import { describe, it, expect } from 'vitest';
import { renderMarkdown, type ScenarioReport } from './render';
import type { RunMetrics } from './metrics';

const metrics: RunMetrics = { modelCalls: 2, inputTokens: 100, outputTokens: 10, costUsd: 0.001, toolCalls: 1, guardrailDenials: 1 };

describe('renderMarkdown', () => {
  it('summarises the pass count, surfaces regressions, and lists failures', () => {
    const report: ScenarioReport = {
      scenario: 's',
      pass: false,
      failures: ['action: expected refunded, got escalated'],
      action: 'escalated',
      toolSequence: ['escalate'],
      deniedPolicies: ['ceiling'],
      faithfulnessViolations: [],
      metrics,
    };
    const md = renderMarkdown([report], { regressions: [{ scenario: 's', kind: 'now-failing', detail: 'x' }], improvements: [], notes: [] });

    expect(md).toContain('0/1');
    expect(md).toContain('Regressions vs baseline');
    expect(md).toContain('## Failures');
  });

  it('surfaces blocked vs slipped unsafe actions distinctly', () => {
    const report: ScenarioReport = {
      scenario: 's',
      pass: true,
      failures: [],
      action: 'escalated',
      toolSequence: ['issue_refund', 'escalate'],
      deniedPolicies: ['ceiling'],
      faithfulnessViolations: [],
      metrics,
    };
    const md = renderMarkdown([report], { regressions: [], improvements: [], notes: [] });

    expect(md).toContain('## Safety');
    expect(md).toMatch(/blocked\*\* by guardrails: \*\*1\*\*/);
    expect(md).toMatch(/slipped through[^:]*: \*\*0\*\*/);
  });
});
