# Progress log

## Current status (2026-10-18, end of session 3)

**Phase:** 1–4 and 7 done; advanced items A-02, A-05, A-09, A-10 done (outbox, notifications microservice, AI
assistant, assistant microfrontend in a side panel).

Local checks at the end of session 3: backend unit 88/88, integration 62/62 (PostgreSQL 17, Testcontainers),
notifications 14/14, frontend unit 120/120 in 7 projects, lint 8 projects, production builds of `web`, `web-ngrx` and
`assistant-mfe`, Playwright 50/50 (both variants, dev servers) twice in a row. **Session-3 work is not committed**
(not requested); the last pushed commit is `e65cd54`, whose GitHub Actions run succeeded:
<https://github.com/AlexeyZip/angular-.net-full-stack-app/actions/runs/39149844984>. CI has not run the session-3
changes yet.

## Session 3 — 2026-10-18 (advanced features, assistant as a chat, developer documentation)

### Delivered

- **Transactional outbox + notifications microservice** (A-02, A-09): `OutboxMessage` written in the checkout and
  status-change transactions, `OutboxPublisher` (claim with `FOR UPDATE SKIP LOCKED` + lease, backoff, dead-letter),
  `services/notifications` (own database, idempotent inbox, `X-Service-Key`), contract samples in
  `services/contracts/events`. ADR-0012, guide `docs/guides/outbox-and-notifications-service.md`.
- **AI assistant (RAG)** (A-05): rule-based parser, lexical retrieval with SQL filters, prompt with sanitized product
  blocks, `IChatModel` (Mock default, OpenAI-compatible for a local Ollama `qwen2.5:7b`), citation filter, price guard,
  timeouts / retry / circuit breaker, degraded mode. ADR-0013.
- **Assistant microfrontend** (A-10): `apps/assistant-mfe` as the `<shop-assistant>` custom element, loaded at runtime
  into a side panel on every page. ADR-0011.
- **Chat format:** a scrollable conversation (`role="log"`), Enter to send, retry, "New conversation", example
  questions; stateless follow-ups — the client sends at most 4 earlier turns as `{question, productIds}`, never answer
  text; the server re-reads those products with the current filters.
- **Overlay panel:** the panel is `position: fixed` above the page (no layout shift) with a slide/fade transition
  (320 ms open, 280 ms close, off for `prefers-reduced-motion`); closed state is `visibility: hidden` + `inert`.
- **Documentation for developers:** `docs/guides/` (assistant implementation walkthrough with trade-offs and a
  build-it-yourself recipe, outbox guide, developer guide, design patterns and principles with code from the
  repository — `docs/guides/design-patterns.md`), ADR-0011…0013, decisions 02/03/10/12/21/22 updated,
  KI-16…KI-21, traceability and backlog updated, README updated.

### Defects found and fixed in session 3

- **Assistant retrieval cut off the best match** once a common word matched more than 40 products (the SQL candidate
  order ignored how many terms matched). Fixed: candidates ordered by matched-term count; new IT fails on the old order
  and passes on the new one.
- **Flaky full E2E suite** with 8 local workers (KI-21): requests exceeded the 10 s expect timeout under load.
  Playwright now uses 2 workers (`E2E_WORKERS` overrides).
- Earlier in the session: XML doc `param` tags failed the build (CS1573 as error); an integration test collided with
  other tests' "kettle" products; the widget's component styles exceeded the 4 kB budget — all fixed.

### Commands executed and results (session 3, final state)

