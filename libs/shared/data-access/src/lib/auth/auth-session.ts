import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { BehaviorSubject, catchError, distinctUntilChanged, finalize, map, Observable, of, shareReplay, tap } from 'rxjs';
import { API_BASE_URL } from '../api-config';
import { AuthResponse, User } from '../models';

/**
 * Owns the authenticated session.
 *
 * Security model (see docs/engineering-decisions/11-authentication-and-authorization.md):
 * - The short-lived access token lives ONLY in this private field (memory). It is never put into
 *   NgRx/Signals stores, localStorage or sessionStorage, so it is not persisted and not visible in DevTools state.
 * - The long-lived refresh token is an HttpOnly cookie the browser manages; JavaScript cannot read it.
 * - After a page reload the session is restored by calling /api/auth/refresh (see provideAppInitializer).
 */
@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/api/auth`;

  private accessToken: string | null = null;
  private refreshInFlight: Observable<string | null> | null = null;

  private readonly currentUser = signal<User | null>(null);
  private readonly userSubject = new BehaviorSubject<User | null>(null);

  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly isAdmin = computed(() => this.currentUser()?.role === 'Admin');

  /**
   * Emits synchronously whenever the signed-in identity changes (login, logout, session expiry).
   * State stores subscribe to it to load or reset user-specific state.
   */
  readonly userIdChanges$: Observable<string | null> = this.userSubject.pipe(
    map((user) => user?.id ?? null),
    distinctUntilChanged(),
  );

  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Runs once at start-up. A non-sensitive marker in localStorage records that a session may exist,
   * so first-time visitors do not trigger a pointless (401) refresh request on every page load.
   */
  restore(): Observable<User | null> {
    if (!hasSessionMarker()) {
      return of(null);
    }

    return this.refresh().pipe(map(() => this.currentUser()));
  }

  login(email: string, password: string): Observable<User> {
    return this.http.post<AuthResponse>(`${this.base}/login`, { email, password }).pipe(map((response) => this.apply(response)));
  }

  register(email: string, password: string, fullName: string): Observable<User> {
    return this.http.post<AuthResponse>(`${this.base}/register`, { email, password, fullName }).pipe(map((response) => this.apply(response)));
  }

  /** Revokes the refresh token server-side; local state is cleared even if the request fails. */
  logout(): Observable<void> {
    return this.http.post<void>(`${this.base}/logout`, null).pipe(
      catchError(() => of(undefined)),
      finalize(() => this.clear()),
    );
  }

  /**
   * Exchanges the refresh cookie for a new access token. Concurrent callers (e.g. several requests that
   * all got 401) share ONE request, because the server rotates the token and a second parallel refresh
   * with the old cookie would be rejected.
   */
  refresh(): Observable<string | null> {
    this.refreshInFlight ??= this.http.post<AuthResponse>(`${this.base}/refresh`, null).pipe(
      map((response) => {
        this.apply(response);
        return response.accessToken;
      }),
      catchError(() => {
        this.clear();
        return of(null);
      }),
      finalize(() => (this.refreshInFlight = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshInFlight;
  }

  updateProfile(fullName: string): Observable<User> {
    return this.http.put<User>(`${this.base}/me`, { fullName }).pipe(tap((user) => this.setUser(user)));
  }

  /** Called when the server says the session is no longer valid. */
  clear(): void {
    this.accessToken = null;
    this.setUser(null);
  }

  private apply(response: AuthResponse): User {
    this.accessToken = response.accessToken;
    this.setUser(response.user);
    return response.user;
  }

  private setUser(user: User | null): void {
    setSessionMarker(user !== null);
    this.currentUser.set(user);
    this.userSubject.next(user);
  }
}

const SESSION_MARKER = 'shop.session';

function hasSessionMarker(): boolean {
  try {
    return localStorage.getItem(SESSION_MARKER) === '1';
  } catch {
    return true; // storage unavailable: just try the refresh
  }
}

function setSessionMarker(present: boolean): void {
  try {
    if (present) {
      localStorage.setItem(SESSION_MARKER, '1');
    } else {
      localStorage.removeItem(SESSION_MARKER);
    }
  } catch {
    // ignore
  }
}
