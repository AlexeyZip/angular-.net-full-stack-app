# Known issues

Honest list of defects, unavailable checks, environment limits and deliberate shortcuts.
Each entry: **ID · severity · status** — description, impact, workaround, what would close it.

Severity: `blocker` (stops verification of a core requirement) · `high` · `medium` · `low`.

---

## Environment and verification

### KI-01 · blocker · RESOLVED (session 2) — No PostgreSQL available in the development environment

- **Resolved:** the Docker daemon became available (Docker 27.1.1). `docker compose up -d postgres` is healthy, and
  every check listed below has since been executed — integration tests 40/40, E2E 46/46 on the dev servers and 46/46
  against the compose stack (`docs/project/PROGRESS.md`, session 2). The original description is kept for history.
- **Observed (2026-10-18, session 1):** Docker CLI 27.1 is installed but the daemon is not running. Starting Docker Desktop
  (`Docker Desktop.exe`) exits immediately without writing logs; its WSL distros (`docker-desktop`,
  `docker-desktop-data`) stay stopped. Most likely it needs first-run interaction in its GUI (licence/terms dialog)
  or a WSL 2 update. No local PostgreSQL server is installed. The Ubuntu WSL distro is WSL 1.
- **Not executed because of this:**
  - backend integration tests (`services/api/tests/Shop.Api.IntegrationTests`, ~40 tests, Testcontainers);
  - running the API against a database (migrations, seeding, any HTTP request that touches data);
  - Playwright E2E (`apps/web-e2e`, 46 tests = 23 scenarios x 2 state variants);
  - `docker compose --profile full up --build` (Dockerfiles were written but never built).
- **What *was* verified instead:** solution build, 42 backend unit tests, migration SQL generated offline
  (`dotnet ef migrations script --idempotent`), `dotnet ef migrations has-pending-model-changes`, frontend
  lint/unit tests/builds, Playwright test discovery (`--list`) and type-check of the E2E project.
- **Close it by any one of:**
  1. Start Docker Desktop manually, accept its dialogs, then `docker compose up -d postgres`.
  2. Install PostgreSQL 17 locally and run the integration tests against it:
     `$env:SHOP_TEST_CONNECTION_STRING="Host=localhost;Port=5432;Database=shop_test;Username=...;Password=..."`
     (the fixture refuses database names that do not contain `test`).
  3. Let CI run: `.github/workflows/ci.yml` runs integration tests (Testcontainers) and E2E (service container).

### KI-02 · medium · WORKAROUND — npm 10.9.0 fails to install this workspace

- `npm install` with npm 10.9.0 (bundled with Node 22.12) failed inside arborist while resolving the Nx/Angular tree.
- **Workaround:** use npm 11: `npx -y npm@11 install` locally; CI and `apps/web/Dockerfile` run `npm install -g npm@11`.
- npm 11 prints "install scripts are not allowed" warnings; no functional impact was observed (build, tests, lint pass).

### KI-03 · low · OPEN — `npm audit`: 17 findings, all in development tooling

- `npm audit --omit=dev` → **0 vulnerabilities** (nothing shipped to browsers is affected).
- Full `npm audit` (2026-10-18): 10 moderate, 7 high, all transitive through build tools:
  - `nx` → `undici` (several DoS / response-splitting advisories), which propagates to every `@nx/*` plugin;
  - `@analogjs/vite-plugin-angular` → `ts-morph` → `fast-glob` → `micromatch` → `braces` (ReDoS-style DoS).
- These run only on developer machines and CI with trusted inputs. `npm audit fix --force` would downgrade/upgrade
  majors and break the workspace, so it was not applied. **Revisit** when Nx / Analog publish patched releases.

### KI-04 · low · RESOLVED (session 2) — Docker images were never built

- `docker compose --profile full build` builds all three images; `up -d` brings postgres and api to `healthy` and
  starts web (8080) and web-ngrx (8081), which have no health check of their own. The risks listed in session 1 were checked: `npm ci` with the Windows-generated lockfile works on Linux; the
  busybox `wget` health check works; the CSP blocks nothing (E2E 46/46 through nginx).
