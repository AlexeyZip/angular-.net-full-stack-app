---
name: state-feature
description: Adds or changes shared Angular application state in both the Signals and the classic NgRx implementations behind one contract, with the shared contract test suite. Use when a feature needs global/shared state, when modifying CatalogStore, CartStore or WishlistStore, or when the user mentions Signals, NgRx, store, effects, reducers or selectors.
---

# State feature in both variants

First decide whether it is shared state at all. Component-local async data uses `toSignal` + `loadable()` inside
the component; only cross-page state (catalog, cart, wishlist, …) belongs in `libs/state`.

## Steps

1. **Contract** (`libs/state/contracts/src/lib/state-contracts.ts`): add abstract `Signal<T>` reads and command
   methods. Put any non-trivial rule in a pure exported helper so both variants share it.
2. **Contract test first** (`libs/state/contracts/src/testing/state-contract-suite.ts`): describe the behaviour
   through the contract only (HTTP via `HttpTestingController`, `settle()` for async). Include races/failures.
3. **Signals** (`libs/state/signals/src/lib/signals-*.store.ts`): private `signal<State>`, `computed` reads, methods
   update immutably; RxJS `Subject` + `switchMap` for request orchestration; `takeUntilDestroyed()`.
4. **NgRx** (`libs/state/ngrx/src/lib/<feature>/`):
   - `*.actions.ts`: `createActionGroup` (`source: 'Cart'`, events named as facts: `'Quote Loaded'`);
   - `*.feature.ts`: `createFeature` with pure `createReducer` handlers, `@ngrx/entity` adapter for collections,
     `extraSelectors` for derived data;
   - `*.effects.ts`: functional `createEffect(() => ..., { functional: true })`, `concatLatestFrom` for state,
     the same flattening operator as the Signals variant (`switchMap`/`exhaustMap`/`concatMap`);
   - `ngrx-*.store.ts`: facade extending the contract, reads via `store.selectSignal`, commands dispatch;
   - register in `provide-ngrx-state.ts`; add reducer/selector unit tests in `*.feature.spec.ts`.
5. **Verify both variants:**
   ```powershell
   npx nx run-many -t test -p state-contracts state-signals state-ngrx
   npx nx run-many -t lint
   npx nx run web:build:production; npx nx run web:build:production-ngrx
   ```
6. Update `docs/engineering-decisions/04-signals-vs-rxjs-vs-ngrx.md` if the comparison changes.

## Pitfalls seen in this repo

- Debounce with `debounceTime` does not cancel an in-flight request; use `switchMap(() => timer(ms).pipe(...))`.
- Rollback of optimistic updates must restore only the failed item.
- Never put tokens or personal data in state; identity changes arrive via `AuthSession.userIdChanges$`.
