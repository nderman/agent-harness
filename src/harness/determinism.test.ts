import { describe, it, expect } from 'vitest';
import {
  FixedClock,
  SequentialIdGenerator,
  SystemClock,
  type Clock,
  type IdGenerator,
} from './determinism';

describe('FixedClock', () => {
  it('returns its configured instant', () => {
    const clock: Clock = new FixedClock(1_700_000_000_000);
    expect(clock.now()).toBe(1_700_000_000_000);
  });

  it('repeats the same instant when no step is set', () => {
    const clock = new FixedClock(1_000);
    expect(clock.now()).toBe(1_000);
    expect(clock.now()).toBe(1_000);
    expect(clock.now()).toBe(1_000);
  });

  it('advances by the step on each read when a step is set', () => {
    const clock = new FixedClock(1_000, 5);
    expect(clock.now()).toBe(1_000);
    expect(clock.now()).toBe(1_005);
    expect(clock.now()).toBe(1_010);
  });
});

describe('SequentialIdGenerator', () => {
  it('produces stable, sequential ids for a default prefix', () => {
    const ids: IdGenerator = new SequentialIdGenerator();
    expect(ids.next()).toBe('id_1');
    expect(ids.next()).toBe('id_2');
    expect(ids.next()).toBe('id_3');
  });

  it('counts each prefix independently', () => {
    const ids = new SequentialIdGenerator();
    expect(ids.next('run')).toBe('run_1');
    expect(ids.next('evt')).toBe('evt_1');
    expect(ids.next('run')).toBe('run_2');
    expect(ids.next('evt')).toBe('evt_2');
  });

  it('is reproducible from a fresh instance', () => {
    const a = new SequentialIdGenerator();
    const b = new SequentialIdGenerator();
    expect([a.next('x'), a.next('x')]).toEqual([b.next('x'), b.next('x')]);
  });
});

describe('SystemClock', () => {
  it('returns a positive epoch-millisecond reading', () => {
    const before = Date.now();
    const reading = new SystemClock().now();
    const after = Date.now();
    expect(reading).toBeGreaterThanOrEqual(before);
    expect(reading).toBeLessThanOrEqual(after);
  });
});
