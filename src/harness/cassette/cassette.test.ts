import { describe, it, expect } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { FakeModelClient, assistantMessage, textBlock } from '../model-client/fake-client';
import { RecordingClient } from './recording-client';
import { ReplayClient, ReplayMissError } from './replay-client';
import { summarize } from './types';

function request(over: Partial<Anthropic.MessageCreateParamsNonStreaming> = {}): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    system: 'You are a payments agent.',
    messages: [{ role: 'user', content: 'refund pay_001' }],
    tools: [{ name: 'lookup_payment', description: 'x', input_schema: { type: 'object' } }],
    ...over,
  };
}

describe('record → replay round trip', () => {
  it('replays the exact recorded response for a matching request', async () => {
    const recorded = assistantMessage([textBlock('recorded reply')]);
    const rec = new RecordingClient(new FakeModelClient([recorded]));
    const req = request();

    const live = await rec.createMessage(req);
    const replay = new ReplayClient(rec.cassette('t'));
    const replayed = await replay.createMessage(req);

    expect(replayed).toEqual(live);
    expect(replayed).toEqual(recorded);
  });

  it('records one entry per call with a fingerprint and a readable summary', async () => {
    const rec = new RecordingClient(new FakeModelClient([assistantMessage([textBlock('ok')])]));
    await rec.createMessage(request());
    const cassette = rec.cassette('t');

    expect(cassette.entries).toHaveLength(1);
    expect(cassette.entries[0]?.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(cassette.entries[0]?.request).toMatchObject({ model: 'claude-haiku-4-5', messageCount: 1, tools: ['lookup_payment'] });
  });
});

describe('replay miss', () => {
  it('throws a diff-friendly ReplayMissError naming what changed', async () => {
    const rec = new RecordingClient(new FakeModelClient([assistantMessage([textBlock('ok')])]));
    await rec.createMessage(request());
    const replay = new ReplayClient(rec.cassette('happy'));

    try {
      await replay.createMessage(request({ system: 'a different system prompt' }));
      expect.unreachable('should have thrown ReplayMissError');
    } catch (error) {
      expect(error).toBeInstanceOf(ReplayMissError);
      const message = (error as ReplayMissError).message;
      expect(message).toContain('Replay miss on cassette "happy"');
      expect(message).toContain('system prompt changed');
      expect(message).toContain('npm run record');
    }
  });

  it('reports available turn positions when no turn matches the message count', async () => {
    const rec = new RecordingClient(new FakeModelClient([assistantMessage([textBlock('ok')])]));
    await rec.createMessage(request()); // 1 message recorded
    const replay = new ReplayClient(rec.cassette('happy'));

    const twoMessages = request({
      messages: [
        { role: 'user', content: 'refund pay_001' },
        { role: 'assistant', content: 'done' },
      ],
    });
    await expect(replay.createMessage(twoMessages)).rejects.toThrow(/no turn at 2 messages; recorded turns are at \[1\]/);
  });

  it('names a model change', async () => {
    const rec = new RecordingClient(new FakeModelClient([assistantMessage([textBlock('ok')])]));
    await rec.createMessage(request());
    const replay = new ReplayClient(rec.cassette('happy'));
    await expect(replay.createMessage(request({ model: 'claude-opus-4-8' }))).rejects.toThrow(
      /model: recorded claude-haiku-4-5 → got claude-opus-4-8/,
    );
  });

  it('names a tools change', async () => {
    const rec = new RecordingClient(new FakeModelClient([assistantMessage([textBlock('ok')])]));
    await rec.createMessage(request());
    const replay = new ReplayClient(rec.cassette('happy'));
    await expect(
      replay.createMessage(request({ tools: [{ name: 'other', description: 'x', input_schema: { type: 'object' } }] })),
    ).rejects.toThrow(/tools: recorded \[lookup_payment\] → got \[other\]/);
  });
});

describe('summarize', () => {
  it('marks an absent system prompt and extracts tool names', () => {
    const noSystem: Anthropic.MessageCreateParamsNonStreaming = {
      model: 'claude-haiku-4-5',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'hi' }],
      tools: [
        { name: 'a', description: '', input_schema: { type: 'object' } },
        { name: 'b', description: '', input_schema: { type: 'object' } },
      ],
    };
    const summary = summarize(noSystem);
    expect(summary.systemDigest).toBe('none');
    expect(summary.tools).toEqual(['a', 'b']);
  });

  it('truncates a long last message', () => {
    const summary = summarize(request({ messages: [{ role: 'user', content: 'x'.repeat(300) }] }));
    expect(summary.lastMessage.length).toBeLessThan(300);
    expect(summary.lastMessage.endsWith('…')).toBe(true);
  });
});
