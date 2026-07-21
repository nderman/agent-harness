import { describe, it, expect } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { classifyError } from './classify';

function apiError(status: number) {
  return new Anthropic.APIError(status, undefined, `status ${status}`, undefined);
}

describe('classifyError — transport (retryable, terminal once thrown)', () => {
  it.each([429, 500, 502, 503, 529, 408, 409])('classifies %i as transport', (status) => {
    const err = classifyError(apiError(status));
    expect(err.kind).toBe('transport');
    expect(err.status).toBe(status);
  });

  it('classifies a connection error (no status) as transport', () => {
    const err = classifyError(new Anthropic.APIConnectionError({ message: 'socket hang up' }));
    expect(err).toMatchObject({ kind: 'transport', status: undefined });
  });

  it('defaults an unknown non-API error to transport', () => {
    const err = classifyError(new Error('something odd'));
    expect(err).toMatchObject({ kind: 'transport', status: undefined, message: 'something odd' });
  });
});

describe('classifyError — request (fail-fast, never retried)', () => {
  it.each([400, 401, 403, 404, 413, 422])('classifies %i as request', (status) => {
    const err = classifyError(apiError(status));
    expect(err.kind).toBe('request');
    expect(err.status).toBe(status);
  });
});
