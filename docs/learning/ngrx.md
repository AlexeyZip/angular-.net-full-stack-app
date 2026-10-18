# NgRx (classic Store)

**Problem it solves:** predictable, inspectable global state with a strict unidirectional flow
(*action → reducer → new state → selectors*, side effects in *effects*). Every change is an explicit, logged event.

**Useful when:** many features/teams touch the same state, you want time-travel debugging and an audit-like event
log, or complex async flows reacting to the same events. **Unnecessary when:** state is local to a page or small —
which is why this repo uses it only for the NgRx variant of catalog/cart/wishlist (build `production-ngrx`).

## Building blocks in this repo (`libs/state/ngrx/src/lib`)

| Concept | File | Notes |
| --- | --- | --- |
| Action groups | `cart/cart.actions.ts` | `createActionGroup` with sources (`Cart`, `Cart API`, `Cart Session`) |
| Feature + reducer | `cart/cart.feature.ts` | `createFeature`, `createReducer`, `on`, `extraSelectors` |
| Entity adapter | `cart/cart.feature.ts` | lines normalised by `productId` (`setAll`, `updateOne`, `removeOne`) |
| Memoised selectors | `cart/cart.feature.ts` | `createSelector` for counts, subtotal, `canCheckout` |
| Functional effects | `cart/cart.effects.ts` | quote (`switchMap`+`timer`), persistence (`dispatch: false`), identity (`scan`) |
| Load-once effect | `catalog/catalog.effects.ts` | `exhaustMap` for categories |
| Facade | `cart/ngrx-cart.store.ts` | implements the `CartStore` contract with `store.selectSignal` + `dispatch` |
| Registration | `provide-ngrx-state.ts` | `provideStore`, `provideEffects`, `provideStoreDevtools({ maxAge: 50, logOnly: !isDevMode() })` |

## Minimal example
```ts
const add = createAction('[Cart] Item Added', props<{ id: number }>());
const reducer = createReducer({ ids: [] as number[] }, on(add, (s, { id }) => ({ ids: [...s.ids, id] })));
// pure function: same state + action ⇒ same new state, no side effects
```

## The production implementation
```ts
// cart.feature.ts — derived values are memoised selectors, the NgRx equivalent of computed()
extraSelectors: ({ selectCartState, selectQuote, selectQuoteStatus }) => {
  const selectLines = createSelector(selectCartState, cartAdapter.getSelectors().selectAll);
  const selectIsEmpty = createSelector(selectLines, (lines) => lines.length === 0);
  return {
    selectLines,
    selectIsEmpty,
    selectCanCheckout: createSelector(selectIsEmpty, selectQuoteStatus, selectQuote,
      (empty, status, quote) => !empty && status === 'success' && quote?.canCheckout === true),
  };
},
```
```ts
// cart.effects.ts — non-dispatching effect for a side effect
export const persistCart = createEffect(
  (actions$ = inject(Actions), store = inject(Store), persistence = inject(CartPersistence)) =>
    actions$.pipe(
      ofType(...lineChanges),
      concatLatestFrom(() => [store.select(cartFeature.selectUserId), store.select(cartFeature.selectLines)]),
      tap(([, userId, lines]) => persistence.write(userId, lines)),
    ),
  { functional: true, dispatch: false },
);
```
Components never see NgRx: they inject the `CartStore` contract; the facade translates method calls into actions and
selectors into signals.

## Common mistakes
- Side effects or `Date.now()`/random in reducers — reducers must be pure.
- Storing non-serialisable values (`HttpErrorResponse`, class instances) — store `ApiError` plain objects instead
  (`api-error.ts`), as done here.
- One giant "SET_STATE" action — loses the event log value; name actions by *what happened* (`[Cart] Item Added`).
- Effects that catch errors on the outer stream — the effect dies after the first error.
- Putting tokens or passwords into the store (visible in DevTools) — forbidden here; tokens stay in `AuthSession`.

## Alternatives / trade-offs
Signals services ([signals.md](signals.md)) — less code, no DevTools time travel. NgRx SignalStore — signal-based with
NgRx structure. Classic NgRx cost: actions/reducers/effects/selectors per feature (571 vs 329 lines of non-test
TypeScript in `libs/state/ngrx/src/lib` vs `libs/state/signals/src/lib`, counted with blank lines) and +44 kB raw
initial bundle (measured: 440.09 kB vs 396.05 kB, see decision 04).

## Testing
- Reducers: pure functions — `cart.feature.spec.ts`.
- Facade + effects: the shared contract suite runs against the real store (no `provideMockStore`) with
  `HttpTestingController` — `ngrx-state.contract.spec.ts` is one line: `runStateContractSuite('ngrx', provideNgrxState)`
  — so both variants are held to the same behavioural tests.

## Debugging
Redux DevTools browser extension (full features in dev builds; production builds register DevTools in log-only
mode): inspect actions, diff state, time travel. If a selector
does not update, check the reducer returns a new reference.

## Interview questions
1. **Why actions instead of calling methods?** — Decoupling (many reducers/effects can react), traceability, replay.
2. **What belongs in an effect?** — Anything impure: HTTP, storage, navigation, timers; effects map results back to
   actions.
3. **How are selectors memoised?** — `createSelector` caches the last inputs/result; recomputes only when an input
   selector returns a new reference.
4. **Entity adapter — why?** — Normalised `{ ids, entities }` with O(1) updates by id and tested immutable helpers.
5. **When would you not use NgRx?** — Local UI state, small apps, server-cache-only data (use a query/cache library).

## Official documentation
- https://ngrx.io/guide/store
- https://ngrx.io/guide/effects
- https://ngrx.io/guide/entity
- https://ngrx.io/guide/store/selectors
- https://ngrx.io/guide/store-devtools
