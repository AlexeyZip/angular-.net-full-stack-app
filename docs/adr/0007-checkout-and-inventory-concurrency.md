# ADR-0007: Checkout and inventory concurrency

- **Status:** accepted
- **Date:** 2026-10-18
- **Implementation evidence:** `Features/Orders/CheckoutService.cs`, `Domain/Product.cs` (`Version`),
  `Domain/Order.cs` (`xmin`), unique index on the idempotency key; integration tests
  `Concurrent_duplicate_requests_create_a_single_order`, `Retrying_with_the_same_key_returns_the_original_order_once`,
  `Declined_payment_rolls_back_the_stock_reservation` pass against PostgreSQL 17.

## Context
Many customers may buy the last units simultaneously; clients retry on network errors; admins edit products while
orders are placed.

## Problem
Prevent overselling, duplicate orders and lost admin updates.

## Decision
1. **Stock:** inside one transaction, for each line (sorted by product id to avoid deadlocks) run a conditional
   `UPDATE products SET stock_quantity = stock_quantity - @q, updated_at = @now WHERE id = @id AND is_active AND
   stock_quantity >= @q` (`ExecuteUpdateAsync`). Zero affected rows ⇒ rollback and `409 insufficient_stock` with the
   available quantities. Admin inventory changes are likewise **relative** (`stock + delta WHERE stock + delta >= 0`),
   so they compose with concurrent checkouts.
2. **Idempotency:** client sends `Idempotency-Key`; the order stores key + request fingerprint (unique index on
   `(user_id, idempotency_key)`). Same key + same payload ⇒ return the original order; same key + different payload ⇒
   `422 idempotency_key_reused`. Losing the insert race ⇒ replay the winner's order.
3. **Admin edits of product details:** optimistic concurrency with `Product.Version` (client sends the version it
   loaded; mismatch ⇒ `409 concurrency_conflict`). Stock and rating updates deliberately do **not** change `Version`,
   so checkouts never cause false conflicts for admins. Orders use PostgreSQL `xmin` as row version for status
   transitions.
4. Prices and totals always recomputed on the server.

## Alternatives considered
- `SELECT … FOR UPDATE` pessimistic locks — correct, but longer lock holding.
- Serializable isolation + retries — heavier, needs retry logic.
- Reservation table with TTL — needed for long payment flows, not for a synchronous simulator.
- `xmin` for products — rejected: every checkout changes the row, so admins would get a conflict whenever someone
  bought the product while they were editing its description.

## Consequences
No oversell under concurrency; safe client retries.

## Trade-offs
Payment simulator is called inside the transaction (KI-10, see ADR-0010).

## Security and operational implications
Client cannot influence price, totals or stock.

## Revisit when
Real payment provider or asynchronous fulfilment → ADR-0010.

See also: [`08-database-transactions-and-concurrency.md`](../engineering-decisions/08-database-transactions-and-concurrency.md).
