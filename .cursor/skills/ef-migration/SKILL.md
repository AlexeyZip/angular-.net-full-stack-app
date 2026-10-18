---
name: ef-migration
description: Performs safe EF Core schema changes for PostgreSQL in Shop.Api - model and configuration updates, migration generation, SQL review, constraint and index design, and verification. Use when adding or changing entities, columns, indexes, constraints or concurrency tokens, or when the user mentions migrations or the database schema.
---

# EF Core schema change

## Steps

1. Change the entity in `services/api/src/Shop.Api/Domain/` (private setters, invariants in methods).
2. Map it in `Infrastructure/Persistence/EntityConfigurations.cs`: precision for money (`HasPrecision(12, 2)`), max
   lengths, `HasCheckConstraint` mirroring domain invariants, indexes for every filter/sort/foreign key you query.
3. Generate (from `services/api`):
   ```powershell
   dotnet ef migrations add <PascalCaseName> --project src/Shop.Api --output-dir Infrastructure/Persistence/Migrations
   ```
4. **Review the SQL**, not just the C#:
   ```powershell
   dotnet ef migrations script <PreviousMigration> <PascalCaseName> --project src/Shop.Api
   ```
   Look for: unintended drops/renames (EF emits drop+add for renames unless told), `NOT NULL` added to populated tables
   without a default, table rewrites/locks on large tables, missing indexes.
5. Destructive or data-changing steps need an expand → migrate data → contract plan across releases. Never edit a
   migration that may already be applied anywhere; add a new one.
6. Update `DevelopmentSeeder.cs` if seed data must reflect the change (seeding must stay idempotent).
7. Verify:
   ```powershell
   dotnet build Shop.sln
   dotnet ef migrations has-pending-model-changes --project src/Shop.Api   # must report no changes
   dotnet test --project tests/Shop.Api.IntegrationTests                   # applies all migrations to a fresh DB
   ```
8. Document notable decisions in `docs/engineering-decisions/08-*.md` or `20-*.md`.

## Concurrency choices (this repo)

- Concurrent counters (stock, rating totals): atomic relative `ExecuteUpdateAsync`, not a concurrency token.
- Editable documents (product details): explicit `Version` token, incremented by the domain method.
- Rows changed only by state transitions (orders): PostgreSQL `xmin` via `IsRowVersion()`.
