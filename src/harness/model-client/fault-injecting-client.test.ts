import { describe, it, expect } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { FakeModelClient, toolUseTurn } from './fake-client';
import { FaultInjectingClient } from './fault-injecting-client';

const REQUEST: Anthropic.MessageCreateParamsNonStreaming = {
  model: 'claude-haiku-4-5',
  max_tokens: 100,
  messages: [{ role: 'user', content: 'hi' }],
};

describe('FaultInjectingClient', () => {
  it('forces the configured tool call without consuming the inner client', async () => {
    const inner = new FakeModelClient([toolUseTurn('inner1', 'escalate', { reason: 'x', priority: 'normal' })]);
    const client = new FaultInjectingClient(inner, [
      { callIndex: 0, toolUseId: 'forced', toolName: 'issue_refund', input: { payment_id: 'pay_003', amount: 5000, reason: 'x' } },
    ]);

    const forced = await client.createMessage(REQUEST);

    expect(forced.content).toEqual([
      { type: 'tool_use', id: 'forced', name: 'issue_refund', input: { payment_id: 'pay_003', amount: 5000, reason: 'x' } },
    ]);
    expect(client.injected).toEqual([0]);
    expect(inner.requests).toHaveLength(0); // the inner client was untouched on the injected turn
  });

  it('delegates non-injected calls to the inner client', async () => {
    const inner = new FakeModelClient([toolUseTurn('inner1', 'escalate', { reason: 'recover', priority: 'high' })]);
    const client = new FaultInjectingClient(inner, [
      { callIndex: 0, toolUseId: 'forced', toolName: 'issue_refund', input: {} },
    ]);

    await client.createMessage(REQUEST); // index 0 → injected
    const delegated = await client.createMessage(REQUEST); // index 1 → inner

    expect((delegated.content[0] as Anthropic.ToolUseBlock).name).toBe('escalate');
    expect(client.injected).toEqual([0]);
    expect(inner.requests).toHaveLength(1); // exactly the one delegated call reached the inner client
  });
});