- **Defect found and fixed on the first run:** nginx served HTML and assets *without* the security headers, because a
  `location` with its own `add_header` (Cache-Control) cancels every inherited `add_header`. The headers now live in
  `apps/web/nginx-security-headers.conf`, included in the server block and in each such location; checked with `curl`.

### KI-07 · low · WORKAROUND — The E2E suite exceeds the default auth rate limit against compose

- Every E2E test signs in from the same IP, so the default `auth` limit (10/min) returns 429 when the suite runs
  against the containers. When Playwright starts the API itself, `apps/web-e2e/playwright.config.ts` raises the limits
  through `RateLimiting__*` environment variables.
- **Workaround:** start the stack with `API_AUTH_PERMIT_LIMIT=1000` and `API_CHECKOUT_PERMIT_LIMIT=1000` (compose
  variables, default 10) only for the E2E run, then recreate the `api` container with the defaults.

### KI-05 · low · WORKAROUND — `dotnet test <path>` silently runs zero tests

- The test projects use Microsoft Testing Platform (xUnit v3). With it, `dotnet test tests/Shop.Api.UnitTests` (path
  as a positional argument) reports "Zero tests ran" and exits with code 5 instead of running the 42 tests.
- **Always use** `dotnet test --project tests/Shop.Api.UnitTests` (as in `README.md`, `AGENTS.md` and CI).
- Observed on 2026-10-18 with .NET SDK 10.0.401.

### KI-06 · low · OPEN — External documentation links not verified

- Links to official documentation in `docs/` were not checked for reachability; see `docs/learning/official-links.md`
  for the command to check them (backlog DOC-06).

---

## Product and design limitations (deliberate, documented)

### KI-10 · medium · ACCEPTED — Payment is captured inside the database transaction

- `CheckoutService.CreateOrderInTransactionAsync` reserves stock, calls `PaymentSimulator.Charge`, then inserts the
  order and commits. If the commit failed *after* a real capture, the customer would be charged without an order.
- Acceptable only because the payment provider is a local simulator.
- **Real-provider design:** authorize → commit order as `PendingPayment` → capture, with an outbox/compensating refund,
  provider idempotency keys, and webhook reconciliation. See `docs/engineering-decisions/21-resilience-and-failure-handling.md`.

### KI-11 · low · ACCEPTED — Signing out deletes that user's locally saved cart

- `cartForIdentityChange` (`libs/state/contracts/src/lib/cart-persistence.ts`) clears the previous user's cart on
  sign-out, for shared-device privacy. The cart is client-side only (no server cart), so it is not restored on the
  next sign-in. A server-side cart would remove this trade-off.

### KI-12 · low · ACCEPTED — Both dev servers share one refresh cookie

- Cookies are scoped by host, not port. Signing in on `localhost:4200` (Signals) also signs you in on
  `localhost:4300` (NgRx) after a reload, and signing out on one rotates/revokes the other's session.
  Use separate browser profiles to compare the variants side by side. E2E tests are unaffected (isolated contexts).

### KI-13 · low · ACCEPTED — Rate limiting is in-memory and per instance

- `RateLimitPolicies` uses ASP.NET Core's in-process limiter. With several API instances each has its own counters;
  a distributed limiter (Redis) or gateway limits would be needed. Behind a proxy, client IPs are only correct when
  `ReverseProxy:TrustForwardedHeaders=true` (enabled in docker-compose, where the API has no published port).

### KI-14 · low · ACCEPTED — Access tokens cannot be revoked before they expire

- JWT access tokens are stateless (15 minutes). Logout and refresh-token reuse detection revoke the *refresh* token;
  an already issued access token stays valid until expiry. Role changes therefore apply within 15 minutes.

### KI-15 · low · OPEN — No server-side cart, coupons, taxes or multi-currency

- Pricing is USD only, flat shipping (9.99, free from 100.00), no tax. Documented in
  `docs/engineering-decisions/22-deliberately-not-built.md`.
