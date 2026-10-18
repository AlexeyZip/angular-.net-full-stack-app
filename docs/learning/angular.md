# Angular

Angular ~21 with standalone components, zoneless change detection, `OnPush`, signals, new control flow (`@if`,
`@for`, `@defer`), functional guards/interceptors and lazy routes. Nx manages the workspace (`apps/web`,
`libs/shared/*`, `libs/state/*`).

## Topics

### Standalone components and `OnPush`
- **Problem:** NgModules added indirection; default change detection checks everything.
- **In this repo:** every component is standalone with `changeDetection: ChangeDetectionStrategy.OnPush`
  (e.g. `libs/shared/ui/src/lib/pagination.ts`).
- **Mistake:** mutating an input object in OnPush components — the view does not refresh.

### Zoneless change detection
- **In this repo:** `apps/web/src/app/app.config.ts` (comment explains it); no `zone.js` polyfill. Updates are
  driven by signals, template events and the `async` pipe.
- **Mistake:** relying on `setTimeout`/third-party callbacks to update the view without writing a signal.

### Dependency injection and contracts
- `inject()` function everywhere; abstract-class contracts as tokens (`CatalogStore`, `CartStore`), bound with
  `{ provide: CartStore, useExisting: SignalsCartStore }`; `InjectionToken` with factory for config
  (`CART_QUOTE_DEBOUNCE_MS`, `API_BASE_URL`). See [05](../engineering-decisions/05-angular-dependency-injection-and-facades.md).
- **Interview:** *Why `useExisting` instead of `useClass`?* — `useClass` would create a **second** instance if the
  concrete class is also injected; `useExisting` aliases the same singleton.

### Routing
- All pages lazy (`loadComponent`); the admin area is a separate chunk behind `canMatch: [adminGuard]`
  (`app.routes.ts`) — non-admins never download it. `withComponentInputBinding()` binds route params to `input()`s.
- Guards are functions (`authGuard`, `guestOnlyGuard`, `adminGuard`) returning `UrlTree` redirects;
  `safeReturnUrl` blocks open redirects (`validators.ts`).
- **Interview:** *canActivate vs canMatch?* — `canMatch` decides whether the route matches at all, so the lazy
  chunk is not loaded; `canActivate` runs after matching.

### Templates: control flow and `@defer`
- `@for (... ; track item.id)` with mandatory tracking; `@if ... as`; `@defer (on viewport)` for reviews in
  `product-page.ts` with a `@placeholder`.
- **Mistake:** `track $index` for reorderable lists — DOM nodes get reused for the wrong items.

### Forms
- Typed reactive forms with `NonNullableFormBuilder` (checkout, register, product edit), validators aligned with the
  backend (password ≥ 8, name ≤ 150), errors linked via `aria-describedby` (`#recipient-error`).
- **Mistake:** trusting client validation — the API validates again (DataAnnotations + domain rules).

### HTTP
- `provideHttpClient(withInterceptors([authInterceptor]))`; typed API clients in `libs/shared/data-access`;
  errors normalised by `toApiError`. Dev proxy `apps/web/proxy.conf.json` keeps one origin.

### Accessibility and UI states
- Shared `loading/empty/error` components (`libs/shared/ui/src/lib/states.ts`), native `<dialog>` in
  `confirm-dialog.ts`, labels for every input, focus styles; E2E selects by role/label, which doubles as an a11y check.

### Build and bundles
- Production builds with budgets; two configurations (`production`, `production-ngrx`) via `fileReplacements`
  ([ADR-0003](../adr/0003-dual-signals-and-ngrx-implementations.md)). `inlineCritical: false` because the CSP forbids
  the inline `onload` handler that critical-CSS inlining uses.

## Testing
Vitest + Angular TestBed (`apps/web/src/app/**/*.spec.ts`, `libs/**/*.spec.ts`); `HttpTestingController`; component
tests via `fixture.nativeElement` queries; E2E with Playwright (`apps/web-e2e`).

## Interview questions
1. **What does OnPush change?** — The component is checked only when an input reference changes, an event fires in it,
   or a signal it reads changes.
2. **How do you prevent memory leaks?** — `takeUntilDestroyed`, `toSignal`, `async` pipe; avoid manual subscriptions
   in components.
3. **Why lazy loading?** — Smaller initial bundle, faster first paint; also a security-by-obscurity bonus for admin
   code (but authorization is always on the server).
4. **Where do you put HTTP calls?** — In injectable API services, consumed by stores/pages, never directly in templates.

## Official documentation
- https://angular.dev/guide/components
- https://angular.dev/guide/di
- https://angular.dev/guide/routing
- https://angular.dev/guide/templates/defer
- https://angular.dev/guide/forms/typed-forms
- https://angular.dev/guide/http/interceptors
- https://angular.dev/best-practices/security
