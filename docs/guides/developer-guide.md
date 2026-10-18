# Developer guide

A practical map of the repository for someone who wants to change it: what runs where, where code lives, how to add
the common kinds of change, how to verify them and what usually goes wrong. The *why* behind each design lives in
`docs/engineering-decisions/` and `docs/adr/`; this page is the *how*.

## 1. System map

```text
Browser
 ├─ apps/web (Angular 21, zoneless)         storefront + /admin; Signals or NgRx build
 │    └─ side panel → apps/assistant-mfe    <shop-assistant> custom element, loaded at runtime
 │
 └─ same origin: /api, /health, /mfe/assistant  (Angular dev proxy locally, nginx in containers)
        │
        ▼
services/api  Shop.Api (ASP.NET Core 10, EF Core 10)            PostgreSQL 17  database "shop"
 ├─ Features/{Catalog,Auth,Wishlist,Orders,Admin,Assistant,Shared}
 ├─ Domain/          entities enforce invariants
 ├─ Infrastructure/  Persistence (DbContext, migrations, seeder), Auth, ErrorHandling, Audit, Messaging (outbox)
 └─ outbox publisher ── POST /internal/events (X-Service-Key) ──▶ services/notifications   database "shop_notifications"
                                                                  (minimal API, idempotent inbox, simulated e-mails)
Assistant model: Mock (default) | OpenAI-compatible server, e.g. Ollama on the host (localhost:11434)
```

## 2. Ports and URLs

| What | Local (native) | Containers (`docker compose --profile full`) |
| --- | --- | --- |
| Web, Signals variant | `http://localhost:4200` (`npm run start:signals`) | `http://localhost:8080` |
| Web, NgRx variant | `http://localhost:4300` (`npm run start:ngrx`) | `http://localhost:8081` |
| API | `http://localhost:5080` (`--launch-profile http`), API docs `/scalar` | internal only, through nginx `/api` |
| Assistant remote | `http://localhost:4400/mfe/assistant/main.js` (`npx nx serve assistant-mfe`) | internal, through nginx `/mfe/assistant/` |
| Notifications | `http://localhost:5090` (`dotnet run --project services/notifications/src/Shop.Notifications`) | `127.0.0.1:5090` (internal API) |
| PostgreSQL | `localhost:5433` (`docker compose up -d postgres`) | same container |
| Ollama (optional) | `http://localhost:11434` | reached as `host.docker.internal:11434` |

Development accounts and the payment simulator tokens are listed in the root `README.md`.

## 3. Running combinations

| Goal | Steps |
| --- | --- |
| Shop only | `docker compose up -d postgres` → API `dotnet run --project services/api/src/Shop.Api --launch-profile http` → `npm run start:signals` |
| + assistant panel | additionally `npx nx serve assistant-mfe` (the web dev server proxies `/mfe/assistant` to it) |
| + real model | `ollama pull qwen2.5:7b`, start the API with `--launch-profile http-ollama` instead of `http` |
| + notifications natively | start `services/notifications` (port 5090), and start the API with `$env:Notifications__BaseUrl="http://localhost:5090"; $env:Notifications__ServiceKey="DEV-ONLY-notifications-service-key"`. Without `BaseUrl` events are written but not published (KI-18). |
| Everything in containers | `docker compose --profile full up -d --build`; real model: `ASSISTANT_PROVIDER=OpenAiCompatible` in `.env` |

## 4. Where to put a change

| Change | Location | Rules |
| --- | --- | --- |
| New API endpoint | `services/api/src/Shop.Api/Features/<Module>/` (controller + service + `*Contracts.cs`) | records for DTOs, validation attributes on constructor parameters, `CancellationToken` everywhere, errors as `AppException` with a stable `code`; skill `.cursor/skills/aspnet-endpoint` |
| Business rule | `Domain/` entity method | entities guard their invariants; services orchestrate |
| Schema | entity + `Infrastructure/Persistence/EntityConfigurations.cs` + migration | `dotnet ef migrations add <Name> --project src/Shop.Api --output-dir Infrastructure/Persistence/Migrations`; never edit an applied migration; skill `ef-migration` |
| HTTP client / API models (web) | `libs/shared/data-access/src/lib/api-clients.ts`, `models.ts` | the only place with `HttpClient` for the shop |
| Shared state | contract in `libs/state/contracts`, then **both** `libs/state/signals` and `libs/state/ngrx`, plus `state-contract-suite.ts` | features inject the contract only; skill `state-feature` |
| UI component | `libs/shared/ui` if presentational, otherwise `apps/web/src/app/features/<feature>/` | standalone, `OnPush`, signal inputs/outputs, selector prefix `shop` |
| Integration event | `Infrastructure/Messaging/IntegrationEvents.cs` + sample in `services/contracts/events` + consumer | recipe: `outbox-and-notifications-service.md` §6 |
| Assistant behaviour | `Features/Assistant/*` (server), `apps/assistant-mfe` (UI) | keep the output boundary; walkthrough: `assistant-implementation.md` |

Boundaries are enforced by lint (`eslint.config.mjs`): `type:ui` cannot use data-access or state, features cannot
import a state implementation (only `apps/web/src/app/state/*.providers*.ts` may), `type:remote` depends on nothing.

## 5. Following a request through the code

