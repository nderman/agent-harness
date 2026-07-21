import type Anthropic from '@anthropic-ai/sdk';
import type { ModelClient } from '../model-client/types';
import { nullTracer } from '../trace/tracer';
import type { Tracer } from '../trace/types';
import { fingerprint } from './fingerprint';
import { summarize, type Cassette, type RequestSummary } from './types';

/**
 * A replay miss is a first-class, expected event: the prompt, tools, or
 * conversation shape changed since the cassette was recorded. Strict matching
 * (DESIGN Decision 2) turns that into a loud failure with a decision attached —
 * intentional → re-record, unintentional → you just caught a bug — rather than
 * silent staleness.
 */
export class ReplayMissError extends Error {
  readonly kind = 'replay_miss' as const;

  constructor(message: string) {
    super(message);
    this.name = 'ReplayMissError';
  }
}

function diffSummaries(got: RequestSummary, recorded: RequestSummary): string[] {
  const diffs: string[] = [];
  if (got.model !== recorded.model) diffs.push(`model: recorded ${recorded.model} → got ${got.model}`);
  if (got.systemDigest !== recorded.systemDigest) diffs.push(`system prompt changed (${recorded.systemDigest} → ${got.systemDigest})`);
  if (got.tools.join(',') !== recorded.tools.join(',')) diffs.push(`tools: recorded [${recorded.tools.join(', ')}] → got [${got.tools.join(', ')}]`);
  if (got.lastMessage !== recorded.lastMessage) diffs.push('last message changed');
  return diffs;
}

export function describeMiss(request: Anthropic.MessageCreateParamsNonStreaming, cassette: Cassette): string {
  const got = summarize(request);
  // Match a recorded turn by conversation position (message count); with multiple
  // turns at the same count this diffs against the first — fine for a diagnostic.
  const sameTurn = cassette.entries.find((e) => e.request.messageCount === got.messageCount);
  const lines = [
    `Replay miss on cassette "${cassette.scenario}": no recorded response matches this request.`,
    `  request: ${got.messageCount} message(s), model=${got.model}, tools=[${got.tools.join(', ')}], system=${got.systemDigest}`,
  ];
  if (sameTurn) {
    const diffs = diffSummaries(got, sameTurn.request);
    // The summary only captures the last message, so a change to an earlier turn
    // fingerprints as a miss without a summarized field to point at.
    lines.push(`  closest recorded turn (${got.messageCount} messages) differs in: ${diffs.length > 0 ? diffs.join('; ') : 'an earlier message (only the last message is summarized)'}`);
  } else {
    const counts = [...new Set(cassette.entries.map((e) => e.request.messageCount))].sort((a, b) => a - b);
    lines.push(`  cassette has no turn at ${got.messageCount} messages; recorded turns are at [${counts.join(', ')}]`);
  }
  lines.push('  → re-record with `npm run record` if this change is intentional.');
  return lines.join('\n');
}

/** Serves recorded responses by fingerprint, with no network. */
export class ReplayClient implements ModelClient {
  readonly #cassette: Cassette;
  readonly #byFingerprint: Map<string, Anthropic.Message>;
  readonly #tracer: Tracer;

  constructor(cassette: Cassette, tracer: Tracer = nullTracer) {
    this.#cassette = cassette;
    this.#byFingerprint = new Map(cassette.entries.map((e) => [e.fingerprint, e.response]));
    this.#tracer = tracer;
  }

  async createMessage(request: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
    this.#tracer.emit({ type: 'model_request', model: request.model, messageCount: request.messages.length });
    const response = this.#byFingerprint.get(fingerprint(request));
    if (response === undefined) throw new ReplayMissError(describeMiss(request, this.#cassette));
    this.#tracer.emit({
      type: 'model_response',
      stopReason: response.stop_reason,
      usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
      latencyMs: 0,
    });
    return response;
  }
}
