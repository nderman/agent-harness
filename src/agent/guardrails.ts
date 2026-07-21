import type { PaymentsDb } from './payments-db';

/**
 * The outcome of a Gate 2 policy check (GUARDRAILS.md). A denial carries the
 * policy that fired and a model-facing reason, so the loop can hand it back as a
 * structured tool error the agent can recover from (typically by escalating).
 */
export type PolicyDecision =
  | { allowed: true }
  | { allowed: false; policy: string; reason: string };

/** Blast-radius cap: an agent gets a spending limit like any junior employee. €500 in minor units. */
export const REFUND_CEILING = 50_000;

export interface RefundArgs {
  payment_id: string;
  amount: number;
  reason: string;
}

/**
 * Gate 2 for `issue_refund`. Checks against the looked-up record, not the
 * model's claims, in a fixed precedence: existence → not-already-refunded
 * (idempotency) → refundable state → no over-refund → ceiling. Read-only; it
 * decides, it does not act.
 */
export function checkRefund(args: RefundArgs, db: PaymentsDb): PolicyDecision {
  const payment = db.findById(args.payment_id);
  if (!payment) {
    return { allowed: false, policy: 'unknown_payment', reason: `no payment ${args.payment_id}` };
  }
  if (payment.status === 'refunded') {
    return { allowed: false, policy: 'double_refund', reason: `payment ${payment.id} has already been refunded` };
  }
  if (payment.status !== 'captured') {
    return { allowed: false, policy: 'not_refundable', reason: `payment ${payment.id} is ${payment.status}, not captured` };
  }
  if (args.amount > payment.amount) {
    return { allowed: false, policy: 'over_refund', reason: `refund ${args.amount} exceeds the payment amount ${payment.amount}` };
  }
  if (args.amount > REFUND_CEILING) {
    return {
      allowed: false,
      policy: 'ceiling',
      reason: `refund ${args.amount} exceeds the ${REFUND_CEILING} auto-approval ceiling — escalate for manual approval`,
    };
  }
  return { allowed: true };
}
