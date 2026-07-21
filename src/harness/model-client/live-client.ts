import Anthropic from '@anthropic-ai/sdk';
import type { Clock } from '../determinism';
import type { Tracer } from '../trace/types';
import { nullTracer } from '../trace/tracer';
import { classifyError } from './classify';
import { DEFAULTS } from './defaults';
import type { ModelClient } from './types';

export interface LiveClientOptions {
  apiKey?: string;
  clock: Clock;
  tracer?: Tracer;
  maxRetries?: number;
  timeoutMs?: number;
}

/**
 * The generalized model wrapper (DESIGN Decision 8): the one place that owns SDK
 * config, error normalization, and per-call trace emission. Transport retries
 * are delegated to the SDK (`maxRetries`); on final failure the exception is
 * normalized to a `ModelClientError` and re-thrown. Latency uses the injected
 * clock so it stays deterministic under record/replay.
 */
export class LiveClient implements ModelClient {
  readonly #sdk: Anthropic;
  readonly #clock: Clock;
  readonly #tracer: Tracer;

  constructor(options: LiveClientOptions) {
    this.#sdk = new Anthropic({
      ...(options.apiKey !== undefined ? { apiKey: options.apiKey } : {}),
      maxRetries: options.maxRetries ?? DEFAULTS.maxRetries,
      timeout: options.timeoutMs ?? DEFAULTS.timeoutMs,
    });
    this.#clock = options.clock;
    this.#tracer = options.tracer ?? nullTracer;
  }

  async createMessage(request: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
    this.#tracer.emit({ type: 'model_request', model: request.model, messageCount: request.messages.length });
    const start = this.#clock.now();
    try {
      const response = await this.#sdk.messages.create(request);
      this.#tracer.emit({
        type: 'model_response',
        stopReason: response.stop_reason,
        usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
        latencyMs: this.#clock.now() - start,
      });
      return response;
    } catch (error) {
      const normalized = classifyError(error);
      this.#tracer.emit({ type: 'model_error', kind: normalized.kind, status: normalized.status, message: normalized.message, latencyMs: this.#clock.now() - start });
      throw normalized;
    }
  }
}
