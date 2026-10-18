# NorthwindShop — Full-Stack Engineering Reference Platform

A production-inspired e-commerce application (storefront + admin portal) built to learn and explain real-world
engineering: **Angular 21** (Signals, RxJS, NgRx), **ASP.NET Core / .NET 10**, **EF Core 10**, **PostgreSQL 17**.

The Angular app ships in **two interchangeable state-management variants** — Angular Signals services and classic
NgRx Store — behind one set of contracts, selected at build time. Both run the same tests.

> **Status:** see [`docs/project/PROGRESS.md`](docs/project/PROGRESS.md) and
> [`docs/project/REQUIREMENTS_TRACEABILITY.md`](docs/project/REQUIREMENTS_TRACEABILITY.md). All local checks
> (unit, integration, E2E, Docker Compose) have been executed; the GitHub Actions workflow has not run yet (no remote) —
> see [`KNOWN_ISSUES.md`](docs/project/KNOWN_ISSUES.md).

## Repository layout

```text
.
├── apps/
│   ├── web/                    Angular storefront + /admin portal (Nx project "web")
│   └── web-e2e/                Playwright end-to-end tests, run per state variant (Nx project "web-e2e")
├── libs/
│   ├── shared/ui/              Presentational components, design tokens, themes         (type:ui)
│   ├── shared/data-access/     Typed API clients, auth session, interceptor, guards     (type:data-access)
│   └── state/
│       ├── contracts/          Abstract stores (DI tokens) + shared pure logic + test suite (type:state-contracts)
│       ├── signals/            Signals implementation                                    (type:state-impl)
│       └── ngrx/               NgRx Store/Effects/Entity implementation                  (type:state-impl)
├── services/api/               .NET solution (native dotnet CLI; not driven by Nx)
│   ├── Shop.sln
│   ├── src/Shop.Api/           ASP.NET Core API: Domain/, Features/<module>/, Infrastructure/
│   └── tests/                  Shop.Api.UnitTests (no Docker), Shop.Api.IntegrationTests (real PostgreSQL)
├── docs/
│   ├── project/                Plan, backlog, progress, known issues, traceability
│   ├── engineering-decisions/  Decision handbook (01–22)
│   ├── adr/                    Architecture Decision Records
│   └── learning/               Topic catalog with interview Q&A
├── docker-compose.yml          PostgreSQL (+ optional full stack profile)
├── .github/workflows/ci.yml    CI: frontend, backend, E2E
└── AGENTS.md, .cursor/         Instructions for AI coding agents
```

Frontend and backend dependencies are separate: `package.json`/`package-lock.json` at the root for Node,
NuGet `PackageReference`s in the `.csproj` files, pinned SDK in `services/api/global.json`.

## Prerequisites

| Tool | Version used | Notes |
| --- | --- | --- |
| Node.js | 22.12+ (or 20.19+, 24+) | |
| npm | **11** | npm 10.9.0 fails on this lockfile (KI-02): `npm install -g npm@11` or prefix commands with `npx -y npm@11` |
| .NET SDK | 10.0.401 (see `services/api/global.json`) | |
| Docker | any recent | for PostgreSQL, integration tests (Testcontainers) and the full-stack profile |

## Quick start (local development)

```powershell
# 1. Dependencies
npm ci
cd services/api; dotnet tool restore; dotnet restore; cd ../..

# 2. Database (PostgreSQL 17 on localhost:5433)
docker compose up -d postgres

# 3. API on http://localhost:5080 — applies migrations and seeds demo data in Development
dotnet run --project services/api/src/Shop.Api --launch-profile http

# 4. Web app (another terminal) — the dev server proxies /api to the API
npm run start:signals     # http://localhost:4200  (Signals variant)
npm run start:ngrx        # http://localhost:4300  (NgRx variant)
```

The footer of every page shows which variant is running (`State: Signals` / `State: NgRx`).
Interactive API docs (Development only): <http://localhost:5080/scalar>.

