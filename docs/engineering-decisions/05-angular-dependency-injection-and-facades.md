# 05 — Angular dependency injection and facades

## 1. Problem
Pages need catalog/cart/wishlist state without depending on how it is implemented, so two implementations can be
swapped and tested against one specification.

## 2. Context
Angular DI resolves tokens at runtime; TypeScript interfaces are erased at compile time.

## 3. Options
`InjectionToken<Interface>`; **abstract classes as tokens**; injecting concrete services directly; NgRx `Store`
directly in components.

## 4. Chosen approach
`abstract class CartStore` etc. in `libs/state/contracts` serve as both the type and the DI token. Each variant
provides its implementation with `useExisting`:

```ts
// libs/state/ngrx/src/lib/provide-ngrx-state.ts
NgrxCartStore,
{ provide: CartStore, useExisting: NgrxCartStore },
```

The NgRx implementation is a **facade**: it hides `Store`, actions and selectors behind the contract
(`ngrx-cart.store.ts` exposes `store.selectSignal(...)` and dispatches actions). Configuration values are
`InjectionToken`s with factories (`CART_QUOTE_DEBOUNCE_MS`, `API_BASE_URL`), so tests override them.

## 5. Why
Abstract classes survive compilation and need no separate token constant; components write
`inject(CartStore)` and get full typing. `useExisting` keeps one instance reachable under both tokens.

## 6. Trade-offs
An extra layer of indirection; NgRx DevTools still shows the real actions, but code navigation goes through the facade.

## 7. Simpler alternative
Inject `SignalsCartStore` directly — simplest, but then a second variant means changing every component.

## 8. Rejected
Components using `Store` directly (couples UI to NgRx, makes swapping impossible).

## 9. References
`libs/state/contracts/src/lib/state-contracts.ts`, `libs/state/*/src/lib/provide-*-state.ts`,
`apps/web/src/app/state/state.providers*.ts`, `libs/shared/data-access/src/lib/api-config.ts`.

## 10. Code — functional DI everywhere
```ts
export const authGuard: CanActivateFn = (_route, state) => {
  const session = inject(AuthSession);
  return session.isAuthenticated() ? true : inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
```

## 11. Failure scenarios
Forgetting to provide an implementation → `NullInjectorError` at the first `inject` (the app spec catches this).

## 12. Testing
The contract suite injects only the abstract classes; providers are swapped per run.

## 13. Performance
`providedIn: 'root'` services are tree-shakable; the unused state variant is not compiled at all (fileReplacements).

## 14. When different
For a single implementation with no plan to swap, skip the abstract layer and inject the service.

## 15. Interview explanation
"Abstract classes are the DI tokens for state contracts; each variant registers its class with `useExisting`. The NgRx
store is wrapped in a facade, so components never see actions or selectors and the two variants are interchangeable."

## 16. Evidence
Verified by builds of both variants and the contract suite.
