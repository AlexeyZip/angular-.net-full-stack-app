# 08 — Database transactions and concurrency

## 1. Problem

Several users act on the same rows at the same time:

- two buyers want the last unit of a product;
- a buyer double-clicks "Place order" or the network retries the request;
- an admin edits a product while customers are buying it;
- two admins change the same order's status;
- many customers review a product simultaneously.

Each must end in a correct state: no negative stock, no duplicate orders, no lost edits, no lost reviews, no
double restock.

## 2. Context and constraints

PostgreSQL 17 with its default `READ COMMITTED` isolation, EF Core 10, one API process (possibly several later).
Correctness must hold with several API instances, so in-process locks are not an option.

## 3. Options considered

| Technique | Fits |
| --- | --- |
| Read-modify-write in C# (`product.Stock -= n; SaveChanges()`) | nothing concurrent — lost updates |
| `SERIALIZABLE` transactions + retry on 40001 | correct but needs retry loops everywhere; more aborts under load |
| Pessimistic `SELECT ... FOR UPDATE` | correct; extra round trip; easy to deadlock without lock ordering |
| **Conditional atomic UPDATE** (`SET stock = stock - n WHERE stock >= n`) | counters with an invariant |
| **Optimistic concurrency token** (`WHERE version = @v`) | user-edited documents |
| **Unique index** + catch violation | "at most once" facts (idempotency key, one review per user) |
| DB `CHECK` constraints | last line of defence for invariants |

## 4. Chosen approach (per scenario)

| Scenario | Mechanism | Code |
| --- | --- | --- |
| No overselling | conditional `ExecuteUpdate` per line, inside one transaction, lines sorted by product id | `CheckoutService.CreateOrderInTransactionAsync` |
| All-or-nothing checkout | one `BeginTransactionAsync`; any exception → rollback via `await using` | same |
| Duplicate checkout | `Idempotency-Key` header + unique index `(user_id, idempotency_key)` + request fingerprint | `CheckoutService.TryReplayAsync`, `Fingerprint` |
| Admin edits vs checkouts | explicit `Product.Version` token, incremented **only** by `UpdateDetails` | `Product.cs`, `AdminCatalogService.UpdateProductAsync` |
| Inventory adjustments | relative `SET stock = stock + delta WHERE stock + delta >= 0` | `AdminCatalogService.AdjustStockAsync` |
| Concurrent status changes / double cancellation | `xmin` row version on orders | `Order.Version` (`IsRowVersion`), `OrderStatusService` |
| Concurrent reviews | unique `(product_id, user_id)` + atomic relative rating update from an exact `RatingTotal` | `ReviewService.CreateAsync` |
| Invariants | `CHECK (stock_quantity >= 0)`, `CHECK (price > 0)`, `CHECK (total = subtotal + shipping_cost)`, rating 1..5 | `EntityConfigurations.cs` |

## 5. Why

### No overselling without explicit locks

```csharp
// CheckoutService.cs — lines are sorted by product id, so concurrent checkouts lock rows in the same order
foreach (var line in lines)
{
    var updated = await db.Products
        .Where(p => p.Id == line.ProductId && p.IsActive && p.StockQuantity >= line.Quantity)
        .ExecuteUpdateAsync(s => s.SetProperty(p => p.StockQuantity, p => p.StockQuantity - line.Quantity)
                                  .SetProperty(p => p.UpdatedAt, now), cancellationToken);
    if (updated == 0) shortages.Add(line.ProductId);
}
```

Under `READ COMMITTED`, an `UPDATE` takes a row lock; a concurrent `UPDATE` on the same row waits, then
**re-evaluates the `WHERE` clause against the committed new row version**. So the second buyer sees the reduced stock
and matches zero rows. One statement does check-and-decrement atomically: no `SELECT FOR UPDATE`, no serializable
retries. Sorting lines by product id gives every transaction the same lock order → no deadlocks between two
multi-item carts.

### Idempotent checkout

```csharp
var replay = await TryReplayAsync(userId, idempotencyKey, fingerprint, cancellationToken);   // same key → same order
...
catch (DbUpdateException ex) when (ex.IsUniqueViolation("ix_orders_user_id_idempotency_key"))
{
    await transaction.RollbackAsync(cancellationToken);  // lost the race to a concurrent duplicate
    db.ChangeTracker.Clear();
    return null;                                         // caller replays the winner's order
}
```

The unique index is the arbiter, so it also works across API instances. The SHA-256 fingerprint of the canonical
request rejects reuse of a key for a *different* request (`422 idempotency_key_reused`). The Angular checkout keeps
one key per *attempt* and reuses it only for an identical payload (`checkout-page.ts`).

### Why `Version` and not `xmin` for products

`xmin` changes on **every** row update. Stock and ratings change through atomic updates on every checkout and review,
so with `xmin` an admin who opened the edit form and saved a minute later got a false `409` whenever anyone bought
the product. That was the original implementation and a test asserted it; it was treated as a design bug and fixed:

```csharp
// Product.cs
public int Version { get; private set; }               // IsConcurrencyToken() in EntityConfigurations.cs
public void UpdateDetails(/* ... */) { /* validate + assign */ Version++; }

// AdminCatalogService.UpdateProductAsync — EF adds "WHERE version = @original" to the UPDATE
db.Entry(product).Property(p => p.Version).OriginalValue = request.Version;
```

