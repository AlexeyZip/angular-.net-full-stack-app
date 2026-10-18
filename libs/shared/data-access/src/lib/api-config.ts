import { InjectionToken } from '@angular/core';

/**
 * Base URL prepended to every API call. Empty by default: the SPA and API share an origin
 * (Angular dev-server proxy locally, nginx in Docker), which avoids CORS and keeps SameSite cookies simple.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', { providedIn: 'root', factory: () => '' });

/** Header the API requires on cookie-authenticated auth endpoints (CSRF defence). */
export const CSRF_HEADER = 'X-Shop-Client';
