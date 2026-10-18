# Cross-cutting topics

Short entry points. Each section names the problem, where it lives in the code, the common mistakes, a few interview
questions, and the official documentation. The depth is in the linked engineering-decision documents.

## HTTP and REST
- **Problem:** a predictable contract between SPA and API.
- **In this repo:** resource-oriented routes (`/api/catalog/products/{slug}`, `/api/orders/{id:guid}`, `POST /api/orders/{id}/cancel` for an action that is not plain CRUD,
  `/api/admin/...`), correct verbs and status codes, ProblemDetails errors with `code`, `Idempotency-Key` for
  non-idempotent POST, query objects with limits, one origin via proxy (no CORS in the default setup).
- **Mistakes:** 200 with `{ error }` bodies; verbs in URLs; unbounded page sizes; leaking internals in errors.
- **Q:** *PUT vs POST vs PATCH?* — PUT replaces/creates at a known URL and is idempotent; POST creates/acts and is
  not; PATCH partially updates. *Why 404 instead of 403 for another user's order?* — Does not reveal existence.
- Deep dive: [19](../engineering-decisions/19-api-design-and-error-handling.md).
- Official: https://www.rfc-editor.org/rfc/rfc9110 · https://www.rfc-editor.org/rfc/rfc9457 ·
  https://developer.mozilla.org/en-US/docs/Web/HTTP/Status

## Authentication and security
- **In this repo:** access token in memory, rotating HttpOnly SameSite=Strict refresh cookie with reuse detection,
  CSRF header, PBKDF2 hashes, rate limiting, ownership checks in queries, admin policy, server-side prices, escaped
  LIKE patterns, open-redirect protection, CSP and security headers in nginx, no secrets in the repository.
- **Mistakes:** tokens in `localStorage`; trusting client prices/roles; relying on route guards for security; logging
  tokens; `alg` not pinned.
- **Q:** *XSS vs CSRF defences?* — XSS: output encoding (Angular), CSP, no tokens readable by JS. CSRF: SameSite
  cookies, custom header, no state-changing GETs.
- Deep dive: [11](../engineering-decisions/11-authentication-and-authorization.md),
  [17 threat model](../engineering-decisions/17-security-and-threat-modeling.md),
  [ADR-0005](../adr/0005-authentication-model.md).
- Official: https://owasp.org/www-project-top-ten/ · https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html ·
  https://angular.dev/best-practices/security · https://learn.microsoft.com/en-us/aspnet/core/security/

## Testing
- **In this repo:** backend unit (`Shop.Api.UnitTests`) and integration with real PostgreSQL
  (`Shop.Api.IntegrationTests`, Testcontainers); frontend Vitest with a **shared contract suite** for both state
  variants (`libs/state/contracts/src/testing/state-contract-suite.ts`); Playwright E2E per variant
  (`apps/web-e2e`, fixtures in `src/support`).
- **Mistakes:** testing implementation details; mocking the database for SQL-dependent behaviour; E2E tests sharing
  data; `waitForTimeout` instead of web-first assertions.
- **Q:** *What goes in which level?* — Pure rules → unit; SQL/HTTP contracts → integration; critical user journeys →
  E2E (few, stable, role-based selectors).
- Deep dive: [14](../engineering-decisions/14-testing-strategy.md), [ADR-0008](../adr/0008-testing-approach.md).
- Official: https://vitest.dev/guide/ · https://playwright.dev/docs/best-practices ·
  https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests · https://dotnet.testcontainers.org/

## Architecture
- **In this repo:** modular monolith with feature folders (backend) and Nx libraries with enforced boundaries
  (frontend); synchronous request/response with idempotency; a documented plan for the outbox when asynchrony is
  needed.
- **Q:** *When would you split a service out?* — Independent scaling/deployment/team ownership needs that outweigh
  the cost of distributed transactions, observability and versioning.
- Deep dive: [01](../engineering-decisions/01-system-architecture.md),
  [02](../engineering-decisions/02-modular-monolith-vs-microservices.md),
  [03](../engineering-decisions/03-modular-angular-vs-microfrontends.md),
  [10](../engineering-decisions/10-synchronous-vs-asynchronous-communication.md),
  [21](../engineering-decisions/21-resilience-and-failure-handling.md),
  [22](../engineering-decisions/22-deliberately-not-built.md).
- Official: https://learn.microsoft.com/en-us/azure/architecture/guide/ · https://nx.dev/features/enforce-module-boundaries

## Docker and CI/CD
- **In this repo:** compose with PostgreSQL (default) and a `full` profile (API + two nginx frontends); multi-stage
  Dockerfiles with non-root runtime images; GitHub Actions with frontend, backend and E2E jobs.
- **Mistakes:** secrets baked into images; running as root; `latest` tags; copying `node_modules` from the host
  (`.dockerignore`); in nginx, an `add_header` inside a `location` silently drops all server-level `add_header`s
  (this repo shipped HTML without its CSP until `apps/web/nginx-security-headers.conf` was included everywhere).
- **Q:** *Why multi-stage builds?* — SDK/toolchain stays in the build stage; the runtime image is small with a smaller
  attack surface.
- Deep dive: [18](../engineering-decisions/18-ci-cd-and-infrastructure-as-code.md),
  [ADR-0009](../adr/0009-local-development-environment.md).
- Official: https://docs.docker.com/build/building/multi-stage/ · https://docs.docker.com/compose/ ·
  https://docs.github.com/en/actions

## Observability
- **In this repo:** JSON structured logs, `traceId` in every ProblemDetails, liveness/readiness health checks;
  OpenTelemetry planned.
- **Q:** *Logs vs metrics vs traces?* — Logs: discrete events with context; metrics: aggregated numbers for alerting;
  traces: the path of one request across components.
- Deep dive: [16](../engineering-decisions/16-observability-and-monitoring.md).
- Official: https://learn.microsoft.com/en-us/dotnet/core/extensions/logging · https://opentelemetry.io/docs/languages/dotnet/

## Cloud and distributed systems
Design-only material: [12 AI/RAG](../engineering-decisions/12-ai-integration-and-rag.md),
[13 caching](../engineering-decisions/13-caching-strategy.md),
[15 Azure](../engineering-decisions/15-cloud-and-azure-architecture.md),
[ADR-0010 payment outside the transaction](../adr/0010-payment-outside-the-order-transaction.md).
- **Q:** *How do you keep data consistent without distributed transactions?* — Local transactions + transactional
  outbox + idempotent consumers; sagas with compensations for multi-step business processes.
- Official: https://learn.microsoft.com/en-us/azure/container-apps/overview ·
  https://learn.microsoft.com/en-us/azure/architecture/patterns/
