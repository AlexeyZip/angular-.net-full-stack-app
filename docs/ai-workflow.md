# AI-assisted engineering workflow

How the AI assets in this repository fit together and how to use them in Cursor.

| Asset | Location | Loaded |
| --- | --- | --- |
| Repository instructions | `AGENTS.md` | always (read by Cursor and most coding agents) |
| Scoped rules | `.cursor/rules/*.mdc` | `alwaysApply: true` always; others when matching files are in context (`globs`) |
| Skills | `.cursor/skills/<name>/SKILL.md` | the agent picks one by its `description`, or you name it (`/full-stack-feature`) |
| Subagents | `.cursor/agents/<name>.md` | the main agent delegates to them, or you ask for one by name |

**Verification status (honest):** the files follow the formats documented for current Cursor versions (frontmatter
`description/globs/alwaysApply` for rules, `name/description` for skills and subagents). Their content was checked
against the code. Whether each one is picked up automatically was not tested in an automated way; confirm in
*Cursor Settings → Rules / Skills / Subagents* after opening the project.

## Rules

| Rule | Applies to | Purpose |
| --- | --- | --- |
| `project-workflow.mdc` | always | session start/end, honest verification, tracking files, no commits/cloud without approval |
| `angular-frontend.mdc` | `apps/web/src/**`, `libs/shared/**` | component, template, forms, data-access conventions |
| `state-management.mdc` | `libs/state/**`, `apps/web/src/app/state/**` | dual Signals/NgRx rules, race handling, rollback |
| `dotnet-backend.mdc` | `services/api/**/*.cs` | feature layout, AppException codes, authorization, audit |
| `ef-core-postgres.mdc` | `Persistence/**`, `Domain/**` | migrations, constraints, atomic updates, concurrency tokens |
| `testing.mdc` | specs, backend tests, E2E | test levels, naming, selectors, no weakening assertions |
| `security-and-api.mdc` | API features, auth, data-access | server authority, token model, REST/error shape, idempotency |

## Skills

| Skill | Use it for | Example prompt |
| --- | --- | --- |
| `full-stack-feature` | a feature across DB → API → UI | "Use full-stack-feature: customers can save shipping addresses and pick one at checkout." |
| `aspnet-endpoint` | one API endpoint | "Add `GET /api/orders/{id}/invoice` returning a PDF-free summary DTO, owner-only." |
| `ef-migration` | schema changes | "Add a `low_stock_threshold` column to products with a CHECK >= 0 and a migration." |
| `state-feature` | shared state in both variants | "Add 'recently viewed products' to state in both Signals and NgRx with contract tests." |
| `writing-tests` | coverage | "Write integration tests for category rename conflicts." |
| `debugging-failures` | red builds/tests | "`npx nx test state-ngrx` fails after my change — find the root cause." |
| `code-review` | reviews | "Review my uncommitted changes with the code-review skill." |
| `docs-and-progress` | keeping docs honest | "Update PROGRESS, backlog and traceability for what we just did." |
| `interview-prep` | learning | "Quiz me on how checkout prevents overselling, one question at a time." |

## Subagents

| Agent | Responsibility | Boundary |
| --- | --- | --- |
| `angular-frontend` | UI, data-access, both state variants | does not edit `services/**` |
| `dotnet-backend` | API, domain, EF Core, migrations, backend tests, DB review | does not edit Angular code |
| `qa-tester` | write/run tests, diagnose failures | test code; product fixes only for clear bugs |
| `architecture-security-reviewer` | read-only review | never edits |

Delegation guidance: split work by layer (backend agent first when the API contract changes, then frontend), never run
two agents on the same files in parallel, and always finish with an integration check run by the main agent
(`npx nx run-many -t lint test`, `dotnet build`, E2E when possible).

Example: *"Implement product Q&A: use dotnet-backend for the API and migration, then angular-frontend for the UI,
then qa-tester for E2E, then architecture-security-reviewer on the full diff."*

## Starting a new session

Copy the continuation prompt from the end of `docs/project/PROGRESS.md`.
