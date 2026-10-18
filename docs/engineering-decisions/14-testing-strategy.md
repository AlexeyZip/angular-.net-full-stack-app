# 14 — Testing strategy

## 1. Problem

Prove the business guarantees (money, stock, idempotency, authorization) and that two state implementations behave
identically — with tests that are fast enough to run constantly and realistic enough to catch real bugs.

## 2. Context and constraints

Two stacks; PostgreSQL-specific behaviour (row locks, `xmin`, CHECK constraints, `ILIKE`, `pg_trgm`); zoneless Angular;
the authoring environment had no Docker (KI-01), which shaped the split between unit and integration projects.

## 3. Options considered

- Mock-heavy unit tests for everything (EF Core InMemory, mocked HttpClient).
- **Layered: pure unit tests + integration tests on real PostgreSQL + a focused E2E suite.**
- E2E-only.

## 4. Chosen approach — the test map

| Level | Tool | Project | What it proves | Count (2026-10-18) | Runs without DB |
| --- | --- | --- | --- | --- | --- |
| Backend unit | xUnit v3 | `services/api/tests/Shop.Api.UnitTests` | pricing, state machine, domain invariants, slugs, LIKE escaping, password policy, fingerprint, simulator | 42 ✅ | yes |
| Backend integration | xUnit v3 + `WebApplicationFactory` + Testcontainers PostgreSQL 17 | `services/api/tests/Shop.Api.IntegrationTests` | HTTP contracts, auth, SQL, transactions, concurrency, idempotency | 40 ✅ | no (Docker) |
| State contract | Vitest + TestBed | `libs/state/contracts/src/testing` run from `state-signals` and `state-ngrx` | both variants satisfy the same behaviour (races, rollback, identity changes) | 15 + 15 shared cases ✅ | yes |
| Frontend unit | Vitest | all 6 frontend projects | reducers/selectors, persistence, interceptor, session, validators, query-param parsing, UI components | 101 total ✅ | yes |
| E2E | Playwright | `apps/web-e2e` | 13 required journeys + failure paths, each in both variants | 46 ✅ (dev servers and compose) | no (PostgreSQL) |

## 5. Why

- **Real PostgreSQL for integration tests.** The bugs that matter here (overselling, lost updates, false conflicts)
  depend on row locks, constraints and `xmin`. EF Core InMemory has none of these and would pass broken code.
- **One contract suite for two implementations.** Writing tests against the abstract `CartStore`/`CatalogStore`/
  `WishlistStore` both documents and enforces "same behaviour"; implementation-specific tests are limited to pure
  NgRx reducers/selectors.
- **Unit/integration split.** `[assembly: AssemblyFixture(typeof(ApiFixture))]` starts PostgreSQL for every test in an
  assembly; pure tests were moved to their own project so they run anywhere (and they caught real issues while the
  database was unavailable).

## 6. Trade-offs

Integration tests need Docker (or a test database) and take seconds to start; E2E needs the whole stack. CI provides
both (`.github/workflows/ci.yml`).

## 7. Simpler alternatives

E2E-only would cover journeys but makes concurrency, error codes and race conditions hard to target and slow to debug.

## 8. Rejected alternatives

EF Core InMemory / SQLite (different SQL semantics); snapshot tests for components (brittle, low signal); mocking
`DbContext`.

## 9. Implementation references

- `services/api/tests/Shop.Api.IntegrationTests/ApiFixture.cs` — container or `SHOP_TEST_CONNECTION_STRING` (refuses
  databases whose name lacks `test`), helpers to register users/sign in as admin/create products.
- `libs/state/contracts/src/testing/state-contract-suite.ts`, `test-data.ts`.
- `apps/web-e2e/src/support/api.ts` (API arrangement, unique data), `fixtures.ts` (`customer`, `adminApi` fixtures).
- `apps/web-e2e/playwright.config.ts` — projects `signals` (4200) and `ngrx` (4300), web servers for API + both variants.

## 10. Code

```ts
// libs/state/signals/src/lib/signals-state.contract.spec.ts
runStateContractSuite('signals', provideSignalsState);
// libs/state/ngrx/src/lib/ngrx-state.contract.spec.ts
runStateContractSuite('ngrx', provideNgrxState);
```

```csharp
// CheckoutApiTests.cs (shape)
[Fact]
public async Task Concurrent_buyers_cannot_oversell_the_last_units() { /* N parallel checkouts for stock K → exactly K succeed, stock = 0 */ }
```

## 11. Failure scenarios and limits

- Integration and E2E suites need Docker/PostgreSQL. They did not run in the first session (no Docker, KI-01) and
  first ran in session 2 — see the evidence section for what those first runs found.
- No coverage numbers are reported because none were measured.

## 12. Testing implications for new work

Every behaviour: happy path + failure path + "nothing changed after failure". Concurrency claims require a parallel
integration test. State changes require a contract-suite case. See `.cursor/skills/writing-tests/SKILL.md`.

## 13. Performance and security

Security tests are first-class: CSRF header, cookie flags, refresh reuse, tampered JWT, cross-user order access,
admin endpoints for customers, open-redirect guard, token-never-in-storage.

## 14. When a different approach is better

Large teams with many services → consumer-driven contract tests (Pact) between services; visual regression testing for
a design system.

## 15. Interview explanation

"Pure logic is unit-tested; anything involving SQL semantics runs against real PostgreSQL in Testcontainers through
WebApplicationFactory, including parallel checkouts to prove no overselling. On the frontend, one contract test suite
runs against both the Signals and the NgRx implementation, and Playwright runs every journey once per variant."

## 16. Evidence and confidence

All levels executed and passing (`docs/project/PROGRESS.md`): backend unit 42, integration 40, frontend unit 101,
E2E 46 (dev servers) + 46 (compose). The first real runs found two genuine defects that lower levels could not see —
validation attributes on record properties made every validated request a 500 (integration tests), and duplicate
`id`s in form errors (E2E) — plus four test-side races, all fixed. Confidence: high.