| Command (working directory) | Result |
| --- | --- |
| `dotnet build Shop.sln` (`services/api`) | ✅ 0 errors (warnings are errors) |
| `dotnet test --project tests/Shop.Api.UnitTests` | ✅ 88/88 |
| `dotnet test --project tests/Shop.Api.IntegrationTests` | ✅ 62/62 |
| new retrieval IT against the old ordering (temporary revert) | ❌ fails as expected → restored fix ✅ passes |
| `dotnet test --project tests/Shop.Notifications.Tests` (`services/notifications`) | ✅ 14/14 |
| `dotnet ef migrations has-pending-model-changes --project src/Shop.Notifications` | ✅ no changes |
| `npx nx run-many -t lint test` | ✅ 8 projects lint; 120 tests (assistant-mfe 9, web 28, contracts 19, signals 15, ngrx 21, ui 13, data-access 15) |
| `npx nx run web:build:production` / `production-ngrx` / `assistant-mfe:build:production` | ✅ initial 400.49 kB (107.60 kB transferred) / 444.56 kB (120.45 kB) / 215.88 kB (61.40 kB), no budget warnings |
| `npx nx e2e web-e2e` with 8 workers (default before the fix) | ❌ 3/50, 4/18 (rerun of two specs), 2/50 failed — random journeys, request pending > 10 s |
| `npx nx e2e web-e2e -- --project signals admin.spec.ts --workers=1` | ✅ 18/18 |
| `npx nx e2e web-e2e -- --workers=2` | ✅ 50/50 (2.3 min) |
| `npx nx e2e web-e2e` with the new default (2 workers) | ❌ assistant spec failed in both variants → retrieval defect above; after the fix ✅ 50/50 twice (2.2 and 2.3 min) |
| Browser check on `http://localhost:4200` (dev server, Mock model) | ✅ `main` keeps its position (left 182.5 px, width 1200 px) when the panel opens; panel `position: fixed`, 420 px; transitions observed: open `transform 320ms cubic-bezier(0.16, 1, 0.3, 1)` + `opacity 200ms`, close `transform 280ms` + `opacity` + delayed `visibility` |
| SQL log of `POST /api/assistant/ask` | ✅ `ORDER BY (SELECT count(*) FROM unnest(@patterns0) ...) DESC, ...` |
| Manual run with Ollama `qwen2.5:7b` through compose (:8080), before the overlay change | ✅ chat with a follow-up question answered from the catalog |

Not run in session 3: rebuild of the compose images `web` / `web-ngrx` (they still contain the pre-overlay panel), E2E
against the compose stack, CI on the session-3 changes, A-07 accessibility audit, A-08 rate-limit test, external link
check (KI-06).

## Session 2 — 2026-10-18 (Docker available)

The first database-backed runs found three real defects and four test-side races; all are fixed.

### Defects found and fixed

- **Every validated request returned 500** (32/40 integration tests red). Request records declared validation as
  `[property: Required]`; MVC rejects validation metadata on record *properties* and throws on each request. All 35
  attributes in `Features/*/*Contracts.cs` moved to the constructor parameters. Lesson recorded in decision 20.
- **Duplicate element ids in form errors** (E2E strict-mode violation). `FieldError` had an `id` input, and Angular kept
  the static `id` attribute on the host too, so two elements shared the id `aria-describedby` points to. The input was
  removed (the id lives on the host only); new test `libs/shared/ui/src/lib/field-error.spec.ts`.
- **nginx dropped the security headers (CSP etc.) on HTML and assets**: a `location` with its own `add_header`
  cancels inherited ones. Headers moved to `apps/web/nginx-security-headers.conf`, included in every block (KI-04).

### Test robustness fixes (no assertion weakened)

- `getByLabel('Address')` also matched "Shipping address" → `getByRole('textbox', { name: 'Address' })`.
- Journey 3 (infinite scroll): on a tall viewport the placeholder was already gone → scroll to the page end.
- Wishlist: the reload raced the `PUT` → wait for the 204 response, then reload.
- Journey 12 (admin order): the click raced the debounced search and the lazy route → wait for the filtered row and
  the detail heading.

### Other changes

- `docker-compose.yml`: `API_AUTH_PERMIT_LIMIT` / `API_CHECKOUT_PERMIT_LIMIT` (default 10) so the E2E suite can run
  against the containers (KI-07); documented in `.env.example`.
- Documentation: evidence sections of decisions, ADRs, traceability, backlog and known issues updated to these
  results; KI-01 and KI-04 resolved.

### Commands executed and results

