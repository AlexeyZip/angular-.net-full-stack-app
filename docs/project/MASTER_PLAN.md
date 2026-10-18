# Master plan

Source specification: `MASTER-PROMPT.md` (repository root). This plan is the condensed, current interpretation of it.
Status of individual tasks lives in `IMPLEMENTATION_BACKLOG.md`; evidence in `PROGRESS.md` and `REQUIREMENTS_TRACEABILITY.md`.

## 1. Product scope

**NorthwindShop** — a production-inspired e-commerce reference application used for learning and interviews.

- **Storefront:** catalog (search, filters, sorting, server pagination), product detail with reviews, cart with server
  quotes, checkout with a local payment simulator, order history and cancellation, wishlist, account (register,
  sign in, profile).
- **Administration** (same Angular app, `/admin`, role-protected): dashboard KPIs, product create/edit with
  optimistic concurrency, relative inventory adjustments, categories, order status workflow, audit log.
- **Business integrity:** server-authoritative prices and totals, no overselling, idempotent checkout, an order state
  machine, audit records for administrative changes.
- **Out of scope for the core:** real payments, shipping providers, taxes, multi-currency, multi-tenant, email.
  See `docs/engineering-decisions/22-deliberately-not-built.md`.

## 2. Repository architecture

One Git monorepo, two toolchains, each used natively:

| Area | Location | Tooling |
| --- | --- | --- |
| Angular app | `apps/web` | Nx + Angular CLI builders (`@angular/build`) |
| Frontend libraries | `libs/shared/{ui,data-access}`, `libs/state/{contracts,signals,ngrx}` | Nx, Vitest (Analog) |
| E2E tests | `apps/web-e2e` | Playwright via Nx `run-commands` |
| API | `services/api/src/Shop.Api` | `dotnet` CLI, `Shop.sln` |
| API tests | `services/api/tests/{Shop.Api.UnitTests,Shop.Api.IntegrationTests}` | xUnit v3, Testcontainers |
| Infrastructure | `docker-compose.yml`, `*/Dockerfile`, `.github/workflows/ci.yml` | Docker, GitHub Actions |
| Docs | `docs/` | Markdown |

Nx does not wrap .NET: the backend is built and tested with `dotnet` directly (also in CI). Rationale:
`docs/engineering-decisions/01-system-architecture.md`.

## 3. Technology choices (verified versions in this workspace)

- Angular 21.2 (standalone, zoneless, Signals, OnPush), TypeScript 5.9 strict, RxJS 7.8, NgRx 21.1, Nx 23.3,
  Vitest 4.1, Playwright 1.64, ESLint 9 + angular-eslint 21.4.
- .NET SDK 10.0.401 (LTS), ASP.NET Core controllers, EF Core 10 + Npgsql, xUnit v3, Testcontainers.
- PostgreSQL 17 (Docker image `postgres:17-alpine`).

## 4. Phases and dependencies

| Phase | Content | Depends on | State |
| --- | --- | --- | --- |
| 1 Foundation | repo, Nx workspace, solution, compose, tracking files | — | done |
| 2 Core vertical slices | catalog → auth → cart/checkout/orders → admin, API + UI + tests | 1 | done; verified by integration tests and E2E |
| 3 Dual state | contracts, Signals and NgRx variants, shared contract test suite, build switch | 2 (catalog/cart/wishlist UI) | done; verified by contract tests and E2E in both variants |
| 4 Quality | lint boundaries, E2E suite, a11y, Docker images, CI | 2, 3 | done except CI on GitHub and automated a11y (A-07) |
| 5 Backend depth | observability, caching, outbox, performance checks | 2 | not started |
| 6 Advanced (optional) | SignalR, microservices/microfrontend examples, AI/RAG, Azure IaC | 5 | design docs only |
| 7 Final verification | run IT + E2E + compose, update all statuses | KI-01 resolved | done (locally and in CI) |

## 5. Verification strategy

- **Frontend:** `npx nx run-many -t lint test`, both production builds, bundle check that the Signals build has no NgRx.
- **State variants:** one contract suite (`runStateContractSuite`) executed against both implementations.
- **Backend:** `dotnet build` with warnings as errors, unit tests (no Docker), integration tests on real PostgreSQL
  through `WebApplicationFactory` + Testcontainers, `dotnet ef migrations has-pending-model-changes`.
- **End-to-end:** Playwright against the real stack, every test run once per state variant.
- Nothing is reported as passing unless the command was executed in this environment or in CI.

## 6. Known constraints

- Docker was unavailable in session 1 (KI-01, resolved in session 2): IT, E2E and compose now run locally.
- CI runs on GitHub (`AlexeyZip/angular-.net-full-stack-app`); the first run was green.
- No cloud resources or paid services may be provisioned without explicit approval.

## 7. Advanced topics — intended priority

1. OpenTelemetry traces/metrics (cheap, high learning value).
2. Transactional outbox + background worker for order events (prerequisite for any async integration).
3. SignalR order-status notifications.
4. Output caching for catalog reads.
5. Extracting one service (e.g. catalog search) only as a documented experiment.
6. AI product assistant with RAG over product data (local embedding model or explicitly approved provider).
7. Azure Bicep templates (documentation and `what-if` only unless deployment is approved).
