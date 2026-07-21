import Anthropic from '@anthropic-ai/sdk';
import { makeModelClientError, type ModelClientError } from './types';

/**
 * Map an SDK exception to the error taxonomy (DESIGN Decision 8). A 4xx that
 * isn't 408/409/429 is a request bug → fail fast. Everything else — 429, 5xx,
 * connection failures (status undefined), and anything unrecognised — is treated
 * as transport/capacity, which the SDK has already retried; a thrown one is
 * terminal for the run. Unknown non-API errors default to transport rather than
 * request: better to surface a blip as retryable than to mask it as a config bug.
 */
export function classifyError(error: unknown): ModelClientError {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof Anthropic.APIError) {
    const status = error.status;
    const isRequestBug = status !== undefined && status !== 408 && status !== 409 && status !== 429 && status < 500;
    if (isRequestBug) return makeModelClientError({ kind: 'request', status, message, cause: error });
    return makeModelClientError({ kind: 'transport', status, message, cause: error });
  }

  return makeModelClientError({ kind: 'transport', status: undefined, message, cause: error });
}
