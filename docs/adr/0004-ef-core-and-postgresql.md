# ADR-0004: EF Core with PostgreSQL

- **Status:** accepted
- **Date:** 2026-10-18
- **Implementation evidence:** `Infrastructure/Persistence/ShopDbContext.cs`, configurations, migrations;
  `dotnet ef migrations has-pending-model-changes` reports no changes. Migrations applied to PostgreSQL 17
  (Testcontainers and the compose database); integration tests 40/40.

## Context
Relational data with strong consistency (orders, stock), text search in the catalog, the developer already knows
PostgreSQL, everything must run locally for free.

## Problem
Which database and which data-access approach.

## Decision
PostgreSQL 17 via Npgsql + EF Core. Code-first migrations committed to the repository. Specific PostgreSQL features:
`pg_trgm` GIN index for `ILIKE` search on product names, `xmin` as row version for `Order`, `citext`-free email
handling (emails normalised to lower case + unique index). Bulk/atomic operations use `ExecuteUpdateAsync`
(conditional stock decrement) instead of raw SQL. Read paths use `AsNoTracking` projections to DTOs.

## Alternatives considered
- SQL Server — equally capable; PostgreSQL chosen for cost, Linux containers and the developer's background.
- Dapper — more control, but manual mapping/migrations; EF Core now covers set-based updates.

## Consequences
Strong typing, LINQ, migrations, testable with Testcontainers.

## Trade-offs
Must watch generated SQL (N+1, cartesian explosion); provider-specific features tie the schema to PostgreSQL.

## Security and operational implications
Parameterised queries by default; `LIKE` wildcards escaped; migrations applied on startup **only** in Development
(`Database:ApplyMigrationsOnStartup`), otherwise as a deployment step.

## Revisit when
A hot path needs hand-tuned SQL (add Dapper for that query only) or a reporting workload appears (read replica).

See also: [`06-ef-core-vs-dapper.md`](../engineering-decisions/06-ef-core-vs-dapper.md),
[`07-postgresql-vs-sql-server.md`](../engineering-decisions/07-postgresql-vs-sql-server.md).
