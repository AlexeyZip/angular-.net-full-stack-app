import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthResponse, User } from '../models';
import { authInterceptor } from './auth.interceptor';
import { AuthSession } from './auth-session';

const user: User = { id: 'u1', email: 'a@shop.local', fullName: 'A', role: 'Customer' };
const auth = (token: string): AuthResponse => ({ accessToken: token, accessTokenExpiresAt: '2030-01-01T00:00:00Z', user });

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let session: AuthSession;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(AuthSession);
  });

  afterEach(() => backend.verify());

  const signIn = (token = 'token-1'): void => {
    session.login(user.email, 'pw').subscribe();
    backend.expectOne('/api/auth/login').flush(auth(token));
  };

  it('sends the CSRF header and credentials only to the cookie-based auth endpoints', () => {
    session.login(user.email, 'pw').subscribe();
    const login = backend.expectOne('/api/auth/login');
    expect(login.request.headers.get('X-Shop-Client')).toBe('web');
    expect(login.request.withCredentials).toBe(true);
    expect(login.request.headers.has('Authorization')).toBe(false);
    login.flush(auth('token-1'));

    http.get('/api/orders').subscribe();
    const orders = backend.expectOne('/api/orders');
    expect(orders.request.headers.get('Authorization')).toBe('Bearer token-1');
    expect(orders.request.withCredentials).toBe(false);
    expect(orders.request.headers.has('X-Shop-Client')).toBe(false);
    orders.flush([]);
  });

  it('never attaches the token to non-API URLs', () => {
    signIn();
    http.get('https://cdn.example.com/image.png').subscribe();
    expect(backend.expectOne('https://cdn.example.com/image.png').request.headers.has('Authorization')).toBe(false);
  });

  it('refreshes once and retries the request after a 401', () => {
    signIn('expired');
    let result: unknown;
    http.get('/api/orders').subscribe((value) => (result = value));

    backend.expectOne('/api/orders').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/auth/refresh').flush(auth('fresh'));
    const retry = backend.expectOne('/api/orders');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer fresh');
    retry.flush(['ok']);

    expect(result).toEqual(['ok']);
  });

  it('shares one refresh between concurrent 401s (the server rotates the refresh token)', () => {
    signIn('expired');
    http.get('/api/orders').subscribe();
    http.get('/api/wishlist').subscribe();

    backend.expectOne('/api/orders').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/wishlist').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/auth/refresh').flush(auth('fresh')); // expectOne: exactly one refresh

    backend.expectOne('/api/orders').flush([]);
    backend.expectOne('/api/wishlist').flush([]);
  });

  it('signs the user out when the refresh fails, and surfaces the original 401', () => {
    signIn('expired');
    let status: number | undefined;
    http.get('/api/orders').subscribe({ error: (e: { status: number }) => (status = e.status) });

    backend.expectOne('/api/orders').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/auth/refresh').flush({ code: 'refresh_token_invalid' }, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
    expect(session.isAuthenticated()).toBe(false);
    expect(session.getAccessToken()).toBeNull();
  });

  it('does not try to refresh for anonymous requests', () => {
    let status: number | undefined;
    http.get('/api/orders').subscribe({ error: (e: { status: number }) => (status = e.status) });
    backend.expectOne('/api/orders').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(status).toBe(401);
  });
});