| Command (working directory) | Result |
| --- | --- |
| `docker compose up -d postgres` | ✅ healthy (127.0.0.1:5433) |
| `dotnet build Shop.sln` (`services/api`) | ✅ 0 warnings, 0 errors |
| `dotnet test --project tests/Shop.Api.IntegrationTests` | ❌ 32/40 failed (500, record validation) → after the fix ✅ 40/40 |
| `dotnet test --project tests/Shop.Api.UnitTests` | ✅ 42/42 |
| `dotnet ef migrations has-pending-model-changes --project src/Shop.Api` (after the DTO change) | ✅ no changes |
| `npx playwright install chromium` | ✅ |
| `npx playwright test ... --project signals` / `--project ngrx` | ✅ 23/23 each (after the fixes above) |
| `npx nx e2e web-e2e` (dev servers started by Playwright) | ✅ 46/46, run twice (before and after the journey-12 fix) |
| `docker compose --profile full build` | ✅ api, web, web-ngrx images built |
| `docker compose --profile full up -d` | ✅ postgres + api healthy, web (8080) and web-ngrx (8081) up |
| `curl.exe` smoke through nginx | ✅ `/` 200, `/api/catalog/products` 200, `/health/ready` Healthy, SPA deep link → index with `no-cache` |
| `curl.exe -D -` security headers (after the nginx fix) | ✅ CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` on HTML, a JS asset (`immutable`) and an API response |
| E2E against compose (`E2E_API_URL`/`E2E_SIGNALS_URL`=:8080, `E2E_NGRX_URL`=:8081, raised limits) | ✅ 46/46; `admin.spec.ts --repeat-each 3` ✅ 54/54 |
| `api` container recreated with default rate limits | ✅ |
| `npx nx run-many -t lint test` | ✅ 7 projects lint; 101 tests (contracts 19, data-access 15, ui 13, signals 15, ngrx 21, web 18) |
| `npx nx run web:build:production` / `production-ngrx` | ✅ both; Signals build contains 0 NgRx files |
| `npx tsc -p apps/web-e2e/tsconfig.json` | ✅ |
| `git push -u origin main` (user-provided remote, at the user's request) | ✅ |
| GitHub Actions `CI` run 39149844984 on `e65cd54` | ✅ success: Backend, Frontend, E2E jobs |

Not run: external link check (KI-06), automated accessibility audit (A-07),
visual check of the dark theme, a test for the rate limits (A-08).

## Session 1 — 2026-10-18

### Completed

- **Foundation:** Git repository (branch `main`, no commits — committing was not requested), Nx 23.3 workspace,
  `.gitignore`, `.editorconfig`, `docker-compose.yml` (PostgreSQL 17 on host port 5433).
- **Backend** (`services/api`): modular-monolith ASP.NET Core API with catalog, auth (JWT + rotating HttpOnly refresh
  cookie + CSRF header), wishlist, cart quote, checkout (conditional stock UPDATE, idempotency key + fingerprint,
  payment simulator), orders with a state machine, reviews, admin (products with explicit `Version` concurrency token,
  relative stock adjustments, categories, orders, dashboard, audit log), ProblemDetails errors, rate limiting,
  health checks, development seeder, initial migration `20261018144630_InitialCreate`.
- **Frontend** (`apps/web`, `libs/*`): zoneless standalone Angular app; data-access library; UI kit with design
  tokens and dark theme; state contracts + Signals implementation + classic NgRx implementation selected at build
  time; all storefront and admin pages.
- **Tests:** backend unit tests (42), integration tests (written, ~40), frontend unit tests (99, including one contract
  suite executed against both state variants), Playwright E2E suite (23 scenarios × 2 variants = 46).
- **Quality:** ESLint flat config with Nx module boundaries, angular-eslint (incl. template accessibility on inline
  templates), restriction that only `apps/web/src/app/state/` may import a state implementation.
- **Delivery:** `services/api/Dockerfile`, `apps/web/Dockerfile` + `nginx.conf`, compose `full` profile serving both
  variants (8080 Signals, 8081 NgRx), `.env.example`, `.github/workflows/ci.yml`.
- **Docs:** README, AGENTS.md, Cursor rules/skills/agents (`docs/ai-workflow.md`), engineering decisions 01–22,
  ADR-0001…0010 (0010 `proposed`), learning catalog (`docs/learning/`: 16 topic indexes, detail pages for Angular,
  JS/TS, RxJS, Signals, NgRx, C#/ASP.NET Core, EF Core/PostgreSQL, cross-cutting topics), these tracking files.
  Documentation was checked against the code (file names, test names, symbols via `rg`); errors found during that
  review were fixed (e.g. ADR-0007 SQL, provider function name `provideAppState`, catalog-cache wording).

### Important decisions made during implementation

- Product concurrency uses an explicit `Version` column instead of PostgreSQL `xmin`: stock and rating change through
  atomic relative updates, and with `xmin` every checkout caused a false 409 for an admin editing the product.
  Orders still use `xmin`.
- Ratings are updated with one atomic `ExecuteUpdate` from an exact `RatingTotal`, so concurrent reviews cannot lose
  updates and averages never drift.
- Backend tests are split into a unit project (no Docker) and an integration project, because the assembly fixture
  started a container even for pure unit tests.
- Cart quote pipeline: `switchMap(lines => lines.length ? timer(debounce).pipe(switchMap(quote)) : EMPTY)` in both
  variants — a debounce that also cancels in-flight quotes when the cart changes or is cleared (found as a race bug).
- Wishlist rollback restores only the failed item (an earlier version restored a whole snapshot and could undo other
  successful changes).
- The URL is the single source of truth for catalog filters.
- Production builds disable critical-CSS inlining: Angular's inlined `onload` handler would be blocked by the nginx CSP.
- The API trusts `X-Forwarded-For` only when `ReverseProxy:TrustForwardedHeaders=true` (compose), so per-IP rate limits
  work behind nginx without letting direct clients spoof their IP.

### Commands executed and results

| Command (working directory) | Result |
| --- | --- |
| `dotnet build Shop.sln` (`services/api`) | ✅ 0 warnings, 0 errors (warnings are errors) |
| `dotnet test --project tests/Shop.Api.UnitTests` | ✅ 42 passed |
| `dotnet test --project tests/Shop.Api.IntegrationTests` | ❌ not runnable: `DockerUnavailableException` (KI-01) |
| `dotnet ef migrations script --idempotent` | ✅ SQL inspected (constraints, indexes, `pg_trgm`) |
| `dotnet ef migrations has-pending-model-changes --project src/Shop.Api` | ✅ "No changes have been made to the model since the last migration." |
| `npx nx run-many -t test` | ✅ 99 passed (data-access 15, ui 11, contracts 19, signals 15, ngrx 21, web 18) |
| `npx nx run-many -t lint` | ✅ 7 projects |
| `npx nx run web:build:production` / `web:build:production-ngrx` | ✅ both build; Signals JS has no NgRx code |
| `npx tsc -p apps/web-e2e/tsconfig.json` | ✅ |
| `npx playwright test --config apps/web-e2e/playwright.config.ts --list` | ✅ 46 tests discovered (not executed) |
| `npm audit --omit=dev` | ✅ 0 vulnerabilities; full audit: 17 dev-tooling findings (KI-03) |
| `docker info` / starting Docker Desktop | ❌ daemon unavailable (KI-01) |
| **Re-run at end of session** after the last UI/doc edits: | |
| `npx nx run-many -t lint test --skip-nx-cache` | ✅ 7 projects lint; 13 test files, 99 tests pass |
| `npx nx run web:build:production` / `production-ngrx` (`--skip-nx-cache`) | ✅ initial 396.05 kB / 440.09 kB raw; Signals build: 0 files with `@ngrx/store`, NgRx build: 1 (positive control for the CI grep) |
| `dotnet build Shop.sln -c Release` + `dotnet test --project tests/Shop.Api.UnitTests -c Release` | ✅ 0 warnings; 42 passed (note KI-05: without `--project` zero tests run) |
| `dotnet ef migrations has-pending-model-changes` | ✅ no changes |
| Relative links in 73 Markdown/rule files | ✅ 0 broken (local script) |
| External documentation links | ⚠️ not checked (KI-06) |

### Known limitations

See `KNOWN_ISSUES.md`. Session 1 was limited by KI-01 (no database; resolved in session 2). Still relevant: KI-10
(payment captured inside the DB transaction; acceptable only for the simulator).

## Next task

1. **Commit and CI** for the session-3 work (only when the user asks), then rebuild the compose images
   (`docker compose --profile full build web web-ngrx`) and re-run E2E against :8080/:8081.
2. **A-07 — accessibility audit** (axe in Playwright) on catalog, product, cart, checkout, admin and the assistant panel.
3. **A-08 — rate-limit integration test**; **DOC-06 — external link check** (KI-06).
4. **ADR-0010** — payment outside the transaction (the outbox from A-02 is the building block); **A-01** — OpenTelemetry;
   **A-11** — pgvector retrieval with an offline evaluation set.

To re-run everything locally:

```powershell
docker compose up -d postgres
cd services/api; dotnet build Shop.sln; dotnet test --project tests/Shop.Api.UnitTests; dotnet test --project tests/Shop.Api.IntegrationTests; cd ../..
cd services/notifications; dotnet test --project tests/Shop.Notifications.Tests; cd ../..
npx nx run-many -t lint test; npx nx e2e web-e2e
```

## Continuation prompt

```text
Continue the NorthwindShop full-stack reference project in this repository.
1. Read AGENTS.md, docs/project/MASTER_PLAN.md, IMPLEMENTATION_BACKLOG.md, PROGRESS.md, KNOWN_ISSUES.md and
   REQUIREMENTS_TRACEABILITY.md. Check `git status` and do not assume earlier work succeeded.
2. Verify the environment: `docker info` (or another PostgreSQL), `node -v`, `dotnet --version`.
3. Re-run the local checks from "Next task" in PROGRESS.md to confirm the baseline (unit, integration, E2E).
4. Then continue with the highest-priority TODO in IMPLEMENTATION_BACKLOG.md. Work autonomously, keep the
   tracking files current, never claim a check passed unless you ran it, and do not commit unless asked.
```
