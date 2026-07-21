import { z } from 'zod';
import { SequentialIdGenerator, type IdGenerator } from '../harness/determinism';
import { checkRefund, type PolicyDecision } from './guardrails';
import { formatZodError, toInputSchema } from './json-schema';
import { createPaymentsDb, type PaymentsDb } from './payments-db';

export interface ToolContext {
  db: PaymentsDb;
  ids: IdGenerator;
}

export type ParseResult = { ok: true; value: unknown } | { ok: false; error: string };

/**
 * A tool the agent may call. The two gates (GUARDRAILS.md) are separable so the
 * loop can run them in order and trace each: `parse` is Gate 1 (schema); the
 * optional `policy` is Gate 2 (domain rules); `run` executes only once both pass.
 * `run`/`policy` receive the parsed value — callers must pass `parse().value`.
 */
export interface RegisteredTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  parse(raw: unknown): ParseResult;
  run(value: unknown, ctx: ToolContext): unknown;
  policy?(value: unknown, ctx: ToolContext): PolicyDecision;
}

function defineTool<I>(spec: {
  name: string;
  description: string;
  schema: z.ZodType<I>;
  run: (input: I, ctx: ToolContext) => unknown;
  policy?: (input: I, ctx: ToolContext) => PolicyDecision;
}): RegisteredTool {
  const tool: RegisteredTool = {
    name: spec.name,
    description: spec.description,
    inputSchema: toInputSchema(spec.schema),
    parse(raw) {
      const parsed = spec.schema.safeParse(raw);
      return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: formatZodError(parsed.error) };
    },
    // `value` comes from parse() → the cast is confined to this boundary.
    run: (value, ctx) => spec.run(value as I, ctx),
  };
  if (spec.policy) {
    const policy = spec.policy;
    tool.policy = (value, ctx) => policy(value as I, ctx);
  }
  return tool;
}

const LookupInput = z.object({
  payment_id: z.string().optional(),
  customer_email: z.string().optional(),
});

const RefundInput = z.object({
  payment_id: z.string(),
  amount: z.number().int().positive(),
  reason: z.string().min(1),
});

const EscalateInput = z.object({
  reason: z.string().min(1),
  priority: z.enum(['low', 'normal', 'high']),
});

export const lookupPaymentTool = defineTool({
  name: 'lookup_payment',
  description:
    'Look up a payment by its id or by customer email. Amounts are integer minor units (cents). Call this before refunding.',
  schema: LookupInput,
  run: (input, ctx) => {
    if (input.payment_id) {
      const payment = ctx.db.findById(input.payment_id);
      return payment ? { found: true, payment } : { found: false };
    }
    if (input.customer_email) {
      const payments = ctx.db.findByEmail(input.customer_email);
      return { found: payments.length > 0, payments };
    }
    return { found: false, error: 'provide payment_id or customer_email' };
  },
});

export const issueRefundTool = defineTool({
  name: 'issue_refund',
  description: 'Refund a captured payment. `amount` is in minor units (cents) and must not exceed the payment.',
  schema: RefundInput,
  policy: (input, ctx) => checkRefund(input, ctx.db),
  run: (input, ctx) => ({
    ok: true,
    refund: ctx.db.recordRefund({ paymentId: input.payment_id, amount: input.amount, reason: input.reason }),
  }),
});

export const escalateTool = defineTool({
  name: 'escalate',
  description: "Hand off to a human when you shouldn't or can't act. Use this instead of guessing.",
  schema: EscalateInput,
  run: (input, ctx) => ({ ticket_id: ctx.ids.next('tkt'), priority: input.priority }),
});

/** The domain tools, in a stable order (order feeds request fingerprints in Phase 2). */
export const DOMAIN_TOOLS: readonly RegisteredTool[] = [lookupPaymentTool, issueRefundTool, escalateTool];

/** Fresh, deterministic per-run state (seeded db + id generator) — one place every run site builds its context. */
export function createRunContext(): ToolContext {
  const ids = new SequentialIdGenerator();
  return { db: createPaymentsDb(ids), ids };
}
