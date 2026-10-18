# 20 — Domain modelling and validation

## 1. Problem

Rules such as "price > 0 with two decimals", "stock never negative", "an order moves Paid → Shipped → Delivered or
Paid → Cancelled", "a rating is 1–5" must hold no matter which endpoint, job or seed script changes the data.

## 2. Context

EF Core entities double as the domain model (no separate persistence model). Validation exists at three layers:
Angular forms (UX), API request contracts (shape), domain + database (truth).

## 3. Options considered

Anemic entities + validation in services; **rich entities enforcing invariants**; separate domain and persistence
models; FluentValidation for requests.

## 4. Chosen approach

| Layer | Mechanism | Example |
| --- | --- | --- |
| UI (fast feedback) | typed reactive forms + validators | `passwordStrength`, price pattern, `matchingFields` |
| API contract (shape) | DataAnnotations on records, automatic 400 | `[property: Range(1, Pricing.MaxQuantityPerLine)] int Quantity` |
| Domain (rules) | constructors/methods with private setters throw `AppException` | `Product.UpdateDetails`, `Order.TransitionTo` |
| Database (last line) | CHECK, unique, FK constraints | `ck_products_stock_non_negative`, `ck_orders_total_consistent` |

The order state machine is data, not scattered `if`s:

```csharp
// Domain/Order.cs
private static readonly IReadOnlyDictionary<OrderStatus, OrderStatus[]> AllowedTransitions = new Dictionary<OrderStatus, OrderStatus[]>
{
    [OrderStatus.Paid] = [OrderStatus.Shipped, OrderStatus.Cancelled],
    [OrderStatus.Shipped] = [OrderStatus.Delivered],
    [OrderStatus.Delivered] = [],
    [OrderStatus.Cancelled] = [],
};
public void TransitionTo(OrderStatus next, DateTimeOffset now)
{
    if (!CanTransitionTo(next))
        throw AppException.BusinessRule("invalid_status_transition", $"Order cannot move from {Status} to {next}.", /* from/to */);
    Status = next; UpdatedAt = now;
}
```

The API exposes `allowedNextStatuses` from the same table, so the admin UI shows only legal buttons
(`order-page.ts`) — the server still re-validates.

Money: `decimal` everywhere in C#, `numeric(12,2)` in PostgreSQL, `Pricing.Calculate` is the single place totals are
computed (quote and checkout share it). The client estimate uses integer cents and is never sent to the server.

Value objects: `ShippingAddress` is a record mapped as an EF Core complex type (columns of `orders`); order items
snapshot `ProductName` and `UnitPrice` so later price edits never change historical orders.

## 5. Why

Invariants in the entity cannot be bypassed by a new endpoint; constraints in the database cannot be bypassed by a
raw SQL script or a bug in `ExecuteUpdate` (which skips entity methods — that is why stock has a CHECK constraint
and the conditional `WHERE stock_quantity >= n`).

## 6. Trade-offs

Rules exist in up to three places (UI, domain, DB) — they must stay aligned (the register form's password rule was
found out of sync with the API — 10 vs 8 characters — and fixed). EF Core-friendly entities need private
parameterless constructors and settable private properties.

## 7–8. Simpler / rejected

Validation only in services (anemic model) — easy to forget in a new code path. Separate persistence model — doubles
mapping code for little gain at this size. FluentValidation — DataAnnotations suffice for shape checks here.

## 9. Implementation references

`Domain/Product.cs`, `Order.cs`, `Review.cs`, `Pricing.cs`, `Slugs.cs`, `User.cs`, `AppException.cs`;
`Infrastructure/Persistence/EntityConfigurations.cs`; `Features/*/…Contracts.cs`;
`apps/web/src/app/features/account/validators.ts`, `features/admin/product-edit-page.ts` (price pattern).

## 10. Code — price rule in the domain

```csharp
// Domain/Product.cs (excerpt)
if (price <= 0) throw AppException.BusinessRule("invalid_price", "Price must be greater than zero.");
if (decimal.Round(price, 2) != price) throw AppException.BusinessRule("invalid_price", "Price cannot have more than two decimal places.");
```

## 11. Failure scenarios

A rule only in the UI → bypassable with curl. A rule only in the domain → bypassable by `ExecuteUpdate`/SQL. Both are
covered by the DB constraint for the critical invariants.

## 12. Testing

`DomainRuleTests.cs` (state machine, prices, stock, ratings, version), `PricingTests.cs`; integration tests verify the
HTTP mapping (422 with `code`); frontend `validators.spec.ts`.

## 13. Security

Server-side validation is the security boundary; the client never sends prices or totals.

## 14. When different

Complex domains with many aggregates and events → explicit aggregates, domain events, separate read models (DDD
tactical patterns in full).

## 15. Interview explanation

"Invariants live in the entities — private setters, guarded methods, a transition table for orders — and the critical
ones are duplicated as database constraints because bulk updates bypass entity code. Forms validate for UX only."

## 16. Evidence

Unit tests for domain rules: executed and passing. CHECK constraints: present in the generated migration SQL.
HTTP-level mapping: integration tests pass (40/40).

**Lesson from the first integration run:** the request records declared validation as `[property: Required]`. MVC
refuses that for records ("validation metadata must be associated with the constructor parameter") and throws on
**every** validated request → 500. It compiled cleanly and unit tests could not see it. Attributes now sit on the
constructor parameters (`public sealed record LoginRequest([Required, EmailAddress] string Email, ...)`).
