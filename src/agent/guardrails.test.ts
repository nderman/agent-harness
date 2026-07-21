import { describe, it, expect } from 'vitest';
import { SequentialIdGenerator } from '../harness/determinism';
import { createPaymentsDb, type PaymentsDb } from './payments-db';
import { REFUND_CEILING, checkRefund } from './guardrails';

function db(): PaymentsDb {
  return createPaymentsDb(new SequentialIdGenerator());
}

describe('checkRefund', () => {
  it('allows a full refund of a captured payment within the ceiling', () => {
    expect(checkRefund({ payment_id: 'pay_001', amount: 4250, reason: 'x' }, db())).toEqual({ allowed: true });
  });

  it('denies an unknown payment', () => {
    expect(checkRefund({ payment_id: 'pay_999', amount: 1, reason: 'x' }, db())).toMatchObject({ allowed: false, policy: 'unknown_payment' });
  });

  it('denies a double refund (already refunded)', () => {
    expect(checkRefund({ payment_id: 'pay_003', amount: 5000, reason: 'x' }, db())).toMatchObject({ allowed: false, policy: 'double_refund' });
  });

  it('denies a payment that is not captured', () => {
    // pay_004 is failed
    expect(checkRefund({ payment_id: 'pay_004', amount: 3000, reason: 'x' }, db())).toMatchObject({ allowed: false, policy: 'not_refundable' });
  });

  it('denies a refund larger than the payment', () => {
    expect(checkRefund({ payment_id: 'pay_001', amount: 4251, reason: 'x' }, db())).toMatchObject({ allowed: false, policy: 'over_refund' });
  });

  it('denies a refund over the ceiling and tells the agent to escalate', () => {
    // pay_002 is 120000 (over the 50000 ceiling), captured
    const decision = checkRefund({ payment_id: 'pay_002', amount: 120000, reason: 'x' }, db());
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.policy).toBe('ceiling');
      expect(decision.reason).toContain('escalate');
    }
  });

  it('allows a refund exactly at the ceiling', () => {
    // construct a hypothetical: pay_001 is well under; test the boundary via a captured payment of exactly the ceiling
    // pay_002 is captured at 120000; a partial refund at the ceiling is allowed
    expect(checkRefund({ payment_id: 'pay_002', amount: REFUND_CEILING, reason: 'x' }, db())).toEqual({ allowed: true });
  });

  it('denies one minor unit over the ceiling', () => {
    expect(checkRefund({ payment_id: 'pay_002', amount: REFUND_CEILING + 1, reason: 'x' }, db())).toMatchObject({ allowed: false, policy: 'ceiling' });
  });
});
