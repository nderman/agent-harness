/**
 * Named agent scenarios, shared by the record CLI and the replay tests so the
 * recorded input and the replayed input are guaranteed identical (a mismatch
 * would be a fingerprint miss). Phase 3 extends this list with the eval set.
 */
export interface Scenario {
  name: string;
  input: string;
}

export const HAPPY_PATH_REFUND: Scenario = {
  name: 'happy-path-refund',
  input: 'Hi, please refund my payment pay_001 in full — the order was cancelled.',
};

export const SCENARIOS: readonly Scenario[] = [HAPPY_PATH_REFUND];
