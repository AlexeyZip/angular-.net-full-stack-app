# C# and ASP.NET Core

Grounded in `services/api` (.NET 10, `Nullable` enabled, `ImplicitUsings`, `TreatWarningsAsErrors`).
Comparisons to NestJS are included because that is the author's background.

---

## C# fundamentals

### Value vs reference types; structs
Value types (`int`, `decimal`, `bool`, `DateTimeOffset`, `struct`s) are copied; reference types (`class`, `record`,
arrays, `string` — immutable) share an instance.
- **In this repo:** money is `decimal` (never `double`: binary floating point cannot represent 0.10 exactly);
  timestamps are `DateTimeOffset`. No custom structs — none of the domain values is small and hot enough to justify one.
- **Q:** *When a struct?* — Small (≤ ~16 bytes), immutable, value semantics, many allocations (e.g. a `Money` or
  coordinate type); avoid large mutable structs (copy surprises).

### Classes, records, immutability, encapsulation
```csharp
public sealed record PriceBreakdown(decimal Subtotal, decimal Shipping, decimal Total); // value equality, immutable
```
- **In this repo:** DTOs and value objects are `sealed record`s (`CatalogContracts.cs`, `Pricing.cs`,
  `ShippingAddress` in `Order.cs`). Entities are classes with **private setters** and behaviour methods
  (`Order.TransitionTo`, `Product.UpdateDetails`), so invariants cannot be bypassed.
- **Mistake:** public setters on entities ("anaemic model") — any code can put an order into an impossible state.
- **Q:** *record vs class?* — Records give value-based equality, `with` copies and concise syntax; ideal for DTOs and
  value objects. Entities have identity, so classes.

### Interfaces, inheritance vs composition, access modifiers
- **In this repo:** `AppExceptionHandler : IExceptionHandler` (framework extension point); services are plain
  `sealed` classes composed via constructor injection — no base-service hierarchies. `internal` for implementation
  details (`AppExceptionHandler`, `CatalogService.EscapeLikePattern`), visible to the test projects through
  `<InternalsVisibleTo>` in `Shop.Api.csproj`. Interfaces are introduced only where there is a second implementation or a framework contract (YAGNI).
- **Q:** *Why `sealed` by default?* — Prevents unintended inheritance and allows JIT devirtualisation.

### Nullable reference types
`string?` may be null; `string` must not. The compiler warns on possible null dereferences — and warnings are errors
here.
```csharp
var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
```
- **Mistake:** silencing with `!` (null-forgiving). Used only for EF navigation properties set by the ORM
  (`= null!`).
- **Compile-time vs runtime:** NRT annotations are compile-time only — request bodies are still validated at runtime
  (`[Required]`, `[Range]`, `[ApiController]` automatic 400).

### Generics, collections, LINQ, extension methods
```csharp
public static async Task<PagedResult<T>> ToPagedResultAsync<T>(
    this IQueryable<T> query, int page, int pageSize, CancellationToken cancellationToken) // Features/Shared/PagedResult.cs
```
- **In this repo:** `IReadOnlyList<T>` for results (callers cannot mutate), `Dictionary`, `HashSet`; LINQ over
  `IQueryable` becomes SQL (EF Core), over `IEnumerable` runs in memory (`Pricing.Calculate` uses `Sum`).
  Extension methods: `ToPagedResultAsync`, `DbUpdateException.IsUniqueViolation`, `AddShopRateLimiting`,
  `ClaimsPrincipal.GetRequiredUserId`.
- **Mistake:** calling `.ToList()` before `.Where()` — loads the whole table.
- **Q:** *`IQueryable` vs `IEnumerable`?* — `IQueryable` builds an expression tree translated by a provider (SQL);
  `IEnumerable` executes delegates in memory.

### Delegates, lambdas and expression trees
`Func<T, TResult>` is a delegate (compiled code); `Expression<Func<...>>` is data describing code, which EF Core
translates to SQL.
```csharp
private static readonly Expression<Func<Product, AdminProductDto>> ToDto = p => new AdminProductDto(...); // AdminCatalogService.cs
```
- Events (`event`) are not used: there is no in-process publish/subscribe need (see decision 10).

### Exceptions
- **In this repo:** expected business outcomes throw `AppException` with a status and a stable code
  (`Domain/AppException.cs`); a single `IExceptionHandler` turns them into ProblemDetails. Unexpected exceptions
  become a generic 500. `catch ... when (...)` filters: `catch (DbUpdateException ex) when
  (ex.IsUniqueViolation("ix_orders_user_id_idempotency_key"))` in `CheckoutService.cs`.
