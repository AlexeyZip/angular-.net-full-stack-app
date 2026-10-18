# Angular Signals

**Problem it solves:** synchronous, fine-grained reactive state. Angular knows exactly which views read which signal,
so change detection can be targeted (the app is zoneless — no zone.js).

**Useful when:** state is read synchronously by templates and derived values (`computed`). **Not the right tool
when:** you need time-based composition (debounce, cancellation) — that is RxJS; interop via `toSignal`/`toObservable`.

## Primitives and where they are used

| API | Purpose | In this repo |
| --- | --- | --- |
| `signal()` | writable state | private `state` in every Signals store; local UI state in pages |
| `computed()` | memoised derived value | `itemCount`, `canCheckout`, `isAdmin`, wishlist `ids` (Set) |
| `effect()` | side effects only | `signals-cart.store.ts` mirrors the cart into `localStorage`; `confirm-dialog.ts` opens `<dialog>` |
| `linkedSignal()` | writable state reset by a source | `product-page.ts`: quantity resets to 1 when the product changes |
| `input()` / `input.required()` / `output()` / `model()` | component API | `libs/shared/ui/**`, `product-card.ts`, `confirm-dialog.ts` |
| `viewChild.required()` | element query as a signal | `confirm-dialog.ts` |
| `toSignal()` / `toObservable()` | RxJS interop | admin pages (`loadable` + `switchMap`), `product-reviews.ts` |
| `asReadonly()` | expose without write access | `AuthSession.user` |

## Minimal example

```ts
const lines = signal([{ id: 1, qty: 2 }]);
const count = computed(() => lines().reduce((n, l) => n + l.qty, 0)); // recomputed only when lines changes
lines.update((ls) => [...ls, { id: 2, qty: 1 }]);                       // immutable update → new reference
console.log(count()); // 3
```

## The production implementation (store pattern)

```ts
// libs/state/signals/src/lib/signals-cart.store.ts (abridged)
private readonly state = signal<CartState>({ lines: [], quote: null, quoteStatus: 'idle', quoteError: null });
readonly lines = computed(() => this.state().lines);
readonly canCheckout = computed(() => !this.isEmpty() && this.quoteStatus() === 'success' && this.quote()?.canCheckout === true);
// A genuine side effect - mirroring state into localStorage - which is what effect() is for.
effect(() => this.persistence.write(this.userId, this.lines()));
```
One private writable signal, public **read-only** `computed` slices, intent methods (`add`, `remove`) as the only
writers. Async work stays in RxJS pipelines that `update()` the signal.

`linkedSignal` instead of an `effect` that resets state:
```ts
// apps/web/src/app/features/product/product-page.ts
protected readonly quantity = linkedSignal({ source: () => this.product()?.id, computation: () => 1 });
```

Reactive method used from templates:
```ts
// signals-wishlist.store.ts — reading ids() inside makes has() reactive in templates and computed()
has(productId: number): boolean { return this.ids().has(productId); }
```

## Common mistakes
- Using `effect()` to **derive** state (`effect(() => this.total.set(...))`) — use `computed`; effects run later and
  can loop.
- Mutating arrays/objects inside a signal (`lines().push(x)`) — same reference, no notification.
- Reading signals in callbacks/`setTimeout` and expecting reactivity — only reads inside a reactive context are
  tracked.
- Exposing `WritableSignal` publicly — anyone can bypass invariants.
- Using signals for event streams (debounce, cancellation) — use RxJS.

## Alternatives / trade-offs
NgRx Store (explicit actions, DevTools, more ceremony) — see [ngrx.md](ngrx.md); NgRx SignalStore (not used here, to
keep the comparison "plain Angular vs classic NgRx").

## Testing
Signals are synchronous: call a method, read the signal. `TestBed.tick()` flushes effects. The same contract suite
runs for both variants: `libs/state/signals/src/lib/signals-state.contract.spec.ts`.

## Debugging
Angular DevTools shows the signal graph; log inside `computed` temporarily to see recomputations; if a view does not
update, check for mutation instead of a new reference.

## Interview questions
1. **computed vs effect?** — `computed` is a pure, lazy, memoised derivation; `effect` performs side effects (DOM,
   storage, logging) after changes.
2. **How does zoneless change detection know what to update?** — Signals read in templates mark the view dirty when
   they change; events and `async` pipe also schedule detection; no zone.js patching.
3. **When toSignal?** — To consume an observable in a template without manual subscriptions; provide
   `initialValue` (or `requireSync`) to avoid `undefined`.
4. **Why `linkedSignal`?** — Local writable state that must reset when an input changes, without an effect.
5. **Signals vs BehaviorSubject?** — Signals: synchronous, glitch-free derived values, no subscriptions; Subjects:
   time/streams, operators, multiple emissions semantics.

## Official documentation
- https://angular.dev/guide/signals
- https://angular.dev/guide/signals/linked-signal
- https://angular.dev/guide/signals/effect
- https://angular.dev/guide/zoneless
- https://angular.dev/ecosystem/rxjs-interop
