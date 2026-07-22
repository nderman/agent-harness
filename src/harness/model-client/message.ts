import type Anthropic from '@anthropic-ai/sdk';

/**
 * Builders for Anthropic `Message` responses, shared by the scripted
 * `FakeModelClient` and the `FaultInjectingClient`. Localized casts spare
 * callers from spelling out every Usage/citation field the SDK type requires —
 * this is response-shaping used by seam-level clients, not test-only scaffolding.
 */

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
