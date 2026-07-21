import type Anthropic from '@anthropic-ai/sdk';
import { canonicalStringify, sha256Hex } from './fingerprint';

/**
 * A human-oriented digest of a request. It is NOT used for matching (the
 * fingerprint is) — it exists so a cassette diff is readable in a PR and so a
 * replay miss can say which of the four fingerprinted fields changed.
 */
export interface RequestSummary {
  model: string;
  messageCount: number;
  tools: string[];
  /** Short hash of the system prompt, so a prompt change shows up in a miss. */
  systemDigest: string;
  /** Truncated preview of the last message. */
  lastMessage: string;
}

export interface CassetteEntry {
  fingerprint: string;
  request: RequestSummary;
  response: Anthropic.Message;
}

export interface Cassette {
  scenario: string;
  entries: CassetteEntry[];
}

const PREVIEW_LEN = 160;

function toolNames(tools: Anthropic.MessageCreateParamsNonStreaming['tools']): string[] {
  return (tools ?? []).map((t) => ('name' in t && typeof t.name === 'string' ? t.name : 'unknown'));
}

function previewOf(message: Anthropic.MessageParam | undefined): string {
  if (message === undefined) return '';
  const text = typeof message.content === 'string' ? message.content : canonicalStringify(message.content);
  return text.length > PREVIEW_LEN ? `${text.slice(0, PREVIEW_LEN)}…` : text;
}

export function summarize(request: Anthropic.MessageCreateParamsNonStreaming): RequestSummary {
  const systemDigest = request.system === undefined ? 'none' : sha256Hex(canonicalStringify(request.system)).slice(0, 12);
  return {
    model: request.model,
    messageCount: request.messages.length,
    tools: toolNames(request.tools),
    systemDigest,
    lastMessage: previewOf(request.messages[request.messages.length - 1]),
  };
}
