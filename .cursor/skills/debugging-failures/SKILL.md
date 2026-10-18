---
name: debugging-failures
description: Systematically diagnoses failing builds, lint errors, unit/integration/E2E test failures and runtime errors in the Nx/Angular and .NET parts of NorthwindShop. Use when a command fails, a test is red or flaky, or the app misbehaves at runtime.
---

# Debugging failures

1. **Reproduce the smallest failing command** and keep its full output:
   - one Nx project: `npx nx test web --skip-nx-cache`, `npx nx lint state-ngrx`;
   - one .NET test: `dotnet test --project tests/Shop.Api.UnitTests --filter-method "*Pricing*"`;
   - one E2E test: `npx playwright test --config apps/web-e2e/playwright.config.ts -g "declined" --project=signals`.
2. **Read the first error**, not the last. Classify: environment (missing Docker/DB, npm version), compile/type,
   lint rule, assertion, timeout.
3. **Environment checks** (known in this repo, see `docs/project/KNOWN_ISSUES.md`):
   - `docker info` fails → integration/E2E cannot run (KI-01); use `SHOP_TEST_CONNECTION_STRING` or record the blocker;
   - npm install errors in arborist → use npm 11 (KI-02);
   - stale Nx cache → `--skip-nx-cache` or `npx nx reset`.
4. **Hypothesis → evidence**: change one thing at a time. For E2E use traces:
   `npx playwright show-trace dist/.playwright/web-e2e/test-results/<test>/trace.zip`.
   For API errors use the ProblemDetails `traceId` and API logs; for EF use
   `Logging:LogLevel:Microsoft.EntityFrameworkCore.Database.Command=Information` (Development default).
5. **Fix the cause**, not the symptom. Never weaken an assertion, add sleeps, or disable a rule without a written
   reason. If the test's assumption was wrong, fix the test and say why.
6. **Re-run** the failing command, then the broader suite (`npx nx run-many -t lint test`, `dotnet build`).
7. Record anything non-obvious in `KNOWN_ISSUES.md` (and the fix in `PROGRESS.md`).

## Common causes here

| Symptom | Likely cause |
| --- | --- |
| UI does not update in a unit test | zoneless: missing `TestBed.tick()` / `fixture.whenStable()`; host not `OnPush` with signals |
| 409 `concurrency_conflict` in admin | stale `Version` in the form; reload the product |
| 400 `csrf_header_missing` | request to `/api/auth/refresh|logout` without `X-Shop-Client` |
| E2E login flake | rate limit (E2E web server raises limits via env); cookie from another dev server (KI-12) |
| `DockerUnavailableException` | integration tests without Docker (KI-01) |
