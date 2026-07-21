import type Anthropic from '@anthropic-ai/sdk';
import { makeModelClientError, type ModelClient, type ModelClientError } from './types';

/**
 * A scripted `ModelClient` for tests: hand it a sequence of assistant messages
 * (or errors to throw) and it serves them in order, ignoring request content.
 * This proves the loop against the seam before cassettes exist. It records every
 * request so tests can assert on what the loop sent.
 */
export class FakeModelClient implements ModelClient {
  readonly #queue: Array<Anthropic.Message | ModelClientError>;
  readonly requests: Anthropic.MessageCreateParamsNonStreaming[] = [];

  constructor(scripted: Array<Anthropic.Message | ModelClientError>) {
    this.#queue = [...scripted];
  }

  async createMessage(request: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
    this.requests.push(request);
    const next = this.#queue.shift();
    if (next === undefined) {
      throw makeModelClientError({ kind: 'transport', status: undefined, message: 'FakeModelClient: script exhausted', cause: undefined });
    }
    if ('kind' in next) throw next;
    return next;
  }
}

// --- message builders (test fixtures) -------------------------------------
// Assistant messages are the response shape, built with localized casts so tests
// don't have to spell out every Usage/citation field the SDK type requires.

export function textBlock(text: string): Anthropic.TextBlock {
  return { type: 'text', text, citations: null } as Anthropic.TextBlock;
}

export function toolUseBlock(id: string, name: string, input: unknown): Anthropic.ToolUseBlock {
  return { type: 'tool_use', id, name, input } as Anthropic.ToolUseBlock;
}

export function assistantMessage(
  content: Anthropic.ContentBlock[],
  stopReason: Anthropic.Message['stop_reason'] = 'end_turn',
): Anthropic.Message {
  return {
    id: 'msg_fake',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-4-5',
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 },
  } as Anthropic.Message;
}

/** Convenience: a single tool_use turn (`stop_reason: 'tool_use'`). */
export function toolUseTurn(id: string, name: string, input: unknown): Anthropic.Message {
  return assistantMessage([toolUseBlock(id, name, input)], 'tool_use');
}
