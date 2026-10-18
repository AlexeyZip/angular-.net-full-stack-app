# ADR-0009: Local development environment

- **Status:** accepted
- **Date:** 2026-10-18
- **Implementation evidence:** `docker-compose.yml`, `.env.example`, `services/api/Dockerfile`, `apps/web/Dockerfile`,
  `apps/web/nginx.conf`, `apps/web/nginx-security-headers.conf`, `apps/web/proxy.conf.json`.
  `docker compose --profile full build` and `up -d` succeed (postgres and api `healthy`, both web containers up); the E2E suite passes 46/46
  against the containers.

## Context
Monorepo with Nx (Angular) and native `dotnet` (API). The developer should run everything with free local tooling.

## Problem
How developers run the database, API and both frontend variants with minimal setup and without secrets.

## Decision
- **Default (inner loop):** `docker compose up -d postgres` (host port **5433**, bound to 127.0.0.1), API with
  `dotnet run` (port 5080, applies migrations and seeds in Development), `npx nx serve web` (4200, Signals) /
  `--configuration=development-ngrx` (4300). Angular dev server proxies `/api` → API, so the browser sees one origin.
- **Full stack in containers:** `docker compose --profile full up --build` → nginx-served production builds on
  8080 (Signals) and 8081 (NgRx), API not published (reached only via nginx), `TrustForwardedHeaders` on.
- Only development placeholders in `.env.example` / `appsettings.Development.json`; no real secrets anywhere.

## Alternatives considered
- Local PostgreSQL installation — works, but version drift and manual setup.
- .NET Aspire AppHost — attractive orchestration, but an additional moving part; compose is universally understood.
- CORS between separate origins — avoided; same-origin proxying keeps `SameSite=Strict` cookies working.

## Consequences
One-command database; the same images can be used in CI or cloud.

## Trade-offs
Requires Docker; port 5433 chosen to avoid clashing with a local PostgreSQL on 5432.

## Security and operational implications
All published ports bound to 127.0.0.1; containers run as non-root (`USER app`, `nginx-unprivileged`); CSP and
security headers in nginx.

## Revisit when
More services appear (consider Aspire) or a shared dev environment is needed.
