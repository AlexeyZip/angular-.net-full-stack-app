# Implementation backlog

Statuses: `TODO` · `IN_PROGRESS` · `BLOCKED` · `DONE`. A task is `DONE` only when its acceptance criteria were
verified by an executed check. Priority: P0 (core) · P1 (quality) · P2 (depth) · P3 (optional).

| ID | Task | Deps | Prio | Acceptance criteria | Tests / verification | Docs | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F-01 | Monorepo foundation: git, Nx workspace, `.gitignore`, `.editorconfig`, compose (postgres) | — | P0 | `nx` and `dotnet` both work from a fresh clone | `nx show projects`, `dotnet build` | README | DONE |
| B-01 | API scaffold, EF Core model, configurations, initial migration, dev seeder | F-01 | P0 | migration SQL contains all tables, constraints, indexes | `dotnet ef migrations script --idempotent` inspected; `has-pending-model-changes` clean | 06, 07, 20 | DONE (migrations applied to PostgreSQL 17 in session 2) |
| B-02 | Catalog API: search/filter/sort/paging, categories, product by slug | B-01 | P0 | validated query, ProblemDetails, trigram index | IT `CatalogApiTests` | 09, 19 | DONE |
| B-03 | Auth: register/login/refresh/logout, JWT, roles, refresh rotation, CSRF header, rate limits | B-01 | P0 | refresh reuse revokes session; admin endpoints 403 for customers | IT `AuthApiTests`, UT password policy | 11, 17, ADR-0005 | DONE (rate limiting configured, not covered by a test → A-08) |
| B-04 | Wishlist, cart quote, checkout (idempotency, concurrency), orders, cancellation, reviews | B-02, B-03 | P0 | no oversell; replay returns same order; declined payment rolls back | IT `CheckoutApiTests`; UT pricing/state machine | 08, 21, ADR-0007 | DONE |
| B-05 | Admin API: products (Version token), stock adjustments, categories, orders, dashboard, audit | B-04 | P0 | stale version → 409; checkout never causes false 409 | IT `AdminApiTests` | 08, 20 | DONE |
| B-06 | Backend tests: unit (no Docker) + integration (Testcontainers / `SHOP_TEST_CONNECTION_STRING`) | B-01..B-05 | P0 | all pass | `dotnet test --project` both projects | 14, ADR-0008 | DONE (unit 42/42, integration 40/40) |
| W-01 | Angular scaffold, data-access (API clients, auth session, interceptor, guards), UI kit, themes | F-01 | P0 | builds; interceptor refreshes once for concurrent 401s | data-access + ui unit tests | 05, 11 | DONE |
| W-02 | State contracts + Signals + NgRx implementations + build switch | W-01 | P0 | same contract suite passes for both; Signals bundle has no NgRx | CT in both libs; bundle grep | 04, ADR-0002/0003 | DONE |
| W-03 | Pages: catalog, product, cart, checkout, orders, account, wishlist, admin | W-02, B-02..B-05 | P0 | all journeys usable against the live API | E2E | — | DONE (E2E 46/46 against the live API) |
| W-04 | Frontend unit tests | W-01..W-03 | P0 | `nx run-many -t test` passes | 101 tests | 14 | DONE |
| W-05 | Lint and module boundaries (Nx tags, angular-eslint, a11y on inline templates, state-import restriction) | W-01 | P1 | lint passes; violations are caught | `nx run-many -t lint`; probe import rejected | ADR-0002 | DONE |
| E-01 | Playwright E2E: 13 journeys + failure paths, both variants | W-03 | P0 | `nx e2e web-e2e` green for `signals` and `ngrx` | `nx e2e web-e2e` | 14 | DONE (46/46 on dev servers, twice; 46/46 against compose) |
| D-01 | Dockerfiles (API, web+nginx), compose `full` profile, `.env.example`, `.dockerignore` | B-06, W-03 | P1 | `docker compose --profile full up --build` serves both variants | build + up + curl smoke + E2E through nginx | README, ADR-0009 | DONE |
| D-02 | GitHub Actions CI: frontend, backend (unit + IT), E2E | D-01 | P1 | workflow green on GitHub | CI run | 18 | DONE (run 39149844984 on `e65cd54`: all 3 jobs green) |
| DOC-01 | README, AGENTS.md, Cursor rules/skills/agents | — | P1 | instructions match real commands | commands in README executed (except DB ones) | `docs/ai-workflow.md` | DONE |
| DOC-02 | Engineering decisions 01–22 | B-*, W-* | P1 | each references real code; 04 and 22 complete | all 22 files exist with 16 sections; file/test/symbol references checked with `rg`; relative links checked (73 files, 0 broken) | — | DONE (12, 13 server cache, 15 and parts of 16/21 are labelled DESIGN_ONLY) |
| DOC-03 | ADRs | B-*, W-* | P1 | one per consequential decision | ADR-0001…0009 `accepted` + ADR-0010 `proposed`; claims checked against code | — | DONE |
| DOC-04 | Learning catalogs (JS/TS, C#/.NET, topic indexes, interview Q&A) | DOC-02 | P2 | topics link to repo files and official docs | 16 topic indexes; detail pages for Angular, JS/TS, RxJS, Signals, NgRx, C#/ASP.NET Core, EF Core/PostgreSQL; repo references checked | — | DONE (external links unverified → DOC-06) |
| DOC-06 | Verify external documentation links (link checker in CI) | DOC-04 | P2 | every external link returns 2xx/3xx | `docs/learning/official-links.md` command or lychee | — | TODO (KI-06) |
| DOC-05 | Tracking files | — | P0 | kept current | — | — | DONE |
| V-01 | Final verification: IT + E2E + compose; update statuses | KI-01 | P0 | all core statuses verified | all commands | all | DONE (locally and in CI) |
| A-01 | OpenTelemetry tracing + metrics (console/OTLP exporter) | B-06 | P2 | traces for checkout visible locally | manual + test | 16 | TODO |
| A-02 | Transactional outbox for order events + hosted worker | B-04 | P2 | event survives crash between commit and publish | IT | 10, 21 | DONE (2026-10-18: IT `OutboxTests` — event committed with the order and delivered by a later, separate processor run; retry, dead-letter, `SKIP LOCKED`; manual compose outage: checkout 201 while notifications was down, delivered on attempt 4 after restart) |
| A-09 | Notifications microservice (own DB, idempotent inbox, service-key auth, contract samples) | A-02 | P3 | duplicates harmless; unauthenticated calls rejected; producer and consumer agree on the samples | notifications tests, UT `EventContractTests` | 02, ADR-0012 | DONE (notifications tests 14/14, contract tests, compose run with a shared trace id) |
| A-10 | Assistant microfrontend in an overlay side panel on every page | A-05 | P3 | shop works when the remote is down; conversation survives navigation; no layout shift on open | UT widget + panel, E2E `assistant.spec.ts` | 03, ADR-0011 | DONE (UT 9/9 + web 28/28; full E2E 50/50 twice, both variants; chat checked manually on :8080 with qwen2.5:7b before the overlay change, the overlay on the dev server — the compose images were not rebuilt) |
| A-03 | SignalR order-status notifications | A-02 | P3 | customer sees status change live | E2E | 10 | TODO |
| A-04 | Output caching for catalog reads with tag invalidation | B-02 | P2 | admin edit invalidates cache | IT | 13 | TODO |
| A-05 | AI product assistant (RAG) | — | P3 | answers cite products; no external cost without approval | IT with fake model | 12, ADR-0013 | DONE (IT `AssistantApiTests` incl. follow-ups, UT `AssistantTests`, manual runs with qwen2.5:7b on local Ollama; no paid provider) |
| A-11 | Assistant: embedding retrieval (pgvector), offline evaluation set, SSE streaming | A-05 | P3 | evaluation set shows better recall than lexical retrieval | eval script + IT | 12 | TODO |
| A-06 | Azure Bicep templates (no deployment) | D-02 | P3 | `az bicep build` passes | build only | 15 | TODO |
| A-07 | Accessibility audit (axe in Playwright) | E-01 | P1 | no serious violations on key pages | E2E | — | TODO |
| A-08 | Integration test for the auth/checkout rate limits (429 + ProblemDetails `code`) | B-03 | P2 | exceeding the limit returns 429 with a stable code | IT with a low limit via `UseSetting` | 17 | TODO |
