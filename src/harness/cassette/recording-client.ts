import type Anthropic from '@anthropic-ai/sdk';
import type { ModelClient } from '../model-client/types';
import { fingerprint } from './fingerprint';
import { summarize, type Cassette, type CassetteEntry } from './types';

/**
 * Wraps a real `ModelClient`, calling through to it and capturing each
 * request→response as a cassette entry (DESIGN Decision 1: record/replay lives
 * at the seam, in SDK types — not at the HTTP layer). The inner client still
 * emits its own trace events, so this only records; it does not trace.
 */
export class RecordingClient implements ModelClient {
  readonly #inner: ModelClient;
  readonly #entries: CassetteEntry[] = [];

  constructor(inner: ModelClient) {
    this.#inner = inner;
  }

  async createMessage(request: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
    const response = await this.#inner.createMessage(request);
    this.#entries.push({ fingerprint: fingerprint(request), request: summarize(request), response });
    return response;
  }

  cassette(scenario: string): Cassette {
    return { scenario, entries: [...this.#entries] };
  }
}
