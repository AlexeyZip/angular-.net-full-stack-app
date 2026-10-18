# ADR-0008: Testing approach

- **Status:** accepted
- **Date:** 2026-10-18
- **Implementation evidence:** backend unit tests (`Shop.Api.UnitTests`) 42/42; integration tests
  (`Shop.Api.IntegrationTests`, Testcontainers PostgreSQL) 40/40; frontend Vitest suites 101/101; Playwright suite
  `apps/web-e2e` 46/46 (both variants) on the dev servers and against the Docker Compose stack.
## Context
Most risk lives in SQL behaviour (concurrency, constraints, search), HTTP contracts (auth, status codes) and the two
frontend state implementations.

## Problem
Which test levels give confidence without becoming slow or brittle.

## Decision
- **Backend unit tests:** pure domain rules (pricing, order state machine, LIKE escaping).
- **Backend integration tests:** `WebApplicationFactory` + **real PostgreSQL via Testcontainers** (no in-memory
  provider — it hides SQL semantics), HTTP-level assertions on status codes and ProblemDetails codes.
- **Frontend unit tests (Vitest):** services, interceptors, validators, components; a **shared contract suite**
  executed against both Signals and NgRx stores, plus NgRx reducer tests.
- **E2E (Playwright):** 13 user journeys, run once per state variant against the real API and database; data created
  through the API with unique names so tests are independent.
- CI runs all levels (`.github/workflows/ci.yml`).

## Alternatives considered
- EF Core InMemory/SQLite for integration tests — different semantics (no `xmin`, no `ILIKE`, different concurrency).
- Snapshot tests for components — brittle, low signal.
- Mocked backend for E2E — would not satisfy spec 7.4.

## Consequences
High confidence once Docker is available; tests document behaviour.

## Trade-offs
Integration and E2E need Docker/PostgreSQL — currently the blocker.

## Revisit when
Suite duration grows (parallelise containers, share a database with transaction rollback).

See also: [`14-testing-strategy.md`](../engineering-decisions/14-testing-strategy.md).
