import { describe, it, expect } from 'vitest';
import { SequentialIdGenerator } from '../harness/determinism';
import { createPaymentsDb } from './payments-db';

describe('createPaymentsDb', () => {
  it('finds a seeded payment by id and returns a copy', () => {
    const db = createPaymentsDb(new SequentialIdGenerator());
    const p = db.findById('pay_001');
    expect(p).toMatchObject({ status: 'captured', amount: 4250, currency: 'EUR' });

    // mutating the returned copy must not affect the store
    p!.amount = 0;
    expect(db.findById('pay_001')?.amount).toBe(4250);
  });

  it('returns undefined for an unknown id', () => {
    const db = createPaymentsDb(new SequentialIdGenerator());
    expect(db.findById('pay_999')).toBeUndefined();
  });

  it('finds payments by customer email', () => {
    const db = createPaymentsDb(new SequentialIdGenerator());
    const found = db.findByEmail('alice@example.com');
    expect(found.map((p) => p.id)).toEqual(['pay_001']);
    expect(db.findByEmail('nobody@example.com')).toEqual([]);
  });

  it('records a refund, marks the payment refunded, and issues a deterministic id', () => {
    const db = createPaymentsDb(new SequentialIdGenerator());
    const refund = db.recordRefund({ paymentId: 'pay_001', amount: 4250, reason: 'order cancelled' });

    expect(refund).toMatchObject({ id: 're_1', paymentId: 'pay_001', amount: 4250, currency: 'EUR' });
    expect(db.findById('pay_001')?.status).toBe('refunded');
    expect(db.refundsFor('pay_001')).toEqual([refund]);
  });

  it('seeds fresh per instance — refunds do not leak between runs', () => {
    const a = createPaymentsDb(new SequentialIdGenerator());
    a.recordRefund({ paymentId: 'pay_001', amount: 4250, reason: 'x' });
    const b = createPaymentsDb(new SequentialIdGenerator());
    expect(b.findById('pay_001')?.status).toBe('captured');
    expect(b.refundsFor('pay_001')).toEqual([]);
  });

  it('throws if asked to refund an unknown payment', () => {
    const db = createPaymentsDb(new SequentialIdGenerator());
    expect(() => db.recordRefund({ paymentId: 'pay_999', amount: 1, reason: 'x' })).toThrow(/unknown payment/);
  });
});
