/**
 * Injected sources of time and identity.
 *
 * Nothing that feeds a model request, a cassette fingerprint, or a trace may
 * call `Date.now()`, `Math.random()`, or a UUID library directly — those make
 * requests unreproducible and silently break cassette matching. Code takes a
 * `Clock` and an `IdGenerator` instead. `SystemClock` is the single sanctioned
 * boundary where wall-clock time enters; deterministic implementations drive
 * tests, recording, and replay.
 */

export interface Clock {
  /** Epoch milliseconds. */
  now(): number;
}

export interface IdGenerator {
  /** A fresh identifier, namespaced by `prefix`. */
  next(prefix?: string): string;
}

/** Wall-clock time — the one place `Date.now()` is allowed. */
export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}

/** A clock frozen at a chosen instant, optionally advancing by `stepMs` per read. */
export class FixedClock implements Clock {
  #current: number;
  readonly #stepMs: number;

  constructor(startMs: number, stepMs = 0) {
    this.#current = startMs;
    this.#stepMs = stepMs;
  }

  now(): number {
    const value = this.#current;
    this.#current += this.#stepMs;
    return value;
  }
}

/** Deterministic ids of the form `${prefix}_${n}`, counted per prefix from 1. */
export class SequentialIdGenerator implements IdGenerator {
  readonly #counters = new Map<string, number>();

  next(prefix = 'id'): string {
    const n = (this.#counters.get(prefix) ?? 0) + 1;
    this.#counters.set(prefix, n);
    return `${prefix}_${n}`;
  }
}
