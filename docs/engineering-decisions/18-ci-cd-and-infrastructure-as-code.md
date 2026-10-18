# 18 — CI/CD and infrastructure as code

**Status:** CI workflow implemented and green on GitHub (first run: all three jobs passed).
Containers built and verified with the full E2E suite through nginx. IaC: design.

## 1. Problem
Every change must be linted, tested and built for both stacks and both state variants automatically, with the same
commands developers run locally.

## 2. Context
GitHub Actions (free for public/limited private use); ubuntu runners have Docker (Testcontainers works there).

## 3. Options
One job running everything; **separate jobs per stack + an E2E job**; Nx affected-only runs; self-hosted runners.

## 4. Chosen approach — `.github/workflows/ci.yml`
| Job | Steps |
| --- | --- |
| `frontend` | Node 22, npm 11, `npm ci`, `nx run-many -t lint test`, both production builds, assert the Signals bundle contains no `@ngrx/store` |
| `backend` | `setup-dotnet` from `services/api/global.json`, `dotnet tool restore`, build Release, unit tests, integration tests (Testcontainers), `dotnet ef migrations has-pending-model-changes` |
| `e2e` | needs both; PostgreSQL service container on 5433; Playwright Chromium; `nx e2e web-e2e` (both variants); traces/report uploaded on failure |

Also: `permissions: contents: read`, `concurrency` cancels superseded runs, no secrets required (dev placeholders).

## 5. Why
Separate jobs give fast, parallel feedback and clear ownership (frontend vs backend failures). The schema check
catches "changed the model, forgot the migration".

## 6. Trade-offs
`run-many` (not `affected`) is simpler but runs everything; fine at this size. No caching of NuGet packages yet.

## 7. Simpler alternative
Local scripts only — no protection for the main branch.

## 8. Rejected
Nx Cloud / remote caching (external service). Deploy jobs (no approved target).

## 9. References
`.github/workflows/ci.yml`, `services/api/Dockerfile`, `apps/web/Dockerfile`, `apps/web/nginx.conf`,
`docker-compose.yml`, `.dockerignore`, `services/api/.dockerignore`.

## 10. Code
```yaml
- name: Signals bundle must not contain NgRx
  run: |
    if grep -rl "@ngrx/store" dist/apps/web/browser --include=*.js; then
      echo "NgRx code leaked into the Signals build" && exit 1
    fi
```

## 11. Failure scenarios / risks
First run may fail on platform-specific npm packages or Playwright timing — expected teething issues, not verified.

## 12. Testing the pipeline
Push to a GitHub repository (requires the user's decision; not done). Locally, every command in the workflow,
including integration tests and E2E, was executed successfully (session 2).

## 13. Security
Least-privilege token; pinned major action versions (`@v4`); for deployments use OIDC federation instead of stored cloud
credentials.

## 14. IaC plan
Bicep in `infra/bicep` (see 15) validated with `az bicep build` and `what-if` in CI; deployment gated by environment
approvals. Not created.

## 15. Interview explanation
"Three jobs: frontend lint/test/build for both variants with a bundle check, backend build with unit and Testcontainers
integration tests plus a migration drift check, and Playwright E2E against a Postgres service container for both state
variants."

## 16. Evidence
GitHub Actions run 39149844984 on commit `e65cd54`: Backend, Frontend and E2E jobs succeeded. The same steps were
also run locally:
lint/test/builds, backend build + unit + integration tests, migration check, `nx e2e web-e2e` (46/46).
Images: `docker compose --profile full build` ✅.