Checkout, as the reference path:
1. `apps/web/src/app/features/checkout/checkout-page.ts` — typed form, one idempotency key per attempt.
2. `libs/shared/data-access/src/lib/api-clients.ts` — `POST /api/orders` with the `Idempotency-Key` header;
   `auth/auth.interceptor.ts` adds the bearer token and refreshes it once on 401.
3. `services/api/src/Shop.Api/Features/Orders/OrdersController.cs` → `CheckoutService.cs` — one transaction:
   re-price from the database, conditional stock `UPDATE`, `PaymentSimulator`, order insert, **outbox row**, commit.
4. `Infrastructure/Messaging/OutboxPublisher.cs` → `services/notifications` — later, at least once.
5. Errors: `Infrastructure/ErrorHandling/AppExceptionHandler.cs` → ProblemDetails with `code` and `traceId` → the
   page maps `code` to a message and a recovery action.

## 6. Verification matrix

| You changed | Run (and report only what you ran) |
| --- | --- |
| Frontend | `npx nx run-many -t lint test`; `npx nx run web:build:production` (+ `production-ngrx` for state changes) |
| Assistant remote | `npx nx run-many -t lint test -p assistant-mfe`; `npx nx run assistant-mfe:build:production` (style budget 4 kB warning per component) |
| Backend | in `services/api`: `dotnet build Shop.sln`, `dotnet test --project tests/Shop.Api.UnitTests`, `dotnet test --project tests/Shop.Api.IntegrationTests` (Docker) |
| Schema | `dotnet ef migrations has-pending-model-changes --project src/Shop.Api` (and `--project src/Shop.Notifications` in `services/notifications`) |
| Notifications | in `services/notifications`: `dotnet test --project tests/Shop.Notifications.Tests` |
| User journeys | `npx nx e2e web-e2e` (starts API and dev servers or reuses running ones; 2 workers, `E2E_WORKERS` overrides); one spec: `npx nx e2e web-e2e -- --grep assistant` |

## 7. Configuration and secrets

- Repository files contain only `DEV-ONLY-` placeholders. Real values come from user secrets
  (`dotnet user-secrets set ...` in the project folder) or environment variables (`Section__Key`).
- `appsettings.json` is the production-safe default (empty secrets, the API refuses to start without a signing key);
  `appsettings.Development.json` holds local values; compose overrides through `.env` (template `.env.example`).
- Options are validated at start-up (`ValidateOnStart`); a misconfiguration stops the process with a clear message
  instead of failing on the first request.
- Never put tokens, passwords or personal data into NgRx/Signals state or `localStorage`. The assistant conversation
  is component state for the same reason.

## 8. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `npm install` fails inside arborist | npm 10.9 bug — use npm 11 (KI-02) |
| `dotnet test tests/...` says "Zero tests ran" | Microsoft Testing Platform needs `dotnet test --project tests/...` (KI-05) |
| Integration tests fail with `DockerUnavailableException` | start Docker, or set `SHOP_TEST_CONNECTION_STRING` (database name must contain `test`) |
| 429 during E2E against containers | raise `API_AUTH_PERMIT_LIMIT` / `API_CHECKOUT_PERMIT_LIMIT` for that run (KI-07) |
| Port already in use (4200/4300/4400/5080) | a dev server from an earlier run is still alive; Playwright reuses running servers locally, so stop stale ones if they serve old code |
| Assistant panel says "unavailable" locally | `npx nx serve assistant-mfe` is not running (port 4400) |
| Assistant answers "Answered by: Mock" | the API runs with the `http` profile; use `http-ollama` or `ASSISTANT_PROVIDER=OpenAiCompatible` |
| First real-model answer takes about a minute | the model is loading (KI-16); keep Ollama running, warm-up is on in the Ollama profiles |
| Ollama returns no choices for a hand-written JSON file | PowerShell 5 `Out-File -Encoding utf8` writes a BOM; use `[IO.File]::WriteAllText` |
| Validation attributes on records cause 500 | put them on constructor parameters, not `[property: ...]` (decision 20) |
| An inline script/style is blocked in the container build | nginx CSP `script-src 'self'`; production builds disable critical-CSS inlining for this reason |
| Outbox rows stay unprocessed | `Notifications:BaseUrl` not set or the service is down; check `last_error` (outbox guide §8) |
| Many "E2E …" products in the local catalog | E2E uses the same dev database (KI-20) |
| Random E2E journeys time out with a spinner or a disabled button | the machine is saturated; keep 2 workers (KI-21) and close other heavy processes (for example a loaded Ollama model) |

## 9. Documentation map

| Need | Where |
| --- | --- |
| Current state, commands and results | `docs/project/PROGRESS.md` |
| What is planned / done | `docs/project/IMPLEMENTATION_BACKLOG.md` |
| Known limitations | `docs/project/KNOWN_ISSUES.md` |
| Requirement → code → test | `docs/project/REQUIREMENTS_TRACEABILITY.md` |
| Why a design was chosen (long form) | `docs/engineering-decisions/01…22` |
| Short decision records | `docs/adr/` |
| How a feature is built end to end | `docs/guides/` |
| Which design patterns are used where, and why | `docs/guides/design-patterns.md` |
| Learning material and interview questions | `docs/learning/` |
| AI agent workflow (rules, skills, subagents) | `AGENTS.md`, `docs/ai-workflow.md` |
