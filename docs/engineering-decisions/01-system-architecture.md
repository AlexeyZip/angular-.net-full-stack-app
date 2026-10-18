# 01 — System architecture

## 1. Problem

Build a realistic, runnable e-commerce system that a single developer can understand end to end, while still
demonstrating the concerns of production systems: integrity of money and stock, security, testability, and two
competing frontend state approaches.

## 2. Context and constraints

- One learner/maintainer; local machine first; no cloud spend.
- Must show Angular (Signals, RxJS, NgRx) and .NET (ASP.NET Core, EF Core) in depth.
- Requirement: single Git monorepo; Nx for the Angular side; native `dotnet` for .NET.

## 3. Options considered

1. SPA + one API + one database (modular monolith).
2. SPA + several microservices (catalog, orders, identity) + message broker.
3. Server-rendered app (Razor/Blazor) without a separate SPA.

## 4. Chosen approach

```text
Browser ── Angular SPA (apps/web, one of two state variants)
   │  same-origin /api (dev-server proxy or nginx)
   ▼
ASP.NET Core API (services/api/src/Shop.Api) ── modular monolith
   Features/{Catalog,Auth,Orders,Wishlist,Admin} → Domain → Infrastructure (EF Core, auth, errors, audit)
   │  Npgsql / EF Core 10
   ▼
PostgreSQL 17 (constraints, indexes, pg_trgm)
```

Monorepo layout and tool ownership:

| Part | Owner tool | Why |
| --- | --- | --- |
| `apps/*`, `libs/*` | Nx (`nx.json`, `project.json`) | caching, project graph, module-boundary lint, generators |
| `services/api` | `dotnet` CLI (`Shop.sln`) | first-class .NET tooling (build, test, EF migrations, analyzers) |
| Infra | Docker Compose, GitHub Actions | standard, local-first |

## 5. Why

- One deployable API keeps transactions local: checkout updates stock and inserts an order in **one database
  transaction** (`CheckoutService.cs`) — the hardest correctness problem stays simple.
- Same-origin SPA + API avoids CORS and lets the refresh token be a `SameSite=Strict` cookie.
- Nx adds value on the TypeScript side (six projects with boundaries); forcing it onto .NET would wrap `dotnet`
  commands without adding caching or graph benefits that MSBuild does not already provide.

## 6. Trade-offs

- A monolith scales as one unit; a hot path (catalog reads) cannot be scaled independently.
- Two toolchains in one repo: contributors need Node **and** .NET; CI has separate jobs.

## 7. Simpler alternatives

A server-rendered Razor Pages app would be simpler and fully adequate for a small shop. It was insufficient here
because learning Angular state management is an explicit goal.

## 8. Rejected alternatives

- **Microservices** — distributed transactions/sagas for checkout, eventual consistency, more infra; no team or
  scaling need justifies it (see 02).
- **Nx .NET plugin** — would hide the native CLI the learner must master and is not required for correctness.

## 9. Implementation references

- `apps/web/src/app/app.config.ts` — app-wide providers (router, HTTP + interceptor, state variant, session restore).
- `apps/web/src/app/app.routes.ts` — lazy feature routes; `/admin` behind `canMatch`.
- `services/api/src/Shop.Api/Program.cs` — composition root and middleware order.
- `docker-compose.yml`, `apps/web/proxy.conf.json`, `apps/web/nginx.conf` — same-origin wiring.

## 10. Code

```ts
// apps/web/src/app/app.config.ts
provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
provideAppState(),                                   // Signals or NgRx, chosen by fileReplacements
provideAppInitializer(() => firstValueFrom(inject(AuthSession).restore())),
```

```csharp
// services/api/src/Shop.Api/Program.cs — pipeline order matters
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapControllers();
```

## 11. Failure scenarios and limitations

- Database down → `/health/ready` fails, API returns 500 ProblemDetails; the SPA shows error states with retry.
- API down → the SPA shell still loads (static), every data view shows its error state.
- Single region/instance; in-memory rate limiting (KI-13).

## 12. Testing implications

The monolith allows full-stack integration tests in-process (`WebApplicationFactory` + real PostgreSQL) and E2E
tests that start exactly three processes (API + two dev servers). See 14.

## 13. Performance and security

- One network hop SPA → API → DB; projections avoid over-fetching (09).
- Same-origin deployment shrinks the attack surface (no CORS allow-list by default, `Cors:AllowedOrigins` empty).

## 14. When a different approach is better

Several teams owning separate domains with independent release cadences, or a component with radically different
scaling (e.g. search) → extract services along the existing `Features/*` seams.

## 15. Interview explanation

"It's a modular monolith: an Angular SPA talking to one ASP.NET Core API over same-origin HTTP, backed by PostgreSQL.
Modules are folders with clear seams, so they could be extracted later, but today checkout can update stock and create
the order in one ACID transaction — no saga needed. The monorepo uses Nx where it helps, for the TypeScript projects
and their boundaries, and the native dotnet CLI for .NET."

## 16. Evidence and confidence

*Verified:* builds of both stacks, unit tests, lint boundaries (`docs/project/PROGRESS.md`).
*Verified (session 2):* the running system against PostgreSQL — integration tests 40/40, Playwright 46/46 for both
state variants on the dev servers and again against the Docker Compose stack (nginx + production builds).
Confidence: high.
