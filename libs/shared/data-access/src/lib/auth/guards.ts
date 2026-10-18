import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { AuthSession } from './auth-session';

/**
 * Route guards improve UX only. They are NOT a security boundary: every protected endpoint is
 * authorized again by the API ([Authorize] / AdminOnly policy).
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const session = inject(AuthSession);
  return session.isAuthenticated() ? true : inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const adminGuard: CanMatchFn = (_route, segments) => {
  const session = inject(AuthSession);
  const router = inject(Router);
  if (session.isAdmin()) {
    return true;
  }

  return session.isAuthenticated()
    ? router.createUrlTree(['/'])
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: '/' + segments.map((s) => s.path).join('/') } });
};

export const guestOnlyGuard: CanActivateFn = () => (inject(AuthSession).isAuthenticated() ? inject(Router).createUrlTree(['/']) : true);
