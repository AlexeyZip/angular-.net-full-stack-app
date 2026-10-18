import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { AuthSession, authInterceptor } from '@shop/shared/data-access';
import { firstValueFrom } from 'rxjs';
import { appRoutes } from './app.routes';
import { provideAppState } from './state/state.providers';

// Zoneless change detection is the default in Angular 21: rendering is driven by signals,
// template events and the async pipe - not by zone.js patching every browser API.
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideAppState(),
    // Restore the session (refresh cookie -> access token) before the first navigation, so guards
    // see the real authentication state on a page reload.
    provideAppInitializer(() => firstValueFrom(inject(AuthSession).restore())),
  ],
};
