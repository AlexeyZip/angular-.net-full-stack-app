# 13 — Caching strategy

**Status:** HTTP-level caching for static assets is configured and verified (nginx response headers); API/data caching is
DESIGN_ONLY (backlog A-04).

## 1. Problem
Reduce latency and database load for read-heavy catalog traffic without ever showing wrong prices or stock at checkout.

## 2. Context
Prices/stock change through admin edits and every checkout. Correctness at checkout is non-negotiable.

## 3. Options
Browser/HTTP caching; ASP.NET Core Output Caching (in-memory or Redis) with tag invalidation; `IMemoryCache`/
`HybridCache` in services; client-side store caching; CDN.

## 4. Chosen approach (current)
- **Static assets:** hashed bundles `Cache-Control: public, max-age=31536000, immutable`; `index.html` `no-cache`
  (`apps/web/nginx.conf`), so deployments are picked up immediately.
- **Client:** the catalog store is an application-wide singleton (registered by `provideSignalsState()`): `open()` without URL filters reuses already-loaded results
  (it only fetches when the store is `idle`); `open()` with URL filters always reloads, because the URL is the source
  of truth. Categories are requested once per store lifetime (`categoriesRequested`).
- **API:** no server cache. Checkout and quotes always read the database.

## 5. Why
No measured performance problem; every cache adds an invalidation problem. The client-side reuse is free and safe
because checkout re-prices on the server.

## 6. Trade-offs
Each catalog view hits PostgreSQL (indexed queries).

## 7. Simpler alternative
This is the simple baseline.

## 8. Rejected for now
Caching quotes or stock (stale data → wrong checkout expectations); caching per-user responses in shared caches.

## 9. References
`apps/web/nginx.conf`, `libs/state/signals/src/lib/signals-catalog.store.ts` (`open`, `categoriesRequested`).

## 10. Proposed code (A-04)
```csharp
builder.Services.AddOutputCache(o => o.AddPolicy("catalog", p => p.Expire(TimeSpan.FromSeconds(30)).Tag("catalog")));
// CatalogController: [OutputCache(PolicyName = "catalog")] on GET products/categories
// AdminCatalogService after SaveChanges: await outputCacheStore.EvictByTagAsync("catalog", ct);
```
Stock shown in the catalog may then be up to 30 s old — acceptable because checkout re-validates atomically.

## 11. Failure scenarios
Multi-instance: in-memory output cache diverges per instance → Redis output cache store, or accept short TTLs.

## 12. Testing
Integration test: admin edit evicts the tag and the next GET reflects it.

## 13. Security
Never cache responses that depend on `Authorization`; Output Caching skips authenticated requests by default.

## 14. When to add it
When load tests or production metrics show catalog read latency/DB CPU problems.

## 15. Interview explanation
"Hashed static assets are cached forever, the HTML never. I haven't cached API data because there is no measured
need; my plan is output caching with tags evicted by admin writes, never caching checkout or per-user data."

## 16. Evidence
Checked with `curl -D -` against the compose stack: `main-*.js` → `Cache-Control: public, max-age=31536000,
immutable`; `/` and deep links → `no-cache`. Server caching not implemented.
