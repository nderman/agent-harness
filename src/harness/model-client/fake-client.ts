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

// The message builders live in ./message (shared with FaultInjectingClient) and
// are re-exported here so existing `from './fake-client'` imports keep working.
export { textBlock, toolUseBlock, assistantMessage, toolUseTurn } from './message';
