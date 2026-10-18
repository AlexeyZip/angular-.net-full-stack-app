# Requirements traceability

Maps each significant requirement of `MASTER-PROMPT.md` to code, tests, docs and its **current, evidenced** status.

| Status | Meaning |
| --- | --- |
| `IMPLEMENTED_AND_VERIFIED` | Code exists and the listed check was actually executed and passed. |
| `IMPLEMENTED_NOT_FULLY_VERIFIED` | Code and tests exist; some verification (e.g. CI on GitHub, a dedicated test) has not been executed. |
| `PARTIALLY_IMPLEMENTED` | Part of the requirement exists. |
| `DESIGN_ONLY` | Documented design, no implementation. |
| `OPTIONAL_NOT_IMPLEMENTED` | Optional/advanced item intentionally not built yet. |
| `NOT_IMPLEMENTED` | Required, not started. |
| `BLOCKED` | Cannot proceed because of an external blocker. |

Abbreviations: **UT** unit tests, **IT** integration tests (real PostgreSQL), **E2E** Playwright, **CT** state contract
suite (`libs/state/contracts/src/testing/state-contract-suite.ts`, run against both variants).
Last evidence run: 2026-10-18, session 2 (see `PROGRESS.md`): IT 40/40, backend UT 42/42, frontend UT 101/101,
E2E 46/46 on the dev servers and 46/46 against the Docker Compose stack (nginx + production builds). Wherever a row
names an IT or E2E test, that test was executed in this run.

## Repository and tooling

| ID | Requirement | Implementation | Verification | Docs | Status |
| --- | --- | --- | --- | --- | --- |
| R-REPO-01 | Single Git monorepo, Nx for Angular, native dotnet for .NET | `nx.json`, `package.json`, `apps/`, `libs/`, `services/api/Shop.sln` | `nx run-many -t lint test build`, `dotnet build Shop.sln` | `README.md`, `docs/engineering-decisions/01-system-architecture.md` | IMPLEMENTED_AND_VERIFIED |
| R-REPO-02 | Module boundaries enforced | `eslint.config.mjs` (`@nx/enforce-module-boundaries`, tags in `project.json`) | `npx nx run-many -t lint` (7 projects pass) | ADR-0002 | IMPLEMENTED_AND_VERIFIED |
| R-REPO-03 | Docker Compose with PostgreSQL | `docker-compose.yml`, `.env.example` | `docker compose up -d postgres` ✅ (healthy); `--profile full up` ✅ (all services healthy) | `README.md` | IMPLEMENTED_AND_VERIFIED |
| R-REPO-04 | Container images for API and web | `services/api/Dockerfile`, `apps/web/Dockerfile`, `apps/web/nginx.conf`, `nginx-security-headers.conf` | images built ✅; security headers present on HTML, assets and API responses ✅; E2E 46/46 through nginx ✅ | ADR-0009 | IMPLEMENTED_AND_VERIFIED |
| R-REPO-05 | CI pipeline | `.github/workflows/ci.yml` | workflow not run (no remote); every command in it was executed locally and passes | `18-ci-cd-and-infrastructure-as-code.md` | IMPLEMENTED_NOT_FULLY_VERIFIED |
| R-REPO-06 | AGENTS.md, Cursor rules, skills, agents | `AGENTS.md`, `.cursor/rules`, `.cursor/skills`, `.cursor/agents` | format reviewed manually | `docs/ai-workflow.md` | IMPLEMENTED_NOT_FULLY_VERIFIED |

## Storefront