- **Q:** *Exceptions vs Result types?* — Exceptions are simpler for rare, request-terminating failures; Result types
  make failure explicit in signatures and avoid stack-unwinding cost on hot paths.

### async/await, Task, CancellationToken
```csharp
public Task<ProductDetailDto> GetProduct(string slug, CancellationToken cancellationToken) =>
    catalog.GetProductAsync(slug, cancellationToken); // token = HttpContext.RequestAborted, bound automatically
```
- Every I/O method is `async` and takes a `CancellationToken`, passed down to EF Core, so a closed browser tab
  cancels the SQL command. Cancellation surfaces as 499 and is logged as information, not as an error.
- **Mistakes:** `.Result`/`.Wait()` (thread-pool starvation, deadlocks in some contexts), `async void`, forgetting
  to pass the token.
- **Q:** *Does `await` create a thread?* — No; it registers a continuation; the thread returns to the pool while I/O
  is pending.

### Pattern matching and enums
```csharp
var (status, code, title, details) = exception switch
{
    AppException app => (app.StatusCode, app.Code, app.Message, app.Details),
    DbUpdateConcurrencyException => (StatusCodes.Status409Conflict, "concurrency_conflict", "...", null),
    OperationCanceledException when httpContext.RequestAborted.IsCancellationRequested => (499, "client_closed_request", "...", null),
    _ => (0, string.Empty, string.Empty, null),
};
```
Also property patterns `if (query.MinPrice is { } min)` (`CatalogService.cs`). Enums: `OrderStatus`, `UserRole`,
`ProductSort`, serialised as strings (`JsonStringEnumConverter`) so the API contract is readable and reordering
members does not break clients.

### Dependency injection, configuration and options
See [ASP.NET Core](#aspnet-core) below — `AddOptions<AuthOptions>().BindConfiguration(...).ValidateDataAnnotations()
.ValidateOnStart()`.

### Attributes and reflection
Attributes are metadata read by the framework via reflection: `[ApiController]`, `[Route]`, `[HttpGet]`,
`[Authorize(Policy = ...)]`, `[EnableRateLimiting]`, `[Range]`, `[MaxLength]`. Application code itself uses no
reflection.

### Disposal: IDisposable / IAsyncDisposable
```csharp
await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken); // CheckoutService.cs
```
Disposing an uncommitted transaction rolls it back — that is the rollback path for every exception in checkout.
`DbContext` is disposed by the DI scope at the end of the request.

### Modern C# features used
Primary constructors (`public sealed class CatalogService(ShopDbContext db)`), collection expressions (`[]`,
`["ready"]`), file-scoped namespaces, `init`-only properties in options classes, verbatim strings (`@"\"`), tuple
deconstruction from a `switch` expression, and the `TimeProvider` abstraction for testable time.

---

## ASP.NET Core

### Startup and hosting
`Program.cs` uses the minimal hosting model: `WebApplication.CreateBuilder` → register services → `Build()` →
configure the pipeline → `RunAsync()`. Sections are commented (web layer, persistence, auth, application services,
health). `public partial class Program;` exposes the entry point to `WebApplicationFactory` in integration tests.

### Middleware pipeline (order matters)
```text
ForwardedHeaders (only behind the compose proxy) → ExceptionHandler → StatusCodePages → (OpenAPI/Scalar in Dev)
→ CORS → Authentication → Authorization → RateLimiter → Controllers / health endpoints
```
NestJS analogy: middleware → guards (authorization) → interceptors/filters (exception handler).
- **Mistake:** `UseAuthorization` before `UseAuthentication` — every user is anonymous.

### DI lifetimes
| Lifetime | Used for | Why |
| --- | --- | --- |
| Singleton | `TimeProvider`, `TokenService`, `PaymentSimulator` | stateless, thread-safe |
| Scoped | `ShopDbContext`, all feature services, `AuditLogger` | one unit of work per request |
| Transient | — | not needed |
- **Mistake:** injecting a scoped `DbContext` into a singleton (captive dependency) — the scope validation in
  Development throws at startup.

### Controllers, routing, DTOs, model validation
`[ApiController]` gives automatic 400 `ValidationProblemDetails` for invalid models, binding-source inference and
`[FromQuery]` objects (`ProductQuery` with `[Range(1, 48)] PageSize`). Controllers are thin: authorization, binding,
status codes; logic lives in services. DTOs are records separate from entities (no over-posting, no lazy-loading
surprises in JSON).