### Development accounts (seeded only in Development)

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@shop.local` | `DevOnly-Admin-2026` |
| Customer | `alice@shop.local`, `bob@shop.local`, `carol@shop.local` | `DevOnly-Customer-2026` |

### Payment simulator

No real payment processing exists. At checkout choose a test token:
`tok_visa` (approved), `tok_declined` (HTTP 402), `tok_unavailable` (provider outage, HTTP 503).

## Commands

### Frontend (Nx, run from the repository root)

| Purpose | Command |
| --- | --- |
| Serve Signals / NgRx | `npx nx serve web` · `npx nx serve web --configuration=development-ngrx` |
| Production build, Signals | `npx nx run web:build:production` → `dist/apps/web` |
| Production build, NgRx | `npx nx run web:build:production-ngrx` → `dist/apps/web-ngrx` |
| Unit tests (all projects) | `npx nx run-many -t test` |
| Unit tests (one project) | `npx nx test state-ngrx` |
| Lint (incl. module boundaries) | `npx nx run-many -t lint` |
| Project graph | `npx nx graph` |

### Backend (native dotnet, run from `services/api`)

| Purpose | Command |
| --- | --- |
| Build | `dotnet build Shop.sln` |
| Unit tests (no Docker) | `dotnet test --project tests/Shop.Api.UnitTests` |
| Integration tests (Docker) | `dotnet test --project tests/Shop.Api.IntegrationTests` |
| Integration tests (existing DB) | `$env:SHOP_TEST_CONNECTION_STRING="Host=localhost;Port=5433;Database=shop_test;Username=shop;Password=shop_dev_password"` then the command above (DB name must contain `test`) |
| Add a migration | `dotnet ef migrations add <Name> --project src/Shop.Api --output-dir Infrastructure/Persistence/Migrations` |
| Apply migrations | `dotnet ef database update --project src/Shop.Api` (Development also applies them on startup) |
| Migration SQL script | `dotnet ef migrations script --idempotent --project src/Shop.Api` |
| Check model vs migrations | `dotnet ef migrations has-pending-model-changes --project src/Shop.Api` |

### End-to-end tests (Playwright)

```powershell
docker compose up -d postgres
npm run e2e:install-browsers      # one-time Chromium download
npm run e2e                       # both variants; starts API + both dev servers or reuses running ones
npm run e2e:signals               # one variant only
npm run e2e:ngrx
```

Reports and traces: `dist/.playwright/web-e2e/`.

### Full stack in containers

```powershell
copy .env.example .env            # optional overrides
docker compose --profile full up --build
# Signals: http://localhost:8080   NgRx: http://localhost:8081   (nginx proxies /api to the API container)
```

This profile runs the API in the Development environment (seed data, dev signing key). It is a local demo, not a
production deployment.

## Where to start reading

1. [`docs/engineering-decisions/01-system-architecture.md`](docs/engineering-decisions/01-system-architecture.md) — the big picture.
2. Follow one request: `apps/web/src/app/features/checkout/checkout-page.ts` →
   `libs/shared/data-access/src/lib/api-clients.ts` → `services/api/src/Shop.Api/Features/Orders/OrdersController.cs` →
   `CheckoutService.cs` → PostgreSQL.
3. [`04-signals-vs-rxjs-vs-ngrx.md`](docs/engineering-decisions/04-signals-vs-rxjs-vs-ngrx.md) — the same cart in two state libraries.
4. [`08-database-transactions-and-concurrency.md`](docs/engineering-decisions/08-database-transactions-and-concurrency.md).
5. [`docs/learning/README.md`](docs/learning/README.md) — topic index and interview questions.

## Security notes

- All secrets in the repository are **development-only placeholders** (`DEV-ONLY-...`). Production configuration must
  come from environment variables or a secret store; `appsettings.json` ships with empty secrets and the API refuses to
  start without a signing key.
- Access tokens live only in memory; the refresh token is an HttpOnly, path-scoped cookie. Nothing sensitive is stored
  in NgRx/Signals state or `localStorage`.