| ID | Requirement | Implementation | Verification | Status |
| --- | --- | --- | --- | --- |
| R-CAT-01 | Product list with server-side pagination | `CatalogService.cs`, `catalog-page.ts`, both catalog stores | IT `Products_are_paginated_on_the_server`; CT catalog tests ✅; E2E journey 1 | IMPLEMENTED_AND_VERIFIED |
| R-CAT-02 | Search, category/brand/price/in-stock filters, sorting | `CatalogService.cs` (ILIKE + pg_trgm index, escaped wildcards), `catalog-filters-panel.ts`, `catalog-query-params.ts` | UT `Like_wildcards_in_search_are_escaped` ✅; web UT `catalog-query-params.spec.ts` ✅; IT filters/sort/search; E2E journey 2 | IMPLEMENTED_AND_VERIFIED |
| R-CAT-03 | Filters shareable via URL, back/forward works | `catalog-page.ts` (URL is the source of truth) | web UT ✅; E2E checks URL | IMPLEMENTED_AND_VERIFIED |
| R-CAT-04 | Stale responses never overwrite newer filters | `switchMap` in both catalog stores | CT "resets to page 1 on a filter change and never applies the stale response" ✅ (both variants) | IMPLEMENTED_AND_VERIFIED |
| R-CAT-05 | Product detail by slug, reviews, 404 state | `product-page.ts`, `product-reviews.ts`, `ReviewService.cs` | IT `Product_detail_is_found_by_slug`, `Unknown_product_returns_not_found_problem`; E2E journey 3 | IMPLEMENTED_AND_VERIFIED |
| R-CAT-06 | Reviews only by customers with a non-cancelled order of the product, one per customer; rating aggregate correct under concurrency | `ReviewService.cs` (atomic `ExecuteUpdate`), `Product.ApplyReview` | UT rating tests ✅; IT `Admin_ships_and_delivers_then_customer_can_review` | IMPLEMENTED_AND_VERIFIED |
| R-CART-01 | Cart add/update/remove/clear, quantity limits | `signals-cart.store.ts`, `libs/state/ngrx/src/lib/cart/*`, `cart-page.ts` | CT cart tests ✅; NgRx reducer UT ✅; E2E journeys 4-5 | IMPLEMENTED_AND_VERIFIED |
| R-CART-02 | Cart persisted per user, guest cart merged on sign-in, no leakage between users | `cart-persistence.ts` | `cart-persistence.spec.ts` ✅; CT merge/isolation ✅ | IMPLEMENTED_AND_VERIFIED |
| R-CART-03 | Totals come from the server (quote), client only estimates | `CartQuoteService.cs`, `Pricing.cs`, `order-summary-panel.ts` | UT `PricingTests` ✅; CT "quote sends ids and quantities only" ✅; IT `Quote_reports_stock_issues_without_reserving_anything` | IMPLEMENTED_AND_VERIFIED |
| R-WISH-01 | Wishlist with optimistic update and rollback | both wishlist stores, `WishlistController.cs` | CT optimistic add/remove rollback ✅; IT `Wishlist_add_is_idempotent_and_remove_works`; E2E wishlist | IMPLEMENTED_AND_VERIFIED |
| R-UI-01 | Loading, empty, error states | `libs/shared/ui/src/lib/states.ts`, all pages | CT empty-vs-loading ✅; manual review | PARTIALLY_IMPLEMENTED (not visually verified in a browser against a live API) |
| R-UI-02 | Accessibility (labels, focus, ARIA, keyboard) | templates; `angular-eslint` template accessibility rules | lint ✅; no axe/screen-reader audit yet | PARTIALLY_IMPLEMENTED |
| R-UI-03 | Light/dark themes | `_tokens.scss`, `theme.ts` | build ✅; not visually verified | IMPLEMENTED_NOT_FULLY_VERIFIED |

## Checkout and business integrity

| ID | Requirement | Implementation | Verification | Status |
| --- | --- | --- | --- | --- |
| R-CHK-01 | Server-authoritative prices; client prices ignored | `CheckoutService.cs`, `Pricing.cs` | IT `Client_supplied_prices_are_ignored`, `Checkout_uses_server_prices_and_decrements_stock` | IMPLEMENTED_AND_VERIFIED |
| R-CHK-02 | No overselling under concurrency | conditional `UPDATE ... WHERE stock_quantity >= n`, sorted lock order | IT `Concurrent_buyers_cannot_oversell_the_last_units`; CHECK constraint `stock_quantity >= 0` in migration ✅ (SQL inspected) | IMPLEMENTED_AND_VERIFIED |
| R-CHK-03 | Duplicate checkout handled (idempotency) | `Idempotency-Key` + unique index + request fingerprint; `checkout-page.ts` reuses key per attempt | UT fingerprint ✅; IT retry/reuse/concurrent duplicates | IMPLEMENTED_AND_VERIFIED |
| R-CHK-04 | Payment simulator (approve/decline/outage), no real payments | `PaymentSimulator.cs` | UT ✅; IT `Declined_payment_rolls_back_the_stock_reservation`; E2E declined | IMPLEMENTED_AND_VERIFIED (KI-10) |
| R-CHK-05 | Order state machine, cancellation restocks | `Order.cs`, `OrderStatusService.cs` | UT state machine ✅; IT cancellation/restock; E2E journey 12 | IMPLEMENTED_AND_VERIFIED |
| R-ORD-01 | Order history and detail, owner-only | `OrderQueries.cs`, `order-history-page.ts`, `order-detail-page.ts` | IT `Customers_cannot_see_other_customers_orders`; E2E journeys 7-8 | IMPLEMENTED_AND_VERIFIED |

