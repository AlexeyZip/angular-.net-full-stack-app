# Learning catalog

A searchable map from **concepts** to **the code in this repository** that uses them. Pages are deliberately
concise and link to each other instead of repeating material; the trade-off discussions live in
[`docs/engineering-decisions/`](../engineering-decisions/README.md) and the short decision records in
[`docs/adr/`](../adr/README.md).

**How to read the labels**

- **Official** — a link to vendor documentation (angular.dev, rxjs.dev, ngrx.io, learn.microsoft.com, postgresql.org,
  MDN, typescriptlang.org). These are the authority. Their reachability has **not** been checked yet — status and the
  command to check them are in [`official-links.md`](official-links.md).
- **Explanation** — a personal summary written for this project; may simplify.
- **In this repo** — what *this* codebase does and why; it is a project decision, not a universal rule.

**Tip:** search for a term (`switchMap`, `linkedSignal`, `ExecuteUpdate`, `xmin`, `SameSite`) across the repository.
Most non-obvious code has a comment explaining *why*.

## Topic index

| Topic | Detail page | Key files | Related decisions |
| --- | --- | --- | --- |
| Angular | [angular.md](angular.md) | `apps/web/src/app/app.config.ts`, `app.routes.ts`, `features/**`, `libs/shared/ui` | [03](../engineering-decisions/03-modular-angular-vs-microfrontends.md), [05](../engineering-decisions/05-angular-dependency-injection-and-facades.md) |
| JavaScript & TypeScript | [javascript-typescript.md](javascript-typescript.md) | `libs/shared/data-access/src/lib/loadable.ts`, `api-error.ts`, `libs/state/contracts/src/lib/cart-persistence.ts` | [20](../engineering-decisions/20-domain-modeling-and-validation.md) |
| RxJS | [rxjs.md](rxjs.md) | `signals-cart.store.ts`, `cart.effects.ts`, `auth.interceptor.ts`, `auth-session.ts` | [04](../engineering-decisions/04-signals-vs-rxjs-vs-ngrx.md), [ADR-0007](../adr/0007-checkout-and-inventory-concurrency.md) |
| Signals | [signals.md](signals.md) | `libs/state/signals/**`, `product-page.ts` (`linkedSignal`), `confirm-dialog.ts` (`model`, `viewChild`) | [04](../engineering-decisions/04-signals-vs-rxjs-vs-ngrx.md), [ADR-0002](../adr/0002-frontend-state-strategy-and-boundaries.md) |
| NgRx | [ngrx.md](ngrx.md) | `libs/state/ngrx/**` | [04](../engineering-decisions/04-signals-vs-rxjs-vs-ngrx.md), [ADR-0003](../adr/0003-dual-signals-and-ngrx-implementations.md) |
| C# | [csharp-dotnet.md](csharp-dotnet.md#c-fundamentals) | `services/api/src/Shop.Api/Domain/**` | [20](../engineering-decisions/20-domain-modeling-and-validation.md) |
| ASP.NET Core | [csharp-dotnet.md](csharp-dotnet.md#aspnet-core) | `Program.cs`, `Features/**/*Controller.cs`, `Infrastructure/**` | [19](../engineering-decisions/19-api-design-and-error-handling.md), [ADR-0006](../adr/0006-api-error-handling.md) |
| Entity Framework Core | [ef-core-postgresql.md](ef-core-postgresql.md) | `Infrastructure/Persistence/**`, `CatalogService.cs`, `CheckoutService.cs` | [06](../engineering-decisions/06-ef-core-vs-dapper.md), [08](../engineering-decisions/08-database-transactions-and-concurrency.md), [ADR-0004](../adr/0004-ef-core-and-postgresql.md) |
| PostgreSQL | [ef-core-postgresql.md](ef-core-postgresql.md#postgresql) | `EntityConfigurations.cs`, `Migrations/` | [07](../engineering-decisions/07-postgresql-vs-sql-server.md), [09](../engineering-decisions/09-pagination-and-query-performance.md) |
| HTTP & REST | [topics.md](topics.md#http-and-rest) | controllers, `api-error.ts`, `proxy.conf.json` | [19](../engineering-decisions/19-api-design-and-error-handling.md) |
| Authentication & security | [topics.md](topics.md#authentication-and-security) | `Features/Auth/**`, `libs/shared/data-access/src/lib/auth/**`, `nginx.conf` | [11](../engineering-decisions/11-authentication-and-authorization.md), [17](../engineering-decisions/17-security-and-threat-modeling.md), [ADR-0005](../adr/0005-authentication-model.md) |
| Testing | [topics.md](topics.md#testing) | `services/api/tests/**`, `**/*.spec.ts`, `apps/web-e2e/**` | [14](../engineering-decisions/14-testing-strategy.md), [ADR-0008](../adr/0008-testing-approach.md) |
| Architecture | [topics.md](topics.md#architecture) | `Features/` folders, `libs/` layout | [01](../engineering-decisions/01-system-architecture.md), [02](../engineering-decisions/02-modular-monolith-vs-microservices.md), [10](../engineering-decisions/10-synchronous-vs-asynchronous-communication.md), [21](../engineering-decisions/21-resilience-and-failure-handling.md) |
| Docker & CI/CD | [topics.md](topics.md#docker-and-cicd) | `docker-compose.yml`, `**/Dockerfile`, `.github/workflows/ci.yml` | [18](../engineering-decisions/18-ci-cd-and-infrastructure-as-code.md), [ADR-0009](../adr/0009-local-development-environment.md) |
| Observability | [topics.md](topics.md#observability) | `Program.cs` (health, `traceId`), `appsettings.json` (JSON logs) | [16](../engineering-decisions/16-observability-and-monitoring.md) |
| Cloud & distributed (optional) | [topics.md](topics.md#cloud-and-distributed-systems) | — (design only) | [12](../engineering-decisions/12-ai-integration-and-rag.md), [13](../engineering-decisions/13-caching-strategy.md), [15](../engineering-decisions/15-cloud-and-azure-architecture.md), [ADR-0010](../adr/0010-payment-outside-the-order-transaction.md) |

## Suggested learning path

1. Run the app (root `README.md`), then read [01 system architecture](../engineering-decisions/01-system-architecture.md).
2. Follow one request end-to-end: catalog page → `CatalogStore` → `CatalogApi` → `CatalogController` →
   `CatalogService` → SQL. Pages: [angular](angular.md) → [signals](signals.md) → [csharp-dotnet](csharp-dotnet.md) →
   [ef-core-postgresql](ef-core-postgresql.md).
3. Study checkout as the "hard" flow: [rxjs](rxjs.md) (quote pipeline), [ADR-0007](../adr/0007-checkout-and-inventory-concurrency.md),
   [08 transactions](../engineering-decisions/08-database-transactions-and-concurrency.md).
4. Compare the two state implementations: [signals](signals.md) vs [ngrx](ngrx.md), then
   [04](../engineering-decisions/04-signals-vs-rxjs-vs-ngrx.md).
5. Interview practice: each page ends with questions and model answers; `.cursor/skills/interview-prep` turns them
   into a quiz.