**Pitfall found in this repo:** on a positional record put validation attributes on the *parameter*
(`record LoginRequest([Required, EmailAddress] string Email)`), not `[property: Required]`. MVC throws
`InvalidOperationException` for property-targeted metadata on records, so every request becomes a 500 — it compiles,
and only an HTTP-level (integration) test reveals it. See decision 20.

### HTTP methods and status codes
`GET` reads; `POST /api/orders` creates (201 + `Idempotency-Key`); `PUT` admin updates with a version; wishlist uses
idempotent `PUT /api/wishlist/{productId}` and `DELETE` (both 204), so repeating either is harmless. Errors: 400 validation, 401 unauthenticated, 403 forbidden, 404 not found / not owned, 409
conflicts (stock, concurrency), 422 business rules, 429 rate limit, 402/503 payment simulator, 499 client closed.

### Configuration, environments and options
`appsettings.json` → `appsettings.{Environment}.json` → user secrets (Development) → environment variables
(`Auth__SigningKey`) → command line. Options are strongly typed, validated **at startup** (`ValidateOnStart`) — the
API refuses to start in Production without a signing key (verified).

### Authentication, authorization, claims, RBAC
JWT bearer with issuer/audience/lifetime/signature validation and `ValidAlgorithms = [HmacSha256]` (prevents algorithm
confusion); `MapInboundClaims = false` keeps `sub`/`role`. Policy `AdminPolicy` → `RequireRole("Admin")`. Resource
ownership is checked in queries (`WHERE user_id = @current`). See [ADR-0005](../adr/0005-authentication-model.md).

### OpenAPI, structured logging, health checks, rate limiting
- OpenAPI document + Scalar UI in Development (`/openapi/v1.json`, `/scalar`).
- `ILogger<T>` with message templates; JSON console formatter outside Development.
- `/health/live` and `/health/ready` (database check).
- `AddRateLimiter` with fixed-window policies: `auth` per IP, `checkout` per user (`RateLimitPolicies.cs`).

### Exception handling and ProblemDetails
`AddProblemDetails` (adds `traceId`, `code` for validation) + `AddExceptionHandler<AppExceptionHandler>()` +
`UseExceptionHandler()`. See [ADR-0006](../adr/0006-api-error-handling.md).

### Background services, caching, resilience, API versioning
Not used yet — deliberately (decisions [13](../engineering-decisions/13-caching-strategy.md),
[21](../engineering-decisions/21-resilience-and-failure-handling.md), [22](../engineering-decisions/22-deliberately-not-built.md)).
A background service will be justified by the outbox/reconciler in [ADR-0010](../adr/0010-payment-outside-the-order-transaction.md).

## Testing
xUnit v3 unit tests for pure domain code; `WebApplicationFactory<Program>` + Testcontainers PostgreSQL for HTTP tests
(`ApiFixture.cs`), which overrides configuration with `builder.UseSetting(...)` (connection string, test signing key,
relaxed rate limits).

## Interview questions
1. **Scoped vs singleton vs transient?** — Per request / one per app / new each injection; DbContext is scoped because
   it is not thread-safe and represents a unit of work.
2. **How does model validation work?** — Binding → DataAnnotations → `ModelState`; `[ApiController]` returns 400
   automatically.
3. **Middleware vs filters?** — Middleware sees every request (pipeline); MVC filters run around controller actions
   with access to action context.
4. **How do you secure a JWT setup?** — Short lifetimes, validated issuer/audience/algorithm, key from secrets, HTTPS,
   refresh rotation, no tokens in localStorage.
5. **Why CancellationToken?** — Stops wasted work (SQL, HTTP) when the client disconnects; important under load.
6. **Options pattern benefits?** — Typed, validated configuration, testable, reloadable (`IOptionsMonitor`).

## Official documentation
- https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/record
- https://learn.microsoft.com/en-us/dotnet/csharp/nullable-references
- https://learn.microsoft.com/en-us/dotnet/csharp/asynchronous-programming/
- https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/functional/pattern-matching
- https://learn.microsoft.com/en-us/aspnet/core/fundamentals/middleware/
- https://learn.microsoft.com/en-us/aspnet/core/fundamentals/dependency-injection
- https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/options
- https://learn.microsoft.com/en-us/aspnet/core/fundamentals/error-handling
- https://learn.microsoft.com/en-us/aspnet/core/security/authorization/policies
- https://learn.microsoft.com/en-us/aspnet/core/performance/rate-limit
- https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/health-checks