## Administration

| ID | Requirement | Implementation | Verification | Status |
| --- | --- | --- | --- | --- |
| R-ADM-01 | Admin dashboard KPIs | `AdminOrdersService.cs`, `dashboard-page.ts` | IT `Dashboard_reports_kpis`; E2E journey 9 | IMPLEMENTED_AND_VERIFIED |
| R-ADM-02 | Product create/edit with optimistic concurrency | `AdminCatalogService.cs`, `Product.Version`, `product-edit-page.ts` | UT `Only_detail_edits_advance_the_concurrency_version` ✅; IT stale-version 409 and no false conflict; E2E journey 10 | IMPLEMENTED_AND_VERIFIED |
| R-ADM-03 | Inventory adjustments (relative, never negative, audited) | `AdminCatalogService.AdjustStockAsync` | IT `Stock_adjustments_are_relative_and_cannot_go_negative`; E2E journey 11 + failure path | IMPLEMENTED_AND_VERIFIED |
| R-ADM-04 | Categories CRUD, no delete when in use | `AdminCatalogService.cs`, `categories-page.ts` | IT `Category_with_products_cannot_be_deleted` | IMPLEMENTED_AND_VERIFIED |
| R-ADM-05 | Order management and status changes | `AdminOrdersService.cs`, `orders-page.ts`, `order-page.ts` | IT state machine; E2E journey 12 | IMPLEMENTED_AND_VERIFIED |
| R-ADM-06 | Audit log of admin actions | `AuditLogger.cs`, `audit-log-page.ts` | IT `Admin_can_create_and_update_a_product_with_audit_records` | IMPLEMENTED_AND_VERIFIED |

## Security

| ID | Requirement | Implementation | Verification | Status |
| --- | --- | --- | --- | --- |
| R-SEC-01 | Register/login/logout, hashed passwords, generic login errors | `AuthService.cs`, ASP.NET Core `PasswordHasher` | UT password policy ✅; IT auth suite | IMPLEMENTED_AND_VERIFIED |
| R-SEC-02 | Tokens never in global state or storage | `auth-session.ts` (access token in a private field, refresh in HttpOnly cookie) | UT `auth-session.spec.ts` "token never in storage" ✅ | IMPLEMENTED_AND_VERIFIED |
| R-SEC-03 | Refresh rotation with reuse detection, CSRF header on cookie endpoints | `AuthService.RefreshAsync`, `AuthController.EnsureCsrfHeader`, `auth.interceptor.ts` | interceptor UT ✅; IT `Refresh_rotates_the_token_and_reuse_revokes_the_session`, `Refresh_requires_the_csrf_header` | IMPLEMENTED_AND_VERIFIED |
| R-SEC-04 | Role-based authorization enforced by the API (UI guard is UX only) | `[Authorize(Policy = AdminPolicy)]`, `guards.ts` | IT `Customers_cannot_call_admin_endpoints`, `Tampered_token_is_rejected`; E2E journey 13 | IMPLEMENTED_AND_VERIFIED |
| R-SEC-05 | Rate limiting on auth and checkout | `RateLimitPolicies.cs` | not exercised by tests | IMPLEMENTED_NOT_FULLY_VERIFIED |
| R-SEC-06 | No open redirect after login | `safeReturnUrl` in `validators.ts` | web UT ✅ | IMPLEMENTED_AND_VERIFIED |
| R-SEC-07 | No secrets in the repository | dev-only placeholders in `appsettings.Development.json`, `.env.example`, `.gitignore` | manual review | IMPLEMENTED_NOT_FULLY_VERIFIED |

## Dual state management

