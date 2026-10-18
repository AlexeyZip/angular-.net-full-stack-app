# 02 — Modular monolith vs microservices

## 1. Problem
Choose a deployment and module architecture that keeps business integrity simple today and allows extraction later.

## 2. Context
One developer, one database, a checkout that must update stock, payment outcome and the order atomically.

## 3. Options
(a) Layered monolith (Controllers/Services/Repositories folders); (b) **modular monolith** (feature folders with
seams); (c) microservices (catalog, ordering, identity) with a broker.

## 4. Chosen approach
A modular monolith: `services/api/src/Shop.Api/Features/{Catalog,Auth,Orders,Wishlist,Admin}` each own their
controller, service(s) and contracts; `Domain/` is shared; `Infrastructure/` is cross-cutting.

## 5. Why
- **ACID instead of sagas:** `CheckoutService` uses one PostgreSQL transaction. With separate Catalog and Ordering
  services the same guarantee needs a reservation saga, compensations, an outbox and idempotent consumers.
- One deployable, one log stream, one test host (`WebApplicationFactory`) — everything is debuggable locally.
- Feature folders keep change local: a checkout change touches `Features/Orders` and rarely anything else.

## 6. Trade-offs
Modules share one `ShopDbContext` and can join each other's tables — boundaries are by convention, not enforced.
Scaling is all-or-nothing.

## 7. Simpler alternative
A classic layered monolith is simpler to start but groups code by technical role, so a feature is spread across
folders; it scales worse as features grow.

## 8. Rejected
Microservices: no independent teams, no divergent scaling needs, and they would replace a 30-line transaction with
distributed coordination (see the cost list in 22).

## 9. References
`Program.cs` (one composition root), `Features/*`, `CheckoutService.cs`.

## 10. Code — the seam that would become a service boundary
```csharp
// Features/Orders/CheckoutService.cs reads products only through a narrow projection
var products = await db.Products.AsNoTracking()
    .Where(p => productIds.Contains(p.Id) && p.IsActive)
    .Select(p => new { p.Id, p.Name, p.Price })
    .ToDictionaryAsync(p => p.Id, cancellationToken);
```
If Catalog became a service, this projection is the API it would expose ("price and availability for ids").

## 11. Failure scenarios
A bug or memory leak in one module takes down all of them; mitigated by health checks and restarts.

## 12. Testing
Full-flow integration tests in-process; no contract tests between services needed.

## 13. Performance / security
No network hops between modules; one security boundary to harden.

## 14. When microservices are better
Several teams with independent release cycles; a module with very different scaling/availability (search, payments);
regulatory isolation (payments/PCI). Extraction path: enforce module boundaries (separate `DbContext` per module or
schema), introduce an outbox and integration events, then move one module out behind an API.

## 15. Interview explanation
"I built a modular monolith because checkout needs a single transaction; the feature folders are the future service
boundaries, and I documented what extraction would require — an outbox, a reservation saga and contract tests."

## 16. Evidence
Implemented; verified at runtime by integration tests (40/40) and E2E (46/46). Microservices: design only.
