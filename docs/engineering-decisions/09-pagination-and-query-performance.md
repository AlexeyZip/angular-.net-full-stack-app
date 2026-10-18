# 09 — Pagination and query performance

## 1. Problem
Lists (catalog, orders, admin tables, reviews) must stay fast and deterministic as data grows, and pages must not
skip or repeat rows when sort values tie.

## 2. Context
Catalog ≈ hundreds to thousands of products; users jump to arbitrary pages; filters combine freely.

## 3. Options
Offset pagination (`OFFSET/LIMIT` + `COUNT`); keyset/cursor pagination (`WHERE (price, id) > (@p, @id)`);
client-side pagination.

## 4. Chosen approach
Server-side **offset pagination** with a **unique tiebreaker** in every sort and validated page sizes:

```csharp
// CatalogService.SearchProductsAsync — always end with a unique key
ProductSort.PriceAsc => products.OrderBy(p => p.Price).ThenBy(p => p.Id),
ProductSort.Rating   => products.OrderByDescending(p => p.AverageRating).ThenByDescending(p => p.ReviewCount).ThenBy(p => p.Id),
_                    => products.OrderByDescending(p => p.CreatedAt).ThenByDescending(p => p.Id),
```

`ToPagedResultAsync` (`Features/Shared/PagedResult.cs`) runs `CountAsync` + `Skip/Take` and returns
`{ items, page, pageSize, totalCount, totalPages }`. Indexes match the access paths: `(category_id, price)`,
`brand`, unique `slug`, trigram GIN on `name`, `(user_id, created_at)` and `(status, created_at)` on orders.
Denormalized `average_rating`/`review_count` avoid aggregating reviews on every catalog query.

## 5. Why
Users need "page N of M" and jumping; offset gives that simply. At this size the `OFFSET` cost is negligible.

## 6. Trade-offs
Deep offsets scan and discard rows; concurrent inserts can shift items between pages; `COUNT(*)` costs a second
query.

## 7. Simpler alternative
Client-side pagination — loads everything; unacceptable beyond small lists.

## 8. Rejected
Keyset pagination — better for infinite scroll and huge tables, but no random page access and more complex URLs.

## 9. References
`CatalogService.cs`, `OrderQueries.cs`, `AdminOrdersService.cs`, `PagedResult.cs`, `EntityConfigurations.cs` (indexes),
`apps/web/src/app/features/catalog/catalog-query-params.ts` (page parsed and capped at 10000).

## 10. Code — search that is safe and indexable
```csharp
var pattern = $"%{EscapeLikePattern(query.Search.Trim())}%";   // user "%" and "_" are literals
products = products.Where(p => EF.Functions.ILike(p.Name, pattern, @"\") || EF.Functions.ILike(p.Brand, pattern, @"\"));
```

## 11. Failure scenarios
`page` beyond the last page → empty list with correct totals (UI shows the empty state). Invalid page size → 400.

## 12. Testing
`Products_are_paginated_on_the_server`, `Filters_and_sorting_are_applied_together`,
`Search_is_case_insensitive_and_treats_wildcards_literally`; frontend query-param parsing tests.

## 13. Performance
Not benchmarked (no database available, and no numbers are claimed). Known gap: the `OR` with `brand ILIKE` cannot use
the name trigram index alone; a trigram index on `brand` (or a combined `tsvector`) would be the next step if search
latency is measured to matter.

## 14. When different
Infinite scroll, very large tables or real-time feeds → keyset pagination; analytics → materialized views.

## 15. Interview explanation
"Offset pagination with a deterministic order — every sort ends with the id — because users want numbered pages.
Indexes follow the filters, ratings are denormalized, and search escapes LIKE wildcards and uses a trigram index.
For infinite scroll or huge tables I'd switch to keyset pagination."

## 16. Evidence
Code and migration verified; paging, filters and sorting verified against PostgreSQL by integration tests and E2E
journeys 1–2b. Performance (EXPLAIN plans, load) not measured.
