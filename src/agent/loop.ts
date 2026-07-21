import type Anthropic from '@anthropic-ai/sdk';
import { DEFAULTS } from '../harness/model-client/defaults';
import { isModelClientError, type ModelClient } from '../harness/model-client/types';
import { nullTracer } from '../harness/trace/tracer';
import type { Tracer } from '../harness/trace/types';
import { formatZodError } from './json-schema';
import { SYSTEM_PROMPT } from './prompt';
import { RESOLVE_TOOL, RESOLVE_TOOL_NAME, Resolution } from './resolution';
import type { RegisteredTool, ToolContext } from './tools';

export interface LoopConfig {
  agentModel: string;
  maxTokens: number;
  maxReprompts: number;
  loopCap: number;
}

export interface RunAgentArgs {
  client: ModelClient;
  input: string;
  tools: readonly RegisteredTool[];
  ctx: ToolContext;
  tracer?: Tracer;
  system?: string;
  config?: Partial<LoopConfig>;
}

export type AgentFailure =
  | 'no_resolution' // model kept ending its turn without calling resolve
  | 'reprompt_exhausted' // too many schema-invalid / unknown-tool emissions
  | 'loop_cap' // ran past the iteration ceiling
  | 'request_error' // fail-fast: a config bug reached the model call
  | 'transport_error'; // capacity/network, already retried by the SDK

export type AgentOutcome =
  | { ok: true; resolution: Resolution }
  | { ok: false; reason: AgentFailure; detail: string };

function toAnthropicTools(tools: readonly RegisteredTool[]): Anthropic.Tool[] {
  // RESOLVE_TOOL shares the { name, description, inputSchema } shape, so the
  // terminal tool maps identically to the domain tools.
  return [...tools, RESOLVE_TOOL].map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
  }));
}

function errorResult(id: string, text: string): Anthropic.ToolResultBlockParam {
  return { type: 'tool_result', tool_use_id: id, content: text, is_error: true };
}

function okResult(id: string, result: unknown): Anthropic.ToolResultBlockParam {
  return { type: 'tool_result', tool_use_id: id, content: JSON.stringify(result) };
}

/**
 * The agentic loop (DESIGN Decision 3). We own it because it's where the seam,
 * tracing, and — from Phase 3 — guardrails hook in. The model finishes by
 * calling `resolve` (Decision 7); schema-invalid emissions are re-prompted with
 * the error, bounded by `maxReprompts`; a config bug at the model call fails
 * fast. Nothing here is model-specific beyond the prompt and tool set.
 */
export async function runAgent(args: RunAgentArgs): Promise<AgentOutcome> {
  const tracer = args.tracer ?? nullTracer;
  const model = args.config?.agentModel ?? DEFAULTS.agentModel;
  const maxTokens = args.config?.maxTokens ?? DEFAULTS.maxTokens;
  const maxReprompts = args.config?.maxReprompts ?? DEFAULTS.maxReprompts;
  const loopCap = args.config?.loopCap ?? DEFAULTS.loopCap;
  const system = args.system ?? SYSTEM_PROMPT;
  const registry = new Map(args.tools.map((t) => [t.name, t]));
  const tools = toAnthropicTools(args.tools);

  tracer.emit({ type: 'run_started', input: args.input });
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: args.input }];
  // Two independent budgets so the reported failure matches its cause: empty
  // turns drive `no_resolution`, invalid emissions drive `reprompt_exhausted`.
  let emptyTurns = 0;
  let invalidEmissions = 0;

  const finish = (outcome: AgentOutcome): AgentOutcome => {
    tracer.emit({ type: 'run_completed', ok: outcome.ok, reason: outcome.ok ? undefined : outcome.reason });
    return outcome;
  };

  for (let iteration = 0; iteration < loopCap; iteration++) {
    let response: Anthropic.Message;
    try {
      response = await args.client.createMessage({ model, max_tokens: maxTokens, system, messages, tools });
    } catch (error) {
      if (isModelClientError(error)) {
        const reason = error.kind === 'request' ? 'request_error' : 'transport_error';
        return finish({ ok: false, reason, detail: error.message });
      }
      throw error;
    }

    // Echo the assistant turn back so the conversation stays well-formed. The
    // double-cast is the known ContentBlock[] → ContentBlockParam[] SDK friction;
    // the two are structurally compatible for echoing a response back as input.
    messages.push({ role: 'assistant', content: response.content as unknown as Anthropic.ContentBlockParam[] });

    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (toolUses.length === 0) {
      emptyTurns++;
      if (emptyTurns > maxReprompts) return finish({ ok: false, reason: 'no_resolution', detail: 'model ended its turn without calling resolve' });
      messages.push({ role: 'user', content: 'Please finish by calling the resolve tool.' });
      continue;
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    let resolution: Resolution | undefined;

    for (const call of toolUses) {
      const succeed = (result: unknown): void => {
        results.push(okResult(call.id, result));
        tracer.emit({ type: 'tool_call', tool: call.name, ok: true });
      };
      const reject = (error: string): void => {
        invalidEmissions++;
        results.push(errorResult(call.id, error));
        tracer.emit({ type: 'tool_call', tool: call.name, ok: false });
      };

      if (call.name === RESOLVE_TOOL_NAME) {
        const parsed = Resolution.safeParse(call.input);
        if (parsed.success) {
          resolution = parsed.data;
          succeed({ acknowledged: true });
        } else {
          reject(formatZodError(parsed.error));
        }
        continue;
      }

      const tool = registry.get(call.name);
      if (!tool) {
        reject(`unknown tool: ${call.name}`);
        continue;
      }

      const outcome = tool.invoke(call.input, args.ctx);
      if (outcome.status === 'ok') succeed(outcome.result);
      else reject(outcome.error);
    }

    if (resolution) return finish({ ok: true, resolution });
    if (invalidEmissions > maxReprompts) return finish({ ok: false, reason: 'reprompt_exhausted', detail: 'too many invalid tool emissions' });
    messages.push({ role: 'user', content: results });
  }

  return finish({ ok: false, reason: 'loop_cap', detail: `exceeded ${loopCap} iterations` });
}
