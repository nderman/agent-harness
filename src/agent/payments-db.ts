import type { IdGenerator } from '../harness/determinism';

export type PaymentStatus = 'captured' | 'refunded' | 'failed' | 'pending';
export type PaymentMethod = 'card' | 'bank_transfer';

export interface Payment {
  id: string;
  status: PaymentStatus;
  /** Minor units (e.g. cents). Avoids float money entirely. */
  amount: number;
  /** ISO 4217, e.g. 'EUR'. */
  currency: string;
  method: PaymentMethod;
  customerEmail: string;
}

export interface Refund {
  id: string;
  paymentId: string;
  amount: number;
  currency: string;
  reason: string;
}

const SEED: readonly Payment[] = [
  { id: 'pay_001', status: 'captured', amount: 4250, currency: 'EUR', method: 'card', customerEmail: 'alice@example.com' },
  { id: 'pay_002', status: 'captured', amount: 120000, currency: 'EUR', method: 'card', customerEmail: 'bob@example.com' },
  { id: 'pay_003', status: 'refunded', amount: 5000, currency: 'EUR', method: 'card', customerEmail: 'carol@example.com' },
  { id: 'pay_004', status: 'failed', amount: 3000, currency: 'EUR', method: 'card', customerEmail: 'dave@example.com' },
];

export interface PaymentsDb {
  findById(id: string): Payment | undefined;
  findByEmail(email: string): Payment[];
  /** Records a refund, marks the payment refunded, and returns the refund. */
  recordRefund(input: { paymentId: string; amount: number; reason: string }): Refund;
  refundsFor(paymentId: string): Refund[];
}

/**
 * A fresh in-memory payments store, seeded identically every call so runs are
 * independent and deterministic. Reads return copies so callers can't mutate
 * the store by reference. Refund ids come from the injected `IdGenerator`, not
 * a UUID lib — refund ids surface in the Resolution and must be reproducible.
 */
export function createPaymentsDb(ids: IdGenerator): PaymentsDb {
  const payments = new Map<string, Payment>(SEED.map((p) => [p.id, { ...p }]));
  const refunds: Refund[] = [];

  return {
    findById(id) {
      const p = payments.get(id);
      return p ? { ...p } : undefined;
    },
    findByEmail(email) {
      return [...payments.values()].filter((p) => p.customerEmail === email).map((p) => ({ ...p }));
    },
    recordRefund({ paymentId, amount, reason }) {
      const p = payments.get(paymentId);
      if (!p) throw new Error(`recordRefund: unknown payment ${paymentId}`);
      const refund: Refund = { id: ids.next('re'), paymentId, amount, currency: p.currency, reason };
      refunds.push(refund);
      p.status = 'refunded';
      return { ...refund };
    },
    refundsFor(paymentId) {
      return refunds.filter((r) => r.paymentId === paymentId).map((r) => ({ ...r }));
    },
  };
}
