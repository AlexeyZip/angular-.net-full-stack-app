# AGENTS.md — instructions for AI coding agents

NorthwindShop: Angular 21 (Nx) storefront + admin, ASP.NET Core 10 API, EF Core 10, PostgreSQL 17.
This file is short on purpose; details live in `docs/` and in the scoped rules under `.cursor/rules/`.

## Before you change anything

1. Read `docs/project/PROGRESS.md` (current state + next task), `IMPLEMENTATION_BACKLOG.md`, `KNOWN_ISSUES.md`.
2. Read the engineering decision for the area you touch (`docs/engineering-decisions/NN-*.md`) and the code around
   it. Extend existing patterns; do not replace working architecture or refactor unrelated code.
3. Check `git status`. Never reset, delete or overwrite work you did not create. Do not commit unless asked.

## Architecture boundaries (enforced by lint)

- `apps/web` features inject **contracts** (`CatalogStore`, `CartStore`, `WishlistStore` from `@shop/state/contracts`).
  Only `apps/web/src/app/state/*.providers*.ts` may import `@shop/state/signals` or `@shop/state/ngrx`.
- The two state implementations never import each other. A behaviour change goes into **both** plus the shared
  contract suite `libs/state/contracts/src/testing/state-contract-suite.ts`.
- `libs/shared/ui` is presentational: no HTTP, no state. `libs/shared/data-access` owns HTTP, auth and API models.
- Backend: `Features/<Module>/` (controller + service + contracts), `Domain/` (entities enforce invariants),
  `Infrastructure/` (EF Core, auth, errors). Services use `ShopDbContext` directly — no repository layer.
- Nx manages only the Node/Angular side. Build and test .NET with the `dotnet` CLI in `services/api`.

## Non-negotiable rules

- The server is the authority for prices, totals, stock, user identity and roles. Never trust client values.
- Never put tokens, passwords or personal data in NgRx/Signals state or `localStorage`.
- No real secrets in the repo; only `DEV-ONLY-` placeholders. No real payment integration (use `PaymentSimulator`).
- No cloud provisioning, deployments or paid services without explicit user approval.
- Errors leave the API as ProblemDetails with a stable `code` (`AppException`); the UI maps `code`, not message text.
- Schema changes go through EF Core migrations; never edit an applied migration; no destructive data operations.

## Verify before claiming success

| Change | Run |
| --- | --- |
| Frontend | `npx nx run-many -t lint test` and `npx nx run web:build:production` (+ `production-ngrx` for state changes) |
| Backend | in `services/api`: `dotnet build Shop.sln`, `dotnet test --project tests/Shop.Api.UnitTests`, and integration tests when PostgreSQL/Docker is available |
| Schema | `dotnet ef migrations has-pending-model-changes --project src/Shop.Api` |
| User journeys | `npx nx e2e web-e2e` (needs PostgreSQL) |

Report exactly what ran and what did not. Never claim a check passed that was not executed (see KI-01: no database
in the original authoring environment).

## After a change

Update `docs/project/PROGRESS.md`, the backlog status, `KNOWN_ISSUES.md` and `REQUIREMENTS_TRACEABILITY.md` with
real evidence; update the affected engineering decision / ADR when behaviour or architecture changed.

## Conventions

- TypeScript strict, standalone components, `OnPush`, signal inputs/outputs, new control flow, typed reactive forms,
  selector prefix `shop`. Prefer `computed` for derived state and `effect` only for real side effects.
- C#: nullable enabled, warnings are errors, primary constructors for services, records for DTOs, `CancellationToken`
  through every async call, `TimeProvider` instead of `DateTime.UtcNow`.
- Tests: behaviour-named (`Concurrent_buyers_cannot_oversell_the_last_units`), no snapshot-only tests, E2E selectors by
  role/label first, `data-testid` second.
- Comments explain constraints and *why*, not *what*.

## AI workflow assets

Rules: `.cursor/rules/*.mdc` · Skills: `.cursor/skills/*/SKILL.md` · Subagents: `.cursor/agents/*.md`.
How to use them, with example prompts: `docs/ai-workflow.md`.
