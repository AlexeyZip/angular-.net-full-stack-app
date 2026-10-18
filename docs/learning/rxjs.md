# RxJS

**Problem it solves:** composing *events over time* — user input, HTTP responses, timers, identity changes — with
cancellation, retries and ordering guarantees.

**Useful when:** something can happen many times, can be cancelled, or must be combined with other async sources.
**Unnecessary when:** you only need a synchronous derived value (use `computed()`), or a single request whose result
is shown once (a plain subscription / `toSignal` is enough).

## Operators used in this repository

| Operator | Meaning | In this repo |
| --- | --- | --- |
| `switchMap` | new value cancels the previous inner observable | quote pipeline, catalog search, reviews, wishlist load |
| `exhaustMap` | ignore new values while busy | NgRx `catalog.effects.ts` — categories loaded once |
| `debounceTime` | wait for a pause | admin search boxes, catalog filter panel |
| `timer` inside `switchMap` | debounce **and** cancel in-flight | `signals-cart.store.ts`, `cart.effects.ts` |
| `distinctUntilChanged` | drop repeats | `AuthSession.userIdChanges$`, brand requests |
| `shareReplay` | share one execution among subscribers | `AuthSession.refresh()` single in-flight refresh |
| `catchError` | turn errors into values | every store: errors become `ApiError` state |
| `combineLatest` | latest of several sources | `product-reviews.ts` (product id + page + reload) |
| `scan` | accumulate state over a stream | NgRx `restoreCartOnIdentityChange` (previous user id) |
| `takeUntilDestroyed` | unsubscribe with the injector | all store constructors |

## Minimal example — why `switchMap` + `timer`

```ts
import { Subject, switchMap, timer, map } from 'rxjs';
const changes = new Subject<number>();
changes.pipe(switchMap((n) => timer(250).pipe(map(() => `quote for ${n}`)))).subscribe(console.log);
changes.next(1); changes.next(2); changes.next(3); // prints only "quote for 3"
```
`debounceTime(250)` followed by `switchMap(http)` would leave the request for an older cart running while the user
keeps clicking; with `timer` *inside* `switchMap`, each change cancels both the pending timer and the in-flight HTTP
request.

## The production implementation

```ts
// libs/state/signals/src/lib/signals-cart.store.ts
this.quoteRequests.pipe(
  switchMap((lines) =>
    lines.length === 0
      ? EMPTY                                 // emptying the cart cancels a pending quote
      : timer(debounce).pipe(
          switchMap(() => this.api.quote(lines.map(({ productId, quantity }) => ({ productId, quantity })))),
          map((quote) => ({ quote, error: null })),
          catchError((error: unknown) => of({ quote: null, error: toApiError(error) })), // inner catch: stream survives
        ),
  ),
  takeUntilDestroyed(),
)
```

The single shared refresh (`auth-session.ts`):
```ts
this.refreshInFlight ??= this.http.post<AuthResponse>(`${this.base}/refresh`, null).pipe(
  map((response) => { this.apply(response); return response.accessToken; }),
  catchError(() => { this.clear(); return of(null); }),
  finalize(() => (this.refreshInFlight = null)),
  shareReplay({ bufferSize: 1, refCount: false }),
);
```
Five requests that receive 401 at once all wait for the same refresh; a second parallel refresh would present an
already-rotated cookie and trigger reuse detection (revoking the session).

## Common mistakes
- `catchError` on the **outer** stream: the first error completes the pipeline forever. Catch inside the inner
  observable (as above).
- Nested `subscribe` instead of flattening operators — loses cancellation.
- `mergeMap` for "latest wins" scenarios — responses arrive out of order (race conditions).
- Forgetting to unsubscribe from long-lived streams in services/components (`takeUntilDestroyed`).
- `shareReplay` with `refCount: false` on an infinite stream — keeps it alive forever; fine here because HTTP
  completes.

## Alternatives and trade-offs
Signals for synchronous state; `async/await` for one-shot calls (no cancellation); NgRx effects are RxJS with a
dispatch contract. RxJS is powerful but has a learning curve — this project keeps streams inside stores and exposes
signals to components.

## Testing
- Vitest with `vi.useFakeTimers()` or debounce injected as `0` (`CART_QUOTE_DEBOUNCE_MS`), `HttpTestingController`
  to control responses: see `state-contract-suite.ts` ("never applies a quote for an older cart: emptying the cart
  cancels it"), `auth.interceptor.spec.ts` ("shares one refresh between concurrent 401s").
- Marble tests (`TestScheduler`) are an option for complex timing; not needed here.

## Debugging
`tap(console.log)` at each stage; check the Network tab for **cancelled** requests (expected with `switchMap`); if
nothing happens, check that something subscribes (cold observables).

## Interview questions
1. **switchMap vs mergeMap vs concatMap vs exhaustMap?** — switch: latest wins, cancels previous (search, quotes);
   merge: parallel, unordered (independent saves); concat: queue, ordered (sequential writes); exhaust: ignore while
   busy (submit button, load-once).
2. **Hot vs cold?** — Cold observables start work per subscriber (HTTP); hot ones share a producer (Subject, DOM
   events). `shareReplay` turns cold into shared.
3. **How do you avoid stale responses?** — `switchMap` cancellation, or compare a request id before applying.
4. **Where do errors go?** — An error terminates the stream; handle inside inner observables to keep the outer
   alive, convert to state.
5. **Observable vs Promise?** — Lazy, multiple values, cancellable, operators; Promise: eager, single value, not
   cancellable.

## Official documentation
- https://rxjs.dev/guide/overview
- https://rxjs.dev/api/operators/switchMap
- https://rxjs.dev/api/operators/exhaustMap
- https://rxjs.dev/api/operators/shareReplay
- https://angular.dev/ecosystem/rxjs-interop
