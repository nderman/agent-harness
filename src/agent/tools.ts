import { z } from 'zod';
import type { IdGenerator } from '../harness/determinism';
import type { PaymentsDb } from './payments-db';
import { formatZodError, toInputSchema } from './json-schema';

export interface ToolContext {
  db: PaymentsDb;
  ids: IdGenerator;
}

/**
 * Result of invoking a tool. `invalid` is a Gate 1 (schema) failure — the model
 * emitted arguments that don't fit the schema. Gate 2 (policy) lands in Phase 3
 * as a third `denied` variant; the loop already switches on this union so adding
 * it is additive.
 */
export type ToolOutcome =
  | { status: 'ok'; result: unknown }
  | { status: 'invalid'; error: string };

export interface RegisteredTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Validate (Gate 1) then run. Never throws for model-caused errors — returns them. */
  invoke(rawInput: unknown, ctx: ToolContext): ToolOutcome;
}

function defineTool<I>(spec: {
  name: string;
  description: string;
  schema: z.ZodType<I>;
  run: (input: I, ctx: ToolContext) => unknown;
}): RegisteredTool {
  return {
    name: spec.name,
    description: spec.description,
    inputSchema: toInputSchema(spec.schema),
    invoke(rawInput, ctx) {
      const parsed = spec.schema.safeParse(rawInput);
      if (!parsed.success) return { status: 'invalid', error: formatZodError(parsed.error) };
      // parsed.data is I by construction — the cast is confined to this boundary.
      return { status: 'ok', result: spec.run(parsed.data, ctx) };
    },
  };
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
  run: (input, ctx) => {
    const payment = ctx.db.findById(input.payment_id);
    if (!payment) return { ok: false, error: `no payment ${input.payment_id}` };
    const refund = ctx.db.recordRefund({ paymentId: input.payment_id, amount: input.amount, reason: input.reason });
    return { ok: true, refund };
  },
});

export const escalateTool = defineTool({
  name: 'escalate',
  description: "Hand off to a human when you shouldn't or can't act. Use this instead of guessing.",
  schema: EscalateInput,
  run: (input, ctx) => ({ ticket_id: ctx.ids.next('tkt'), priority: input.priority }),
});

/** The domain tools, in a stable order (order feeds request fingerprints in Phase 2). */
export const DOMAIN_TOOLS: readonly RegisteredTool[] = [lookupPaymentTool, issueRefundTool, escalateTool];
