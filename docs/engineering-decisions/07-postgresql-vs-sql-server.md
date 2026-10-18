# 07 — PostgreSQL vs SQL Server

## 1. Problem
Choose the relational database for local development, CI and a possible cloud deployment.

## 2. Context
.NET is traditionally paired with SQL Server; the project requires PostgreSQL; local-first, free tooling.

## 3. Options
PostgreSQL 17; SQL Server 2022 (Developer/Express); SQLite.

## 4. Chosen approach
PostgreSQL 17 (`postgres:17-alpine`), Npgsql EF Core provider, features used deliberately:
`xmin` system column as a row version (orders), CHECK constraints, partial-free unique indexes, `ILIKE`,
`pg_trgm` GIN index for substring search on product names, `jsonb` for audit details.

## 5. Why
Free and identical in Docker, CI service containers and managed cloud offerings (Azure Database for PostgreSQL
Flexible Server); strong standards compliance; trigram indexes make `%term%` search indexable.

## 6. Trade-offs
Some .NET tutorials assume SQL Server (`rowversion`, `NEWSEQUENTIALID`); equivalents differ (`xmin`, UUIDv7 via
`Guid.CreateVersion7` in `Order`). Case sensitivity differs: `=` is case-sensitive, hence `ILIKE` for search and
normalized emails.

## 7. Simpler alternative
SQLite — no server, but no row-level locking semantics, no `xmin`, different SQL; unsuitable for concurrency tests.

## 8. Rejected
SQL Server: equally capable (snapshot isolation, `rowversion`), but heavier container image, licensing questions
beyond Developer edition, and not what the requirement asks for.

## 9. References
`docker-compose.yml`, `Infrastructure/Persistence/EntityConfigurations.cs` (trigram index, CHECKs, jsonb),
migration `20261018144630_InitialCreate.cs` (`CREATE EXTENSION pg_trgm`).

## 10. Code
```csharp
builder.HasIndex(p => p.Name).HasMethod("gin").HasOperators("gin_trgm_ops");   // makes ILIKE '%lamp%' indexable
builder.Property(o => o.Version).IsRowVersion();                                // maps to xmin on PostgreSQL
```

## 11. Failure scenarios
Extension `pg_trgm` must be available (it is in the official image and managed offerings); migrations create it.

## 12. Testing
Testcontainers uses the same image as compose and CI (`postgres:17-alpine`).

## 13. Performance / security
Trigram GIN index for name search; brand search is also `ILIKE` but only has a b-tree index (not usable for
`%x%`) — acceptable at this size, noted for 09.

## 14. When SQL Server is better
An organization standardized on SQL Server/Azure SQL, needing SSRS/SSIS or existing DBA expertise.

## 15. Interview explanation
"PostgreSQL gives me a free, identical database locally, in CI and in the cloud. I use `xmin` for optimistic
concurrency on orders, CHECK constraints for invariants and a trigram index for substring search."

## 16. Evidence
Migration SQL inspected (extension, indexes, constraints) and applied to PostgreSQL 17 (Testcontainers and the compose
database); integration tests 40/40.
