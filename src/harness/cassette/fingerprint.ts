import { createHash } from 'node:crypto';
import type Anthropic from '@anthropic-ai/sdk';

/**
 * Recursively sort object keys so semantically-equal requests serialize to the
 * same bytes regardless of key insertion order. Array order is preserved —
 * message and content order is meaningful and must affect the fingerprint.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return Object.keys(source)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize(source[key]);
        return acc;
      }, {});
  }
  return value;
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * The four fields that define the semantic request (DESIGN Decision 2): model,
 * system, messages, tools. Generation knobs like `max_tokens` are deliberately
 * excluded — they don't change what conversation state the response answers, so
 * a cassette stays valid across a `max_tokens` tweak.
 */
export function fingerprintInput(request: Anthropic.MessageCreateParamsNonStreaming): unknown {
  return {
    model: request.model,
    system: request.system ?? null,
    messages: request.messages,
    tools: request.tools ?? null,
  };
}

export function fingerprint(request: Anthropic.MessageCreateParamsNonStreaming): string {
  return sha256Hex(canonicalStringify(fingerprintInput(request)));
}
