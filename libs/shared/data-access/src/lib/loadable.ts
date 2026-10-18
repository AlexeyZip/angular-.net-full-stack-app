import { catchError, map, Observable, of, startWith } from 'rxjs';
import { ApiError, toApiError } from './api-error';

/**
 * Discriminated union for component-local async data. TypeScript narrows on `status`, so the template
 * can only read `value` after checking for 'success' - impossible states are unrepresentable.
 */
export type Loadable<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly value: T }
  | { readonly status: 'error'; readonly error: ApiError };

export const LOADING: Loadable<never> = { status: 'loading' };

export function valueOf<T>(state: Loadable<T>): T | null {
  return state.status === 'success' ? state.value : null;
}

export function errorOf(state: Loadable<unknown>): ApiError | null {
  return state.status === 'error' ? state.error : null;
}

/** Wraps a request so it emits loading -> success | error and never errors itself. */
export function loadable<T>(source: Observable<T>): Observable<Loadable<T>> {
  return source.pipe(
    map((value): Loadable<T> => ({ status: 'success', value })),
    startWith(LOADING),
    catchError((error: unknown) => of<Loadable<T>>({ status: 'error', error: toApiError(error) })),
  );
}