| ID | Requirement | Implementation | Verification | Status |
| --- | --- | --- | --- | --- |
| R-STATE-01 | Shared contracts; components unaware of the implementation | `libs/state/contracts` (abstract classes as DI tokens) | `apps/web/eslint.config.mjs` `no-restricted-imports`: only `src/app/state/` may import an implementation (probe file rejected ✅); Nx tags stop the two implementations importing each other | IMPLEMENTED_AND_VERIFIED |
| R-STATE-02 | Signals implementation | `libs/state/signals` | CT 15 tests ✅; E2E project `signals` 23/23 against the real API + PostgreSQL ✅ (spec 7.4) | IMPLEMENTED_AND_VERIFIED |
| R-STATE-03 | Classic NgRx implementation (actions, reducers, selectors, effects, entity) | `libs/state/ngrx` | CT + reducer/selector UT, 21 tests ✅; E2E project `ngrx` 23/23 against the real API + PostgreSQL ✅ (spec 7.4) | IMPLEMENTED_AND_VERIFIED |
| R-STATE-04 | Only one variant active per build; selectable | `fileReplacements` in `apps/web/project.json` | both production builds ✅; Signals bundle contains no `@ngrx/store` code ✅ | IMPLEMENTED_AND_VERIFIED |
| R-STATE-05 | Both variants pass the same E2E suite | `apps/web-e2e/playwright.config.ts` (projects `signals`, `ngrx`) | `npx nx e2e web-e2e`: 46/46 ✅ | IMPLEMENTED_AND_VERIFIED |
| R-STATE-06 | Comparison document | `docs/engineering-decisions/04-signals-vs-rxjs-vs-ngrx.md` | — | IMPLEMENTED_AND_VERIFIED |

## Testing

| ID | Requirement | Implementation | Verification | Status |
| --- | --- | --- | --- | --- |
| R-TEST-01 | Frontend unit tests (Vitest) | `*.spec.ts` in 6 projects | `npx nx run-many -t test`: 101 tests pass ✅ | IMPLEMENTED_AND_VERIFIED |
| R-TEST-02 | Backend unit tests | `services/api/tests/Shop.Api.UnitTests` | `dotnet test --project tests/Shop.Api.UnitTests`: 42 pass ✅ | IMPLEMENTED_AND_VERIFIED |
| R-TEST-03 | Backend integration tests with real PostgreSQL | `services/api/tests/Shop.Api.IntegrationTests` (Testcontainers) | `dotnet test --project tests/Shop.Api.IntegrationTests`: 40/40 ✅ | IMPLEMENTED_AND_VERIFIED |
| R-TEST-04 | Playwright E2E for 13 journeys + failure paths, both variants | `apps/web-e2e/src/*.spec.ts` | 46/46 on dev servers ✅, 46/46 against compose ✅, `admin.spec.ts` ×3 repeat 54/54 ✅ | IMPLEMENTED_AND_VERIFIED |

## Documentation

| ID | Requirement | Location | Status |
| --- | --- | --- | --- |
| R-DOC-01 | Engineering decision handbook 01–22 | `docs/engineering-decisions/` (index in `README.md`) | IMPLEMENTED_AND_VERIFIED (all 22 present; code references checked with `rg`; design-only topics labelled as such) |
| R-DOC-02 | ADRs | `docs/adr/` (0000 template, 0001–0009 accepted, 0010 proposed) | IMPLEMENTED_AND_VERIFIED (content reviewed against code) |
| R-DOC-03 | Learning catalogs (JS/TS, C#/.NET, Angular, ...) with interview Q&A | `docs/learning/` | IMPLEMENTED_NOT_FULLY_VERIFIED (repo references checked; external official links not checked, KI-06) |
| R-DOC-04 | Tracking files | `docs/project/` | IMPLEMENTED_AND_VERIFIED |

## Optional / advanced (section 13–15)

| ID | Topic | Status |
| --- | --- | --- |
| R-ADV-01 | Microservices example | OPTIONAL_NOT_IMPLEMENTED (design in `02-modular-monolith-vs-microservices.md`) |
| R-ADV-02 | Microfrontends | OPTIONAL_NOT_IMPLEMENTED (design in `03-modular-angular-vs-microfrontends.md`) |
| R-ADV-03 | SignalR real-time updates | OPTIONAL_NOT_IMPLEMENTED |
| R-ADV-04 | AI assistant / RAG | DESIGN_ONLY (`12-ai-integration-and-rag.md`) |
| R-ADV-05 | Azure architecture / Bicep | DESIGN_ONLY (`15-cloud-and-azure-architecture.md`); no cloud resources were created |
| R-ADV-06 | Distributed caching | DESIGN_ONLY (`13-caching-strategy.md`) |
| R-ADV-07 | OpenTelemetry tracing/metrics export | OPTIONAL_NOT_IMPLEMENTED (structured JSON logs + health checks exist) |
