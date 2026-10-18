import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthResponse, User } from '../models';
import { AuthSession } from './auth-session';

const admin: User = { id: 'a1', email: 'admin@shop.local', fullName: 'Admin', role: 'Admin' };
const auth: AuthResponse = { accessToken: 'secret-token', accessTokenExpiresAt: '2030-01-01T00:00:00Z', user: admin };

describe('AuthSession', () => {
  let session: AuthSession;
  let backend: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    session = TestBed.inject(AuthSession);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('keeps the access token in memory only - never in web storage', () => {
    session.login(admin.email, 'pw').subscribe();
    backend.expectOne('/api/auth/login').flush(auth);

    expect(session.getAccessToken()).toBe('secret-token');
    expect(session.isAdmin()).toBe(true);
    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    expect(stored).not.toContain('secret-token');
  });

  it('skips the start-up refresh for visitors who never signed in', () => {
    let restored: User | null | undefined;
    session.restore().subscribe((user) => (restored = user));
    backend.expectNone('/api/auth/refresh');
    expect(restored).toBeNull();
  });

  it('restores the session through the refresh cookie after a reload', () => {
    localStorage.setItem('shop.session', '1');
    let restored: User | null | undefined;
    session.restore().subscribe((user) => (restored = user));
    backend.expectOne('/api/auth/refresh').flush(auth);
    expect(restored).toEqual(admin);
  });

  it('emits identity changes once per distinct user', () => {
    const ids: (string | null)[] = [];
    session.userIdChanges$.subscribe((id) => ids.push(id));

    session.login(admin.email, 'pw').subscribe();
    backend.expectOne('/api/auth/login').flush(auth);
    session.updateProfile('Renamed').subscribe();
    backend.expectOne('/api/auth/me').flush({ ...admin, fullName: 'Renamed' });
    session.logout().subscribe();
    backend.expectOne('/api/auth/logout').flush(null);

    expect(ids).toEqual([null, 'a1', null]);
  });

  it('clears local state on logout even if the server call fails', () => {
    session.login(admin.email, 'pw').subscribe();
    backend.expectOne('/api/auth/login').flush(auth);

    session.logout().subscribe();
    backend.expectOne('/api/auth/logout').error(new ProgressEvent('network'));

    expect(session.isAuthenticated()).toBe(false);
    expect(session.getAccessToken()).toBeNull();
    expect(localStorage.getItem('shop.session')).toBeNull();
  });
});
