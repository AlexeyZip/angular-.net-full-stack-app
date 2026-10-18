import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_BASE_URL, CSRF_HEADER } from '../api-config';
import { AuthSession } from './auth-session';

/** Endpoints that authenticate with the refresh cookie rather than the bearer token. */
const COOKIE_ENDPOINTS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout'];

/**
 * Functional interceptor (the Angular equivalent of a NestJS interceptor, but on the client):
 * 1. Adds the bearer token to API calls.
 * 2. Adds the CSRF header to cookie-authenticated auth endpoints.
 * 3. On 401, refreshes the session once and retries the original request.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(AuthSession);
  const apiPrefix = `${inject(API_BASE_URL)}/api/`;

  if (!request.url.startsWith(apiPrefix)) {
    return next(request);
  }

  const usesCookie = COOKIE_ENDPOINTS.some((endpoint) => request.url.endsWith(endpoint));
  if (usesCookie) {
    return next(request.clone({ setHeaders: { [CSRF_HEADER]: 'web' }, withCredentials: true }));
  }

  const token = session.getAccessToken();
  return next(withBearer(request, token)).pipe(
    catchError((error: unknown) => {
      const expired = error instanceof HttpErrorResponse && error.status === 401 && token !== null;
      if (!expired) {
        return throwError(() => error);
      }

      return session.refresh().pipe(
        switchMap((newToken) => (newToken ? next(withBearer(request, newToken)) : throwError(() => error))),
      );
    }),
  );
};

function withBearer(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
}
