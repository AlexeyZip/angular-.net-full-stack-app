# EF Core and PostgreSQL

## Entity Framework Core

### DbContext, configurations, naming
- `ShopDbContext` calls `ApplyConfigurationsFromAssembly`, picking up the `IEntityTypeConfiguration<T>` classes in
  `EntityConfigurations.cs`;
  `UseSnakeCaseNamingConvention()` maps `StockQuantity` → `stock_quantity` (PostgreSQL convention).
- **Q:** *Why a scoped DbContext?* — It tracks entities for one unit of work and is not thread-safe.

### Read queries: tracking, projection, N+1
```csharp
// CatalogService.cs — AsNoTracking + projection: one SELECT with only the needed columns, no N+1
.Select(p => new ProductSummaryDto(p.Id, p.Name, p.Slug, p.Brand, p.Price, p.ImageUrl,
    p.Category.Slug, p.Category.Name, p.StockQuantity, p.AverageRating, p.ReviewCount))
```
Navigation properties inside a projection become JOINs; no `Include` needed.
- **Mistakes:** returning entities from controllers (over-fetching, cycles, lazy loading); loading in a loop (N+1);
  multiple collection `Include`s (cartesian explosion → `AsSplitQuery`).
- **Debugging:** set `Microsoft.EntityFrameworkCore.Database.Command` to `Information` to log SQL; `ToQueryString()`.

### Writes: change tracking, set-based updates, transactions
- Tracked entities + `SaveChangesAsync` for normal updates (admin product edit with concurrency token).
- `ExecuteUpdateAsync` for atomic, conditional set-based updates (stock decrement in checkout, relative stock
  adjustment) — one SQL statement, no read-modify-write race.
- Explicit transactions (`BeginTransactionAsync` + `await using`) when several statements must commit together.
- **Note:** `ExecuteUpdate` bypasses the change tracker and concurrency tokens — intentional here; see
  [ADR-0007](../adr/0007-checkout-and-inventory-concurrency.md).

### Concurrency tokens
```csharp
builder.Property(o => o.Version).IsRowVersion();                        // Order → PostgreSQL xmin system column
db.Entry(product).Property(p => p.Version).OriginalValue = request.Version; // Product: explicit version from the client
```
Mismatch ⇒ `DbUpdateConcurrencyException` ⇒ 409 `concurrency_conflict`.

### Migrations
- Code-first migrations in `Infrastructure/Persistence/Migrations`; `dotnet ef migrations add <Name>` from
  `services/api` (tool pinned in `services/api/dotnet-tools.json`, restored with `dotnet tool restore`).
- CI and local check: `dotnet ef migrations has-pending-model-changes` (model and migrations in sync — verified).
- Applied automatically only in Development (`Database:ApplyMigrationsOnStartup`); in production as a pipeline step
  (migration bundle). Destructive changes require an expand/contract plan (add column → backfill → switch → drop).

### Testing
Never with the InMemory provider (no SQL semantics) — Testcontainers PostgreSQL (`ApiFixture.cs`).

## PostgreSQL

### Indexes and search
- `pg_trgm` extension + GIN trigram index on `products.name` for `ILIKE '%term%'` (`EntityConfigurations.cs`).
  Brand uses a b-tree index (exact-match filter).
- User input is escaped before `ILIKE` (`EscapeLikePattern`), with `\` declared as the escape character.
- Unique indexes enforce invariants the application also checks: emails, slugs, `(user_id, idempotency_key)`, one
  review per user and product.
- **Q:** *Why can't a b-tree serve `LIKE '%x%'`?* — B-trees order by prefix; a leading wildcard has no prefix.
  Trigram GIN indexes split strings into 3-character pieces.

### Pagination
Offset pagination with a deterministic order (`... ThenBy(p => p.Id)`) and a page-size cap (48). Trade-off vs keyset
pagination in [09](../engineering-decisions/09-pagination-and-query-performance.md).

### Transactions and isolation
Default `READ COMMITTED`. Correctness under concurrency comes from **conditional updates** (`WHERE stock_quantity >=
@q`) which re-check the condition on the latest committed row version, and from consistent lock ordering
(lines sorted by product id). See [08](../engineering-decisions/08-database-transactions-and-concurrency.md).

### `xmin`
A system column holding the id of the transaction that last wrote the row; it changes on every update, making it a
free row version (Npgsql maps it via `IsRowVersion()` on a `uint`).

### Debugging
`EXPLAIN (ANALYZE, BUFFERS) SELECT ...` to verify index usage; `pg_stat_statements` for slow queries in real
environments (not enabled locally).

## Interview questions
1. **Tracking vs no-tracking?** — Tracking is needed to save changes; read-only queries skip the snapshot cost.
2. **How do you prevent overselling?** — Atomic conditional update (or `SELECT ... FOR UPDATE`) inside a transaction;
   never read-then-write in application code without a lock/condition.
3. **Optimistic vs pessimistic concurrency?** — Optimistic: detect conflicts at save (version), good for low contention
   and human edits; pessimistic: lock rows, good for short, high-contention critical sections.
4. **Why not EF InMemory for tests?** — It is not a relational database: no transactions, constraints or SQL functions.
5. **How do you deploy migrations safely?** — Separate step, backwards-compatible (expand/contract), tested on a copy.

## Official documentation
- https://learn.microsoft.com/en-us/ef/core/querying/tracking
- https://learn.microsoft.com/en-us/ef/core/saving/execute-insert-update-delete
- https://learn.microsoft.com/en-us/ef/core/saving/concurrency
- https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/
- https://www.npgsql.org/efcore/
- https://www.postgresql.org/docs/current/pgtrgm.html
- https://www.postgresql.org/docs/current/transaction-iso.html
- https://www.postgresql.org/docs/current/ddl-system-columns.html
- https://www.postgresql.org/docs/current/using-explain.html
