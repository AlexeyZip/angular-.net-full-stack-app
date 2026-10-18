# Design patterns and principles in NorthwindShop

Where the classic patterns appear in this repository, with real code, why each one was chosen here and what the
alternative would have cost. Snippets are shortened (`// ...`); the file path is always given so you can open the
full code. Where the code is only *similar* to the textbook form, this page says so — naming a pattern is useful
only if the name is accurate.

Groups: [creational](#1-creational-patterns) · [structural](#2-structural-patterns) ·
[behavioral](#3-behavioral-patterns) · [architectural](#4-architectural-patterns) ·
[application (enterprise) patterns](#5-application-enterprise-patterns) · [design principles](#6-design-principles) ·
[patterns deliberately not used](#7-patterns-deliberately-not-used).

## Overview

| Pattern | Group | Main location |
| --- | --- | --- |
| Static Factory Method | creational | `services/api/src/Shop.Api/Domain/AppException.cs` |
| Factory selected by configuration (DI) | creational | `Features/Assistant/AssistantRegistration.cs` |
| Builder | creational | options builder in `AssistantRegistration.cs`, `PromptBuilder.cs` |
| Singleton (container-managed) | creational | `Program.cs` (`TimeProvider.System`), `RemoteElementLoader` (`providedIn: 'root'`) |
| Object Mother / Test Data Builder | creational (tests) | `apps/web-e2e/src/support/api.ts` |
| Adapter | structural | `OpenAiCompatibleChatModel`, `createCustomElement` in `apps/assistant-mfe/src/main.ts` |
| Facade | structural | `libs/state/ngrx/src/lib/cart/ngrx-cart.store.ts` |
| Bridge | structural | `libs/state/contracts` + `libs/state/signals` / `libs/state/ngrx` |
| Proxy (virtual, remote) | structural | `@defer` in `apps/web/src/app/app.html`, `RemoteElementLoader`, dev proxy / nginx |
| Decorator (handler pipeline) | structural | `AddStandardResilienceHandler`, `authInterceptor` |
| Strategy | behavioral | `IChatModel`, `PaymentSimulator` tokens |
| State machine | behavioral | `Domain/Order.cs` |
| Observer | behavioral | signals `computed`, RxJS `Subject`, `userIdChanges$` |
| Chain of Responsibility | behavioral | ASP.NET Core middleware, `IExceptionHandler`, HTTP interceptors |
| Command | behavioral | NgRx actions in `libs/state/ngrx/src/lib/cart/` |
| Pipes and Filters | behavioral | assistant output boundary in `AssistantService.AskAsync` |
| Modular monolith + vertical slices | architectural | `services/api/src/Shop.Api/Features/*` |
| Microservice (one, extracted) | architectural | `services/notifications` |
| Microfrontend | architectural | `apps/assistant-mfe` |
| Flux / Redux | architectural | `libs/state/ngrx` |
| Transactional Outbox | architectural / integration | `Infrastructure/Messaging/*` |
| Retrieval-Augmented Generation | architectural | `Features/Assistant/*` |
| Circuit Breaker, Retry, Timeout | architectural (resilience) | `AssistantRegistration.cs` |
| Domain Model, Value Object | application | `Domain/*.cs`, `ShippingAddress` |
| Unit of Work | application | `ShopDbContext` + explicit transaction in `CheckoutService` |
| Data Transfer Object | application | `Features/*/*Contracts.cs` |
| Optimistic Offline Lock | application | `Product.Version`, `Order.Version` |
| Idempotency Key / Idempotent Receiver (Inbox) | application | `CheckoutService`, `services/notifications/.../EventIngestor.cs` |
| Competing Consumers with `SKIP LOCKED` | application | `OutboxProcessor.cs` |
| Optimistic UI with targeted rollback | application (frontend) | `libs/state/signals/src/lib/signals-wishlist.store.ts` |
| Error contract (Problem Details + stable code) | application | `AppException`, `AppExceptionHandler` |

---

## 1. Creational patterns

### 1.1 Static Factory Method — `AppException`

`services/api/src/Shop.Api/Domain/AppException.cs`

```csharp
public sealed class AppException : Exception
{
    public AppException(int statusCode, string code, string message, IReadOnlyDictionary<string, object?>? details = null)
        : base(message) { /* ... */ }

    public static AppException NotFound(string resource, object id) =>
        new(StatusCodes.Status404NotFound, "not_found", $"{resource} '{id}' was not found.");

    public static AppException Conflict(string code, string message, IReadOnlyDictionary<string, object?>? details = null) =>
        new(StatusCodes.Status409Conflict, code, message, details);

    public static AppException BusinessRule(string code, string message, IReadOnlyDictionary<string, object?>? details = null) =>
        new(StatusCodes.Status422UnprocessableEntity, code, message, details);
}
```

Usage: `throw AppException.BusinessRule("invalid_status_transition", ...)` in `Domain/Order.cs`,
`throw AppException.Conflict("insufficient_stock", ...)` in `CheckoutService.cs`.

- **Why:** the name says the *meaning* (not found, conflict, business rule) and the factory picks the HTTP status.
  Call sites cannot pair "insufficient stock" with a wrong status code, and the mapping lives in one place.
- **Alternative:** one exception class per error (`NotFoundException`, `ConflictException`, ...). More types, and the
  handler needs a `switch` over all of them; the frontend still only needs `code`.
- This is the *static factory method* idiom (Effective Java, item 1), not GoF *Factory Method* (which relies on
  subclasses overriding a creation method). Interviewers mix them up — say which one you mean.

### 1.2 Factory chosen by configuration — assistant model registration

`services/api/src/Shop.Api/Features/Assistant/AssistantRegistration.cs`

```csharp
var provider = configuration[$"{AssistantOptions.SectionName}:Provider"] ?? MockChatModel.ProviderName;
if (provider == OpenAiCompatibleChatModel.ProviderName)
{
    services.AddHttpClient<IChatModel, OpenAiCompatibleChatModel>((sp, http) => { /* base address */ })
        .AddStandardResilienceHandler(/* timeouts, retry, circuit breaker */);
}
else
{
    services.AddSingleton<IChatModel, MockChatModel>();
}
```

- **Why:** the DI container is the factory; the decision "which implementation" is made once, at start-up, from
  configuration. `AssistantService` only asks for `IChatModel` and never contains an `if (provider == ...)`.
- **Trade-off:** switching providers needs a restart. A runtime switch (keyed services, a factory with
  `Create(name)`) was not needed — nobody changes the model per request.
- Same idea on the frontend at **build time**: `apps/web/project.json` replaces
  `apps/web/src/app/state/state.providers.ts` with `state.providers.ngrx.ts` (`fileReplacements`), so each bundle
  contains exactly one state implementation.

### 1.3 Builder

**Framework builders (used everywhere):** `WebApplication.CreateBuilder(args)` in `Program.cs` and the options
builder chain:

```csharp
services.AddOptions<AssistantOptions>()
    .BindConfiguration(AssistantOptions.SectionName)
    .Validate(o => o.Provider is MockChatModel.ProviderName or OpenAiCompatibleChatModel.ProviderName, "...")
    .Validate(o => o.Provider != OpenAiCompatibleChatModel.ProviderName || (o.OpenAiCompatible.BaseUrl is not null /* ... */), "...")
    .ValidateOnStart();
```

Each step adds one part (binding, rules, when to validate) and the result is assembled by the framework.

**Our own:** `Features/Assistant/PromptBuilder.cs` assembles a `ChatRequest` from parts (system rules, earlier
questions, sanitized `<product>` blocks, the question) with a `StringBuilder`:

```csharp
public static ChatRequest Build(string question, IReadOnlyList<SourceProduct> sources, IReadOnlyList<string>? earlierQuestions = null)
{
    var user = new StringBuilder();
    // ... earlier questions, <product id=".."> blocks, the question
    return new ChatRequest([new ChatMessage(ChatRole.System, SystemPrompt), new ChatMessage(ChatRole.User, user.ToString())], sources);
}
```

- Honest naming: `PromptBuilder` is a *builder function*, not the GoF class with `WithX()` step methods. A fluent
  builder was not worth it: there is one prompt shape, and a pure function is trivially unit-tested
  (`AssistantTests.Earlier_questions_are_listed_as_one_line_context_before_the_current_question`).
- **When to switch to a fluent builder:** several prompt variants that share steps (e.g. per locale or per task).

### 1.4 Singleton — managed by the container, never by a static field

```csharp
// services/api/src/Shop.Api/Program.cs
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<PaymentSimulator>();
```

```ts
// apps/web/src/app/features/assistant/remote-element-loader.ts
@Injectable({ providedIn: 'root' })
export class RemoteElementLoader {
  private readonly pending = new Map<string, Promise<void>>();
  // ...
}
```

- **Why singleton:** these objects are stateless or hold process-wide state (`RemoteElementLoader` must inject a
  remote script at most once per page, so its `pending` map has to be shared).
- **Why the container and not `static Instance`:** tests replace them (`FakeTimeProvider`, a fresh `TestBed`), and
  lifetimes are visible in one place. `DateTime.UtcNow` is banned (AGENTS.md) for exactly this reason: a static
  clock cannot be faked.
- **Pitfall avoided:** a singleton must not capture a scoped service. `ModelWarmUp` (a hosted service = singleton)
  therefore creates a scope to resolve `IChatModel`: `await using var scope = scopes.CreateAsyncScope();`.

### 1.5 Object Mother / Test Data Builder (tests)

`apps/web-e2e/src/support/api.ts`

```ts
export function newCustomer(): Customer {
  const id = randomUUID().slice(0, 8);
  return { email: `e2e-${id}@test.local`, password: 'E2e-Password-123', fullName: `E2E Customer ${id}` };
}

export class AdminApi {
  private constructor(private readonly context: APIRequestContext) {}
  static async signIn(): Promise<AdminApi> { /* ... */ }
  async createProduct(options: { stock: number; price?: number; name?: string }): Promise<CreatedProduct> { /* ... */ }
}
```

- **Why:** tests state only what matters to them (`createProduct({ stock: 4, price: 37 })`) and get valid, unique
  defaults for everything else. Unique names keep parallel tests independent.
- `AdminApi` also uses a *private constructor + async static factory*, because creating it requires an awaited
  login — a constructor cannot be `async`.
- Lesson from 2026-10-18: unique names are not enough if the *code under test* ranks shared words (KI-20) — see the
  retrieval fix in `docs/guides/assistant-implementation.md` §4.3.

---

## 2. Structural patterns

### 2.1 Adapter — a model server behind `IChatModel`

`services/api/src/Shop.Api/Features/Assistant/ChatModel.cs` (target interface) and `ChatModels.cs` (adapter):

```csharp
public interface IChatModel
{
    string Name { get; }
    Task<string> CompleteAsync(ChatRequest request, CancellationToken cancellationToken);
}

public sealed class OpenAiCompatibleChatModel(HttpClient http, IOptions<AssistantOptions> options) : IChatModel
{
    public async Task<string> CompleteAsync(ChatRequest request, CancellationToken cancellationToken)
    {
        // our ChatRequest -> OpenAI JSON ("model", "messages", "temperature", "max_tokens")
        using var response = await http.SendAsync(message, cancellationToken);
        response.EnsureSuccessStatusCode();
        var completion = await response.Content.ReadFromJsonAsync<CompletionResponse>(cancellationToken);
        return completion?.Choices.FirstOrDefault()?.Message.Content
            ?? throw new InvalidOperationException("The model returned no choices.");
    }
}
```

- **Why:** the application speaks *its* language (`ChatRequest`, `string` answer); the wire format of
  `/chat/completions` stays inside one class with private DTOs. Ollama, LM Studio, vLLM or a hosted provider are the
  same adapter with another base URL.
- **Second adapter in the repo:** `createCustomElement(AssistantWidget, { injector })` in
  `apps/assistant-mfe/src/main.ts` adapts an Angular component to the browser's Custom Elements interface
  (attributes/properties in, DOM events out), so any host page can use `<shop-assistant>`.

### 2.2 Facade — `NgrxCartStore` hides the store, actions and selectors

`libs/state/ngrx/src/lib/cart/ngrx-cart.store.ts`

```ts
@Injectable()
export class NgrxCartStore extends CartStore {
  private readonly store = inject(Store);

  readonly lines = this.store.selectSignal(cartFeature.selectLines);
  readonly canCheckout = this.store.selectSignal(cartFeature.selectCanCheckout);

  add(product: CartProduct, quantity = 1): void {
    this.store.dispatch(cartActions.itemAdded({ product, quantity }));
  }
  // ...
}
```

- **Why:** components call `cart.add(product)` and read `cart.lines()`. They do not know about `Store`, action
  creators, selectors or effects — the NgRx subsystem has one simple entry point.
- **Trade-off (known NgRx debate):** a facade hides the action log a little (you call a method, not `dispatch`).
  Here it is required anyway, because the same component code must also work with the Signals implementation.

### 2.3 Bridge — one abstraction, two independent implementations

`libs/state/contracts/src/lib/state-contracts.ts` (abstraction) → `libs/state/signals` and `libs/state/ngrx`
(implementations), wired in `libs/state/ngrx/src/lib/provide-ngrx-state.ts`:

```ts
export abstract class CartStore {
  abstract readonly lines: Signal<readonly CartLine[]>;
  abstract readonly canCheckout: Signal<boolean>;
  abstract add(product: CartProduct, quantity?: number): void;
  // ...
}

// provide-ngrx-state.ts
{ provide: CartStore, useExisting: NgrxCartStore },
```

- **Why Bridge and not "just an interface":** the abstraction (what features need) and the implementation family
  (signals vs Redux) vary independently; features are written once against `CartStore`, and either family plugs in.
- **Why an abstract class and not a TS `interface`:** interfaces disappear at runtime; an abstract class is also a DI
  token, so `inject(CartStore)` works without a separate `InjectionToken`.
- The lint rule "only `apps/web/src/app/state/*.providers*.ts` may import an implementation" keeps the bridge honest.

### 2.4 Proxy — virtual and remote

**Virtual proxy (lazy loading)** — `apps/web/src/app/app.html`:

```html
<!-- Neither the panel code nor the remote bundle is downloaded until the assistant is first opened. -->
@defer (when assistantRequested()) {
  <shop-assistant-panel [open]="assistantOpen()" (closed)="closeAssistant()" />
}
```

The same in `features/product/product-page.ts`: `@defer (on viewport)` for reviews.

**Remote proxy with caching** — `RemoteElementLoader.load()`: callers just `await load(config)`; the loader decides
whether to inject a script, reuse a pending load or resolve immediately:

```ts
let loading = this.pending.get(config.scriptUrl);
if (!loading) {
  loading = this.inject(config, registry);
  // A failed load may succeed later (remote redeployed), so failures are not cached.
  loading.catch(() => this.pending.delete(config.scriptUrl));
  this.pending.set(config.scriptUrl, loading);
}
return loading;
```

**Reverse proxy (infrastructure):** the Angular dev-server proxy and nginx serve `/api`, `/health` and
`/mfe/assistant/` from the page's origin — no CORS, one CSP origin, cookies stay first-party.

### 2.5 Decorator — wrapping a handler with extra behaviour

**HTTP client pipeline** (`AssistantRegistration.cs`): `AddStandardResilienceHandler` wraps the typed client's
handler with timeout, retry and circuit-breaker handlers. `OpenAiCompatibleChatModel` contains none of that logic.

**Functional interceptor** (`libs/shared/data-access/src/lib/auth/auth.interceptor.ts`) wraps `next` with
authentication:

```ts
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  // ...
  const token = session.getAccessToken();
  return next(withBearer(request, token)).pipe(
    catchError((error: unknown) => {
      const expired = error instanceof HttpErrorResponse && error.status === 401 && token !== null;
      if (!expired) return throwError(() => error);
      return session.refresh().pipe(
        switchMap((newToken) => (newToken ? next(withBearer(request, newToken)) : throwError(() => error))),
      );
    }),
  );
};
```

- **Why:** cross-cutting concerns (auth, resilience) are added around the core call without changing it; each
  wrapper is tested alone (`auth.interceptor.spec.ts`).
- Both pipelines are also a *Chain of Responsibility* (§3.4): a decorator always calls the next element, a chain
  element may stop the request.

---

## 3. Behavioral patterns

### 3.1 Strategy — interchangeable algorithms behind one contract

**Model strategy:** `IChatModel` with `MockChatModel` (deterministic, free, used by tests and by default) and
`OpenAiCompatibleChatModel` (real model). `AssistantService` uses the strategy without knowing which one it is:

```csharp
output = await model.CompleteAsync(PromptBuilder.Build(question, sources, earlierQuestions), cancellationToken);
```

**Payment outcome by token** (`Features/Orders/PaymentSimulator.cs`) — a lightweight strategy selection with a
`switch` expression:

```csharp
return paymentToken switch
{
    ApprovedToken => $"sim_{...}",
    DeclinedToken => throw new AppException(StatusCodes.Status402PaymentRequired, "payment_declined", "..."),
    UnavailableToken => throw new AppException(StatusCodes.Status503ServiceUnavailable, "payment_unavailable", "..."),
    _ => throw AppException.BusinessRule("invalid_payment_token", "Unknown payment token."),
};
```

- **Why:** the mock strategy makes every branch testable without a network; the real one is enabled by
  configuration (Open/Closed, §6).
- The payment simulator deliberately has **no** interface yet (see its comment): one implementation does not need
  an abstraction — YAGNI (§6). The interface appears when a second provider does.

### 3.2 State machine — `Order` status transitions

`services/api/src/Shop.Api/Domain/Order.cs`

```csharp
private static readonly IReadOnlyDictionary<OrderStatus, OrderStatus[]> AllowedTransitions =
    new Dictionary<OrderStatus, OrderStatus[]>
    {
        [OrderStatus.Paid] = [OrderStatus.Shipped, OrderStatus.Cancelled],
        [OrderStatus.Shipped] = [OrderStatus.Delivered],
        [OrderStatus.Delivered] = [],
        [OrderStatus.Cancelled] = [],
    };

public void TransitionTo(OrderStatus next, DateTimeOffset now)
{
    if (!CanTransitionTo(next))
    {
        throw AppException.BusinessRule("invalid_status_transition", $"Order cannot move from {Status} to {next}.", /* ... */);
    }
    Status = next;
    UpdatedAt = now;
}
```

- **Why a transition table and not the GoF State pattern** (one class per state): the states have no behaviour of
  their own besides "which state may follow". A table is readable at a glance, `NextStatuses(from)` feeds the admin
  UI buttons, and adding a state is one line. GoF State pays off when each state *behaves* differently.
- The setter is private: the only way to change the status is through the rule.

### 3.3 Observer — signals and RxJS streams

`libs/state/signals/src/lib/signals-cart.store.ts`

```ts
private readonly state = signal<CartState>({ lines: [], quote: null, quoteStatus: 'idle', quoteError: null });

readonly lines = computed(() => this.state().lines);
readonly itemCount = computed(() => cartItemCount(this.lines()));
readonly canCheckout = computed(() => !this.isEmpty() && this.quoteStatus() === 'success' && this.quote()?.canCheckout === true);

// Identity changes (login/logout/expiry) swap the whole cart
this.session.userIdChanges$.pipe(takeUntilDestroyed()).subscribe((nextUserId) => { /* ... */ });

// A genuine side effect - mirroring state into localStorage - which is what effect() is for.
effect(() => this.persistence.write(this.userId, this.lines()));
```

- **Signals** are a pull-based observer graph: `computed` re-evaluates only when a dependency changed and is
  read. **RxJS** is push-based and adds time and cancellation (`switchMap`, `timer`).
- **Rule used in the repo:** derived values are `computed`, `effect` is only for real side effects (storage, DOM).
  Deriving state in `effect` causes extra change-detection passes and ordering bugs.
- `takeUntilDestroyed()` ends each subscription with its owner — the observer pattern's classic leak is closed.

### 3.4 Chain of Responsibility — middleware and exception handlers

`services/api/src/Shop.Api/Program.cs`

```csharp
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapControllers();
```

Each middleware handles the request, short-circuits it (401, 403, 429) or passes it on. **Order matters:** the
exception handler must come first to catch everything registered after it, and authentication must run before
authorization, which needs the user it produced.

`Infrastructure/ErrorHandling/AppExceptionHandler.cs` is one link of the `IExceptionHandler` chain: it returns
`false` for exceptions it does not know, and the next handler (the framework's generic 500) takes over:

```csharp
var (status, code, title, details) = exception switch
{
    AppException app => (app.StatusCode, app.Code, app.Message, app.Details),
    DbUpdateConcurrencyException => (StatusCodes.Status409Conflict, "concurrency_conflict", "...", null),
    // ...
    _ => (0, string.Empty, string.Empty, null),
};
if (status == 0)
{
    return false;
}
```

### 3.5 Command — NgRx actions

`libs/state/ngrx/src/lib/cart/cart.feature.ts`

```ts
reducer: createReducer(
  initialCartState,
  on(cartActions.itemAdded, (state, { product, quantity }) =>
    linesChanged(cartAdapter.setAll(addCartLine(cartAdapter.getSelectors().selectAll(state), product, quantity), state)),
  ),
  on(cartActions.itemRemoved, (state, { productId }) => linesChanged(cartAdapter.removeOne(productId, state))),
  // ...
),
```

- An action (`itemAdded({ product, quantity })`) is a serializable *request object*: it can be logged, replayed in
  Redux DevTools and handled by several reducers and effects. `strictActionSerializability` in
  `provide-ngrx-state.ts` enforces that it stays plain data.
- **Difference from GoF Command:** the action carries no `execute()`; reducers and effects interpret it. Compare
  with the Signals variant, where `add()` just updates a signal — less ceremony, no action log.

### 3.6 Pipes and Filters — the assistant's output boundary

`services/api/src/Shop.Api/Features/Assistant/AssistantService.cs`

```csharp
var filtered = CitationFilter.Apply(output, products.Select(p => p.Id).ToHashSet());
var guarded = PriceGuard.Apply(filtered.Text, string.Join('\n', [.. earlierQuestions, question]));
var grounded = filtered.CitedIds.Count > 0
    ? filtered.CitedIds
    : CitationFilter.FindMentionedProducts(guarded.Text, products.Select(p => (p.Id, p.Name)));
```

- Each filter is a small pure function with one job (drop invented citations, remove prices the model wrote), so
  each is unit-tested on its own (`AssistantTests`) and the order is explicit.
- Detailed reasoning: `docs/guides/assistant-implementation.md` §4.7.

---

## 4. Architectural patterns

### 4.1 Modular monolith with vertical slices

`services/api/src/Shop.Api/Features/{Catalog,Auth,Wishlist,Orders,Admin,Assistant}/` — each module has its
controller, service and contracts; `Domain/` holds entities; `Infrastructure/` holds EF Core, auth, errors, messaging.

- **Why:** checkout needs one ACID transaction across stock, payment and order — trivial in one process, a saga in
  microservices. Feature folders are the future service boundaries.
- Decision: `docs/engineering-decisions/02-modular-monolith-vs-microservices.md`.

### 4.2 Microservice — the one extracted service

`services/notifications`: own solution, own database `shop_notifications`, deployed separately, fed by events.
Chosen because notifications are a side effect whose failure must not fail a checkout — the cheapest, safest
candidate. ADR-0012, guide `docs/guides/outbox-and-notifications-service.md`.

### 4.3 Microfrontend — runtime composition through a custom element

`apps/assistant-mfe` builds `<shop-assistant>`; the host loads it at runtime (`RemoteElementLoader`) and talks to it
only through attributes and DOM events. No build-time dependency (lint tag `type:remote` depends on nothing). Cost:
a second Angular runtime on the page (KI-17). ADR-0011.

### 4.4 Flux / Redux — unidirectional data flow

`libs/state/ngrx`: view → action → reducer (pure) → store → selector → view; side effects only in effects
(`cart.effects.ts`). The Signals variant shows the same app *without* Flux — the comparison is the point
(decision 04).

### 4.5 Transactional Outbox

`Infrastructure/Messaging/Outbox.cs` stages the event in the caller's `DbContext`; it is committed together with the
order:

```csharp
/// Adds events to the outbox. It only stages them in the DbContext: they are written by the caller's own
/// SaveChanges, inside the caller's transaction. Never call SaveChanges here.
public void Enqueue<TEvent>(string type, TEvent payload) where TEvent : notnull =>
    db.OutboxMessages.Add(new OutboxMessage(Guid.CreateVersion7(), type, JsonSerializer.Serialize(payload, Json),
        clock.GetUtcNow(), Activity.Current?.Id));
```

```csharp
// CheckoutService.cs, inside the checkout transaction
outbox.Enqueue(IntegrationEventTypes.OrderPlaced, new OrderPlacedV1(/* ... */));
await db.SaveChangesAsync(cancellationToken);
await transaction.CommitAsync(cancellationToken);
```

- **Why:** "save the order, then call the service" loses the event if the process dies in between; "call, then
  save" sends notifications for orders that rolled back. With the outbox both facts commit atomically and a
  background publisher delivers at least once.

### 4.6 Retrieval-Augmented Generation

Parse → retrieve from PostgreSQL with hard filters → prompt with sources → model → validate the output against the
sources. The model never decides which products exist or what they cost. Full walkthrough:
`docs/guides/assistant-implementation.md`.

### 4.7 Resilience patterns: Timeout, Retry, Circuit Breaker, Graceful Degradation

`AssistantRegistration.cs` configures attempt and total timeouts, **one** retry only for fast failures and a
circuit breaker. If the model still fails, `AssistantService` returns the retrieved products with
`Degraded: true` instead of an error. Why a timed-out generation is not retried: the user would wait twice as long
for the same result.

---

## 5. Application (enterprise) patterns

### 5.1 Domain Model and Value Object

Entities guard their invariants: private setters, constructors that validate, behaviour methods
(`Order.TransitionTo`, `Product.UpdateDetails`). `ShippingAddress` is a value object — a `record` stored as columns of
`orders` via `builder.ComplexProperty(o => o.ShippingAddress, ...)` in `EntityConfigurations.cs`:

```csharp
public sealed record ShippingAddress(string Recipient, string Line1, string City, string PostalCode, string Country);
```

- **Why:** an invalid order cannot be constructed (`empty_order`), and the rule lives next to the data, not in each
  service that touches it. Value equality and immutability come free with `record`.

### 5.2 Unit of Work — `DbContext` plus an explicit transaction

`ShopDbContext` tracks changes and writes them in one `SaveChangesAsync`. Checkout needs more (conditional
`UPDATE`s executed immediately), so `CheckoutService` opens an explicit transaction around everything:

```csharp
// Any exception before CommitAsync disposes the transaction, which rolls back every stock change.
await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
// ... conditional stock UPDATEs, payment, order insert, outbox row
await db.SaveChangesAsync(cancellationToken);
await transaction.CommitAsync(cancellationToken);
```

### 5.3 Data Transfer Object

`Features/*/*Contracts.cs` contain `record` request/response types (`AskAssistantRequest`, `CheckoutRequest`,
`AdminProductDto`, ...). Entities never leave the API: the response shape can change independently of the schema,
and over-posting is impossible because requests do not bind to entities. Validation attributes sit on constructor
parameters (decision 20 — `[property: Required]` caused 500s).

### 5.4 Optimistic Offline Lock

`Infrastructure/Persistence/EntityConfigurations.cs` and `Features/Admin/AdminCatalogService.cs`:

```csharp
builder.Property(p => p.Version).IsConcurrencyToken();   // Product: explicit version column
builder.Property(o => o.Version).IsRowVersion();         // Order: PostgreSQL xmin

// Optimistic concurrency: EF adds "WHERE version = @version" to the UPDATE. If another admin saved
// the details since this client loaded them, zero rows match and SaveChanges throws
// DbUpdateConcurrencyException, which the global handler maps to 409.
db.Entry(product).Property(p => p.Version).OriginalValue = request.Version;
```

- **Why an explicit `Version` for products and not `xmin`:** stock and rating change on every checkout and review;
  with `xmin` each of those would make an admin's edit fail with a false 409.

### 5.5 Idempotency Key (producer side) and Idempotent Receiver / Inbox (consumer side)

**Checkout** (`CheckoutService.cs`): a client-generated key per attempt, a unique index
`(user_id, idempotency_key)` and a request fingerprint:

```csharp
var replay = await TryReplayAsync(userId, idempotencyKey, fingerprint, cancellationToken);
if (replay is not null) return replay;                      // retry of the same request: same order back
// ...
catch (DbUpdateException ex) when (ex.IsUniqueViolation("ix_orders_user_id_idempotency_key"))
{
    // Lost a race against a concurrent request with the same idempotency key.
}
```

**Notifications** (`services/notifications/src/Shop.Notifications/Events/EventIngestor.cs`): the inbox row and the
notification are saved together; a redelivered message id is recognised:

```csharp
if (await db.Inbox.AnyAsync(m => m.MessageId == envelope.MessageId, cancellationToken))
{
    return new IngestResult(IngestOutcome.Duplicate);
}
// ...
db.Inbox.Add(new InboxMessage(envelope.MessageId, envelope.Type, envelope.OccurredAt, now));
db.Notifications.Add(notification);
await db.SaveChangesAsync(cancellationToken);   // unique violation here = a concurrent duplicate
```

- **Why both:** networks retry. At-least-once delivery is only safe when the receiver is idempotent. The check
  *before* is an optimisation; the unique constraint is the guarantee.

### 5.6 Competing Consumers with `FOR UPDATE SKIP LOCKED` and a lease

`Infrastructure/Messaging/OutboxProcessor.cs`

```sql
SELECT * FROM outbox_messages
WHERE processed_at IS NULL AND dead_lettered_at IS NULL AND next_attempt_at <= {now}
ORDER BY next_attempt_at
LIMIT {settings.BatchSize}
FOR UPDATE SKIP LOCKED
```

Then each row is *claimed* (`message.Claim(now + settings.ClaimDuration)`) and the short transaction commits
**before** any HTTP call. Several API instances never pick the same rows, and no lock is held during network I/O.
Failed deliveries use exponential backoff (`OutboxBackoff.Delay`) and end in a dead-letter state.

### 5.7 Optimistic UI with targeted rollback

`libs/state/signals/src/lib/signals-wishlist.store.ts`

```ts
this.state.update((state) => ({ ...state, items: state.items.filter((i) => i.id !== productId), error: null }));
this.api.remove(productId).subscribe({
  // Roll back only this item. Restoring a whole snapshot would undo other changes made meanwhile.
  error: (error: unknown) =>
    this.state.update((state) => ({
      ...state,
      items: state.items.some((i) => i.id === productId) ? state.items : [removed, ...state.items],
      error: toApiError(error),
    })),
});
```

- **Why:** the heart toggles instantly. Only low-risk, easily reversible actions are optimistic; checkout is never
  optimistic — money and stock wait for the server.

### 5.8 Error contract — Problem Details with a stable `code`

`AppException` (§1.1) + `AppExceptionHandler` (§3.4) produce RFC 9457 responses with `code` and `traceId`. The UI
maps `code` (`insufficient_stock`, `concurrency_conflict`), never the message text, so wording can change without
breaking the client.

---

## 6. Design principles

| Principle | Where you can see it |
| --- | --- |
| **S**ingle Responsibility | `Pricing.Calculate` only computes money; `CitationFilter` only validates citations; `Outbox` only stages events; `OutboxProcessor` only delivers them. |
| **O**pen/Closed | a new model provider is a new `IChatModel` class + one registration branch; `AssistantService` does not change. |
| **L**iskov Substitution | `runStateContractSuite('signals', provideSignalsState)` and `runStateContractSuite('ngrx', provideNgrxState)` run the *same* behavioural tests against both `CartStore` implementations — substitutability is tested, not assumed. |
| **I**nterface Segregation | three small contracts (`CatalogStore`, `CartStore`, `WishlistStore`) instead of one `AppStore`; `IChatModel` has one method. |
| **D**ependency Inversion | features depend on `CartStore` (abstraction in `libs/state/contracts`); services depend on `TimeProvider`, `IChatModel`, `IPasswordHasher<User>`; implementations are chosen in composition roots (`Program.cs`, `*.providers*.ts`). |
| DRY (one source of truth) | `Pricing` is used by both the cart quote and checkout: the price a customer sees is computed by the code that charges them. Event JSON samples in `services/contracts/events` are shared by producer and consumer tests. |
| KISS | lexical retrieval instead of a vector database for 64 products; a transition table instead of State classes. |
| YAGNI | no repository layer over EF Core; `PaymentSimulator` without an interface; no message broker for one consumer (decision 22). |
| Fail fast | `ValidateOnStart()` on options; NgRx `runtimeChecks` (`strictStateImmutability`, ...); `TreatWarningsAsErrors`. |
| Composition over inheritance | HTTP handler pipelines, interceptors, Angular `inject()` instead of base classes; the only inheritance is `extends CartStore` (the contract). |
| Separation of concerns | `libs/shared/ui` is presentational (no HTTP, no state; enforced by lint); data-access owns HTTP and auth. |
| Never trust the client | prices, totals, stock, user id and roles come from the server; assistant history carries only questions and product ids, which are re-read with current filters. |
| Least privilege / defense in depth | admin endpoints need the role policy *and* the UI hides them; service-to-service calls need `X-Service-Key`; CSP + escaping + sanitized prompts. |
| Make illegal states unrepresentable | private setters and validating constructors in `Domain/`; `RequestStatus` union types instead of several booleans. |

---

## 7. Patterns deliberately not used

Knowing why a pattern is *absent* is as useful as knowing where it is used.

| Not used | Why |
| --- | --- |
| Generic Repository over EF Core | `DbContext` already is a Unit of Work and `DbSet` a repository; a wrapper would hide `ExecuteUpdate`, projections and `FromSql` that checkout and the outbox rely on. Integration tests run against real PostgreSQL instead of mocking repositories. |
| CQRS with separate read/write models | reads are projections (`OrderQueries`, `Select(...)` into DTOs) from the same database; separate stores would add eventual consistency without a load problem to solve. |
| Mediator library (MediatR) | controllers call services directly; one level of indirection less to debug. Cross-cutting concerns are middleware. |
| Event sourcing | the audit log and the outbox cover "what happened" for this domain; rebuilding state from events would complicate every query. |
| Saga | the only multi-step business transaction (checkout) stays in one database transaction (decision 02). |
| GoF State classes, Visitor, Abstract Factory | the problems they solve (behaviour per state, operations over a class hierarchy, families of related products) do not exist here. |

## Related reading

- `docs/engineering-decisions/` — long-form decisions (01 architecture, 02 monolith vs microservices, 04 state,
  08 transactions and concurrency, 10 synchronous vs asynchronous communication, 12 AI, 20 domain modeling and
  validation, 22 deliberately not built).
- `docs/guides/assistant-implementation.md`, `docs/guides/outbox-and-notifications-service.md`,
  `docs/guides/developer-guide.md`.
- `docs/learning/` — topic pages with interview questions.
