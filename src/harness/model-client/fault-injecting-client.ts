import type Anthropic from '@anthropic-ai/sdk';
import { toolUseTurn } from './message';
import type { ModelClient } from './types';

export interface ForcedToolCall {
  /** 0-based index of the `createMessage` call to hijack. */
  callIndex: number;
  toolUseId: string;
  toolName: string;
  input: unknown;
}

/**
 * A fault-injection decorator (see README "Known limitations"). It wraps any
 * `ModelClient` and, on the configured call index(es), forces a chosen tool call
 * instead of asking the inner client. Its reason to exist: make the agent attempt
 * an action a well-behaved model declines on its own — so a guardrail's *denial*
 * path runs end-to-end through the real loop (Gate 2 → structured error →
 * recovery), not only in a policy unit test.
 *
 * Non-injected calls pass straight through to the inner client, so a fault can be
 * dropped into an otherwise-real trajectory: force the unsafe turn, then let the
 * agent recover. (In offline tests the inner client is a scripted `FakeModelClient`
 * so the whole run stays deterministic.)
 */
export class FaultInjectingClient implements ModelClient {
  readonly #inner: ModelClient;
  readonly #faults: readonly ForcedToolCall[];
  #calls = 0;
  /** Call indexes actually hijacked — lets a test assert the fault fired. */
  readonly injected: number[] = [];

  constructor(inner: ModelClient, faults: readonly ForcedToolCall[]) {
    this.#inner = inner;
    this.#faults = faults;
  }

  async createMessage(request: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
    const index = this.#calls++;
    const fault = this.#faults.find((f) => f.callIndex === index);
    if (!fault) return this.#inner.createMessage(request);
    this.injected.push(index);
    return toolUseTurn(fault.toolUseId, fault.toolName, fault.input);
  }
}
