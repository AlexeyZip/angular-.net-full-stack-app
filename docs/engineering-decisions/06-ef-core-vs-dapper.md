# 06 — EF Core vs Dapper

## 1. Problem
Pick a data-access approach for a write-heavy-on-few-rows, read-heavy-on-lists application with strict invariants.

## 2. Context
.NET 10, PostgreSQL via Npgsql; need migrations, concurrency tokens, projections, atomic updates.

## 3. Options
EF Core; Dapper (micro-ORM, hand-written SQL); raw ADO.NET/Npgsql; EF Core + Dapper for hot paths.

## 4. Chosen approach
EF Core 10 only, used deliberately:
- reads: `AsNoTracking()` + `Select` projections → single SELECT with the needed columns (`CatalogService.cs`);
- writes with invariants: tracked entities + domain methods + `SaveChanges` (audit in the same unit of work);
- concurrent counters: **`ExecuteUpdateAsync`** — set-based SQL without loading entities (`CheckoutService`, `ReviewService`, `AdjustStockAsync`);
- concurrency tokens (`Version`, `xmin`), migrations, snake_case naming (`EFCore.NamingConventions`).

## 5. Why
EF Core now covers the cases that used to justify Dapper (bulk/atomic updates via `ExecuteUpdate`, projections,
raw SQL when needed) while adding migrations, change tracking and LINQ composition (the catalog filter builds the
query incrementally).

## 6. Trade-offs
Generated SQL must be reviewed (enable `Microsoft.EntityFrameworkCore.Database.Command` logging — on by default in
Development). `ExecuteUpdate` bypasses entity logic and the change tracker — hence DB CHECK constraints.

## 7. Simpler alternative
Dapper with SQL strings is simpler to reason about per query and slightly faster, but you hand-maintain mapping,
migrations (another tool) and dynamic filter SQL.

## 8. Rejected
Repository + Unit-of-Work wrappers over EF Core (see 22). Mixing Dapper in without a measured hot path.

## 9. References
`Infrastructure/Persistence/ShopDbContext.cs`, `EntityConfigurations.cs`, `Features/Catalog/CatalogService.cs`,
`Features/Orders/CheckoutService.cs`, `Features/Shared/PagedResult.cs`.

## 10. Code
```csharp
// Incremental, composable filtering (CatalogService.SearchProductsAsync)
var products = db.Products.AsNoTracking().Where(p => p.IsActive);
if (query.MinPrice is { } min) products = products.Where(p => p.Price >= min);
if (query.InStock == true) products = products.Where(p => p.StockQuantity > 0);
```

## 11. Failure scenarios
N+1 queries if navigation properties are lazily loaded — prevented: no lazy loading, projections only. Cartesian
explosion with multiple `Include`s — avoided by projecting.

## 12. Testing
Integration tests on real PostgreSQL (EF InMemory would hide SQL differences).

## 13. Performance
Projections and `AsNoTracking` remove tracking overhead on reads; `ExecuteUpdate` is one round trip per statement.

## 14. When Dapper is better
Complex reporting SQL (window functions, CTEs) or a measured hot path where EF's overhead matters; can coexist with
EF on the same connection.

## 15. Interview explanation
"EF Core for everything, but used like a SQL-aware developer: projections for reads, `ExecuteUpdate` for atomic
counters, explicit concurrency tokens, and reviewed migration SQL. I'd add Dapper only for a measured hot path or
complex reporting queries."

## 16. Evidence
Builds; migration SQL generated and inspected; migrations applied and every query exercised against PostgreSQL 17 by
the integration tests (40/40) and E2E (46/46).
