# JavaScript and TypeScript catalog

Each entry: **concept** (Explanation) → **runnable example** (paste into Node 22 or the browser console; TypeScript
examples into the [TS playground](https://www.typescriptlang.org/play)) → **in this repo** → **mistake** →
**interview Q/A**. "In this repo" is omitted when the codebase has no meaningful example.

---

## JavaScript

### Execution context, call stack, scope and lexical environment
Every function call pushes an execution context (variables, `this`, outer reference) onto the call stack. Scope is
**lexical**: a function sees variables of the place where it was *defined*.
```js
const x = 'global';
function outer() { const x = 'outer'; return function inner() { return x; }; }
console.log(outer()()); // 'outer' — inner's outer reference is outer's environment
```
- **Mistake:** assuming scope depends on where a function is *called*.
- **Q:** *What is a lexical environment?* — A record of bindings plus a reference to the enclosing environment;
  lookups walk this chain.

### Closures
A function keeps access to its lexical environment after the outer function returned.
```js
function counter() { let n = 0; return () => ++n; }
const next = counter(); next(); console.log(next()); // 2
```
- **In this repo:** the functional interceptor captures `session` and `apiPrefix` (`auth.interceptor.ts`); NgRx
  functional effects capture injected services via default parameters (`cart.effects.ts`).
- **Mistake:** closures over a loop variable declared with `var` (all callbacks see the last value).
- **Q:** *Practical uses?* — Encapsulation (private state), factories, memoisation, callbacks with context.

### Hoisting, `var`/`let`/`const`, Temporal Dead Zone
Declarations are registered before execution. `var` is function-scoped and initialised to `undefined`; `let`/`const`
are block-scoped and stay uninitialised (TDZ) until their line runs. Function declarations are hoisted with their body.
```js
console.log(a); // undefined
var a = 1;
try { console.log(b); } catch (e) { console.log(e.name); } // ReferenceError (TDZ)
let b = 2;
```
- **In this repo:** there is no `var` in any TypeScript source (checked with `rg "\bvar\s"`); `const` by default.
- **Q:** *Is `const` immutable?* — The **binding** is; the object it points to can still be mutated (see
  immutability).

### `this` and arrow functions
`this` is decided by **how** a regular function is called (method call, `new`, `call/apply/bind`, plain call →
`undefined` in strict mode). Arrow functions have no own `this`; they capture it lexically.
```js
'use strict';
const obj = {
  n: 1,
  regular() { return this?.n; },
  later() { setTimeout(() => console.log('arrow sees', this.n), 0); }, // arrow captures later()'s this
};
const detached = obj.regular;
console.log(obj.regular(), detached()); // 1 undefined — the call site decides `this`
obj.later();                            // arrow sees 1
```
- **In this repo:** class field arrow callbacks in RxJS `subscribe`/`finalize` keep the store's `this`
  (`finalize(() => (this.refreshInFlight = null))` in `auth-session.ts`).
- **Mistake:** passing `this.method` as a callback — `this` is lost.

### Prototypes, prototype chain, classes and inheritance
Objects delegate property lookups to their prototype; `class` is syntax over prototypes.
```js
class Animal { speak() { return 'sound'; } }
class Dog extends Animal { speak() { return 'woof ' + super.speak(); } }
console.log(Object.getPrototypeOf(new Dog()) === Dog.prototype, new Dog().speak());
```
- **In this repo:** `abstract class CartStore` (TypeScript) is a real runtime class — used as an Angular DI token
  because interfaces disappear at compile time (`state-contracts.ts`). Composition is preferred over deep inheritance.
- **Q:** *`__proto__` vs `prototype`?* — `prototype` is a property of constructor functions; an instance's internal
  `[[Prototype]]` (exposed as `__proto__`/`Object.getPrototypeOf`) points to it.

### Event loop, microtasks and macrotasks
The call stack runs to completion; then **all microtasks** (promise callbacks, `queueMicrotask`) run; then one
macrotask (timers, I/O, UI events); rendering happens between macrotasks.
```js
setTimeout(() => console.log('timeout'), 0);
Promise.resolve().then(() => console.log('microtask'));
console.log('sync'); // sync, microtask, timeout
```
- **In this repo:** the cart quote uses `timer(250)` (macrotask); contract tests flush with `await` and injected
  debounce `0`.
- **Q:** *Why can a long `.then` chain freeze the UI?* — Microtasks run before rendering; an endless chain starves
  rendering.

### Promises, async/await, error propagation
`async` functions return promises; `await` unwraps; a rejected promise throws at the `await`. Unhandled rejections
surface globally.
```js
async function load() { throw new Error('boom'); }
load().catch((e) => console.log('caught', e.message));
(async () => { try { await load(); } catch (e) { console.log('also caught'); } })();
```
- **In this repo:** Playwright tests and the support API are `async` (`apps/web-e2e/src/support/api.ts`); Angular
  code uses Observables for cancellation (see [rxjs.md](rxjs.md)).
- **Mistake:** `forEach(async ...)` — does not await; use `for...of` or `Promise.all`.
- **Q:** *`Promise.all` vs `allSettled`?* — `all` rejects on the first failure; `allSettled` waits for every result.

### Equality and coercion
`===` compares without coercion; `==` coerces (`'' == 0` is `true`). `Object.is` distinguishes `NaN` and `-0`.
```js
console.log('' == 0, '' === 0, NaN === NaN, Object.is(NaN, NaN)); // true false false true
```
- **In this repo:** ESLint `eqeqeq`; numeric URL params are parsed explicitly (`catalog-query-params.ts`) instead
  of relying on coercion.

### Immutability, object references, shallow vs deep copy
Objects are passed by reference (the reference is copied). Spread/`Object.assign` copy **one level**;
`structuredClone` copies deeply.
```js
const a = { line: { qty: 1 } }; const b = { ...a }; b.line.qty = 5; console.log(a.line.qty); // 5 (shared)
const c = structuredClone(a); c.line.qty = 9; console.log(a.line.qty); // still 5
```
- **In this repo:** all state updates create new objects (`{ ...state, quote }`, `lines.map(...)`), which is what
  makes `computed`, OnPush and NgRx selectors work; `readonly` types prevent accidental mutation.
- **Q:** *Why immutability in state management?* — Change detection by reference comparison is O(1) and reliable.

### Modules
ES modules (`import`/`export`) are static, strict-mode, evaluated once, enabling tree-shaking.
- **In this repo:** each library has a public API `src/index.ts`; path aliases (`@shop/state/contracts`) in
  `tsconfig.base.json`; lint forbids importing state implementations outside `apps/web/src/app/state`.
- **Q:** *Why does tree-shaking need ESM?* — Imports are statically analysable; unused exports can be dropped (the
  Signals build contains no NgRx code).

### Memory management
Garbage collection frees unreachable objects. Leaks are references kept alive: subscriptions, timers, global caches,
detached DOM nodes.
- **In this repo:** `takeUntilDestroyed()` on long-lived streams; `shareReplay({ refCount: false })` only on HTTP
  (completes).
- **Debugging:** Chrome DevTools → Memory → heap snapshots, compare "Detached" nodes.

### Debouncing and throttling
Debounce: run after a pause. Throttle: at most once per interval.
```js
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const log = debounce((v) => console.log(v), 100); log(1); log(2); log(3); // 3
```
- **In this repo:** `debounceTime(300)` for admin search; `switchMap(timer)` for cart quotes (debounce + cancel).

### Functional programming concepts
Pure functions, immutability, composition, higher-order functions.
- **In this repo:** pure helpers shared by both state variants — `addCartLine`, `clampQuantity`, `estimateSubtotal`,
  `mergeCarts` (`state-contracts.ts`, `cart-persistence.ts`); reducers are pure; RxJS `pipe` is function composition.
- **Q:** *Why are pure functions easier to test?* — Output depends only on input; no setup or mocks.

---

## TypeScript

### Structural typing; interfaces vs type aliases
Compatibility is by shape, not by name. Interfaces can be extended/merged; type aliases can express unions, tuples,
mapped types.
```ts
interface Point { x: number; y: number }
const p = { x: 1, y: 2, label: 'a' }; const q: Point = p; // OK: has at least x and y
type Status = 'idle' | 'loading';                         // only a type alias can name a union
```
- **In this repo:** DTO shapes are interfaces (`libs/shared/data-access/src/lib/models.ts`); unions are types
  (`RequestStatus`, `StateVariant`).

### Unions, intersections, discriminated unions, narrowing, `never`
```ts
type Loadable<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly value: T }
  | { readonly status: 'error'; readonly error: ApiError };

function valueOf<T>(state: Loadable<T>): T | null {
  return state.status === 'success' ? state.value : null; // narrowed: value exists only here
}
function assertNever(x: never): never { throw new Error(`Unexpected ${JSON.stringify(x)}`); } // exhaustiveness
```
- **In this repo:** exactly this in `libs/shared/data-access/src/lib/loadable.ts`; impossible states (value *and*
  error) cannot be represented.
- **Q:** *What does `never` mean?* — A type with no values; reaching it means a case was not handled.

### Generics and utility types
```ts
function first<T>(items: readonly T[]): T | undefined { return items[0]; }
type Patch = Partial<CatalogFilters>;           // used by updateFilters(patch)
type Line = Pick<CartLine, 'productId' | 'quantity'>;
type Ro = Readonly<Record<string, readonly string[]>>; // ApiError.fieldErrors
```
- **In this repo:** `Loadable<T>`, `loadable<T>(source: Observable<T>)`, `Partial<CatalogFilters>` in
  `CatalogStore.updateFilters`, `Readonly<Record<...>>` in `ApiError`, `ReturnType<typeof cartForIdentityChange>` in
  `cart.effects.ts`.

### `unknown` vs `any`, type guards, runtime validation at boundaries
`any` disables checking; `unknown` forces narrowing before use. **Types do not exist at runtime** — data from HTTP,
`localStorage` or URLs must be validated.
```ts
function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null) return false;
  const line = value as Record<string, unknown>;
  return Number.isInteger(line['productId']) && Number.isInteger(line['quantity']) && typeof line['name'] === 'string';
}
```
- **In this repo:** `cart-persistence.ts` (user-editable storage), `api-error.ts` (`const body = typeof error.error
  === 'object' ...` — "the body is untrusted input, whatever the TypeScript types claim"), `catchError((error:
  unknown) => ...)` everywhere.
- **Mistake:** `JSON.parse(raw) as Cart` — an assertion, not a check.
- **Q:** *Compile-time types vs runtime validation?* — Types prove consistency inside the program; at boundaries you
  need runtime checks (guards, schema libraries, server-side validation).

### `void`, `strictNullChecks`, type inference
`void` = "return value is not used"; with `strictNullChecks` `null`/`undefined` must be handled explicitly; inference
fills in types from initialisers.
- **In this repo:** `strict: true` (all strict flags) in `tsconfig.base.json`; `?.` and `??` used instead of
  non-null assertions (`this.quote()?.canCheckout === true`, `this.refreshInFlight ??= ...`).

### Mapped, conditional, template literal types; `keyof` and indexed access
```ts
type Flags<T> = { [K in keyof T]: boolean };                  // mapped
type ElementOf<T> = T extends readonly (infer U)[] ? U : never; // conditional + infer
type ActionType = `[${'Cart' | 'Wishlist'}] ${string}`;        // template literal
type Price = ProductSummary['price'];                          // indexed access
```
- **In this repo:** NgRx `createActionGroup` derives action creators and their `type` strings with template literal
  types (`[Cart] Item Added`); `createFeature` generates `selectX` selectors from state keys with mapped types.

### `as const`, `satisfies`, type assertions
```ts
const sorts = ['Newest', 'PriceAsc'] as const;          // readonly tuple of literals
type Sort = (typeof sorts)[number];                       // 'Newest' | 'PriceAsc'
const cfg = { port: 4200 } satisfies { port: number };    // checked, but keeps the literal type
const el = document.getElementById('x') as HTMLInputElement; // assertion: you take responsibility
```
- **In this repo:** `as const` for literal unions in reducers (`'success' as const` in `cart.feature.ts`) and
  constant lists; `satisfies` is not currently used in code. Assertions are limited to narrowing after a runtime
  check (`value as Partial<PersistedCart>` inside a guard).
- **Q:** *Risk of assertions?* — They silence the compiler without checking; wrong assertions become runtime errors.

### TypeScript at API boundaries
The frontend models (`models.ts`) mirror the C# DTO records by hand. Risks: drift when the API changes.
**Alternatives:** generate clients from the OpenAPI document (`/openapi/v1.json` in Development) with a generator
(backlog), or contract tests. Until then: integration tests + E2E catch mismatches.

---

## Official documentation
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Inheritance_and_the_prototype_chain
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Event_loop
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Equality_comparisons_and_sameness
- https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone
- https://www.typescriptlang.org/docs/handbook/2/narrowing.html
- https://www.typescriptlang.org/docs/handbook/2/generics.html
- https://www.typescriptlang.org/docs/handbook/utility-types.html
- https://www.typescriptlang.org/docs/handbook/2/mapped-types.html
- https://www.typescriptlang.org/docs/handbook/2/conditional-types.html
- https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html
