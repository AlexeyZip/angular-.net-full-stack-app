import { HttpErrorResponse } from '@angular/common/http';

/**
 * Normalized, serializable error. Stores keep this (never an HttpErrorResponse) so that state stays
 * plain data: easy to test, safe for NgRx DevTools and free of request internals.
 */
export interface ApiError {
  readonly status: number;
  /** Stable machine-readable code from the API's problem details, e.g. "insufficient_stock". */
  readonly code: string;
  readonly message: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  readonly details: unknown;
}

interface ProblemDetailsBody {
  title?: unknown;
  code?: unknown;
  errors?: unknown;
  details?: unknown;
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return { status: 0, code: 'network_error', message: 'Cannot reach the server. Check your connection and try again.', fieldErrors: {}, details: null };
    }

    // Runtime narrowing: the body is untrusted input, whatever the TypeScript types claim.
    const body: ProblemDetailsBody = typeof error.error === 'object' && error.error !== null ? (error.error as ProblemDetailsBody) : {};
    return {
      status: error.status,
      code: typeof body.code === 'string' ? body.code : `http_${error.status}`,
      message: typeof body.title === 'string' ? body.title : defaultMessage(error.status),
      fieldErrors: isFieldErrors(body.errors) ? body.errors : {},
      details: body.details ?? null,
    };
  }

  return { status: -1, code: 'unexpected_error', message: 'Something went wrong. Please try again.', fieldErrors: {}, details: null };
}

function isFieldErrors(value: unknown): value is Record<string, string[]> {
  return typeof value === 'object' && value !== null && Object.values(value).every((v) => Array.isArray(v));
}

function defaultMessage(status: number): string {
  switch (status) {
    case 401:
      return 'Please sign in to continue.';
    case 403:
      return 'You do not have permission to do that.';
    case 404:
      return 'The requested item was not found.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    default:
      return status >= 500 ? 'The server had a problem. Please try again later.' : 'The request could not be completed.';
  }
}