Two admins editing details still conflict correctly (`409 concurrency_conflict`, the UI offers "Reload latest
version"); checkouts never do. Orders keep `xmin` because every change to an order *is* a state transition that must
not be overwritten.

### Lost-update-free ratings

```csharp
// ReviewService.cs — all SET expressions read the pre-update row
.ExecuteUpdateAsync(s => s
    .SetProperty(p => p.RatingTotal, p => p.RatingTotal + rating)
    .SetProperty(p => p.ReviewCount, p => p.ReviewCount + 1)
    .SetProperty(p => p.AverageRating, p => Math.Round((decimal)(p.RatingTotal + rating) / (p.ReviewCount + 1), 2)));
```

Keeping the exact integer `RatingTotal` means the average is always recomputed from exact data, so rounding never
accumulates (unit test: `The_average_is_derived_from_the_exact_total_so_rounding_never_accumulates`).

## 6. Trade-offs

- Conditional updates issue one statement per cart line (≤ 50 lines, `Pricing.MaxLinesPerOrder`). A single
  `UPDATE ... FROM (VALUES ...)` would be one round trip but cannot be expressed with `ExecuteUpdate`.
- Idempotency records live forever in `orders`; a real system would expire keys (e.g. 24 h).
- Payment is called inside the DB transaction (simulator only — KI-10).

## 7. Simpler alternatives

A single global lock (or one API instance with a `SemaphoreSlim`) would be "correct" on one machine and wrong as soon
as a second instance exists. `SERIALIZABLE` everywhere is simpler to reason about but requires generic retry logic.

## 8. Rejected alternatives

- **Read-modify-write with a concurrency token on stock** — correct but turns every contended purchase into a 409 +
  client retry; the conditional update simply succeeds or reports a real shortage.
- **Reserving stock in the cart** — holds inventory for abandoned carts; needs expiry jobs. The cart quote only
  *reports* availability (`Quote_reports_stock_issues_without_reserving_anything`).

## 9. Implementation references

`services/api/src/Shop.Api/Features/Orders/CheckoutService.cs`, `OrderStatusService.cs`,
`Features/Admin/AdminCatalogService.cs`, `Features/Catalog/ReviewService.cs`, `Domain/Product.cs`, `Domain/Order.cs`,
`Infrastructure/Persistence/EntityConfigurations.cs`, `PostgresErrors.cs`,
`Infrastructure/ErrorHandling/AppExceptionHandler.cs` (maps `DbUpdateConcurrencyException` → 409).

## 10. Failure scenarios

| Failure | Outcome |
| --- | --- |
| Shortage on any line | rollback; `409 insufficient_stock` with available quantities; UI refreshes the quote |
| Payment declined (`tok_declined`) | exception before commit → stock reservation rolled back; `402` |
| Provider outage (`tok_unavailable`) | rollback; `503`; client may retry **with the same key** |
| Crash after commit, before the response | client retries with the same key → replay of the committed order |
| Crash after a real capture but before commit | money taken, no order — KI-10; needs authorize/capture + outbox (21) |

## 11. Testing implications

Concurrency is only provable against the real database: integration tests run parallel requests with `Task.WhenAll`
against PostgreSQL (`Concurrent_buyers_cannot_oversell_the_last_units`, `Concurrent_duplicate_requests_create_a_single_order`,
`Stale_version_update_is_rejected_with_conflict`, `A_checkout_does_not_cause_a_false_conflict_for_an_admin_editing_details`).
An in-memory provider would not have row locks, constraints or `xmin` — which is why it is not used.

## 12. Performance and security

- Row locks are held only for the duration of the checkout transaction (no user think-time inside it).
- Hot products serialize on their row; for flash-sale scale a queue or sharded counters would be needed.
- Server-side prices: the client sends only product ids and quantities; `Client_supplied_prices_are_ignored`.

## 13. When a different approach is better

High-contention flash sales → queue-based order intake or pre-allocated stock buckets. Cross-service inventory (if
catalog/orders were separate services) → reservations with a saga and compensations.

## 14. Interview explanation

"Overselling is prevented by a conditional update: `UPDATE products SET stock = stock - n WHERE id = @id AND stock >= n`.
In PostgreSQL the second concurrent transaction waits for the row lock and re-checks the WHERE clause on the new
version, so it matches zero rows and we report a shortage. Everything for an order runs in one transaction, so a
declined payment rolls the stock back. Duplicates are handled with an idempotency key backed by a unique index, and
for admin edits I use an explicit version column rather than xmin, because xmin would make every checkout look like
a conflicting edit."

## 15. Evidence and confidence

*Verified:* migration SQL contains the CHECK constraints and unique indexes; unit tests for rating maths and version
increments pass; solution builds; every concurrency integration test listed above passes against real PostgreSQL
(`Concurrent_buyers_cannot_oversell_the_last_units`, `Concurrent_duplicate_requests_create_a_single_order`,
`A_checkout_does_not_cause_a_false_conflict_for_an_admin_editing_details`, … — 40/40). Confidence: high.
