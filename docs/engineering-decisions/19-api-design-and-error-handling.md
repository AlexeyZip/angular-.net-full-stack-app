# 19 — API design and error handling

## 1. Problem

Give the SPA (and any future client) a predictable HTTP API: resource-oriented routes, validated input, and errors a
program can branch on without parsing English messages.

## 2. Context

ASP.NET Core 10 controllers, `System.Text.Json` with string enums, OpenAPI document + Scalar UI in Development.

## 3. Options considered

Minimal APIs vs controllers; ad-hoc error JSON vs RFC 9457 ProblemDetails; exceptions vs result types for business
failures.

## 4. Chosen approach

- **Controllers** grouped by feature (`Features/*/…Controller.cs`), thin; services hold the use case.
- **ProblemDetails everywhere**, extended with a stable `code` and a `traceId`:
  validation → 400 `validation_failed` with `errors`; `AppException` → its status + `code`; concurrency → 409
  `concurrency_conflict`; unexpected → 500 without internals.
- **Business failures are exceptions of one type (`AppException`)** with factory methods mapping to status codes:

| Factory | Status | Example codes |
| --- | --- | --- |
| `AppException.NotFound` | 404 | `not_found` |
| `AppException.Conflict` | 409 | `insufficient_stock`, `email_taken`, `review_exists`, `slug_taken`, `category_not_empty` |
| `AppException.BusinessRule` | 422 | `stock_would_be_negative`, `invalid_status_transition`, `idempotency_key_reused`, `review_requires_purchase`, `product_unavailable` |
| `AppException.Unauthorized` | 401 | `invalid_credentials`, `refresh_token_invalid`, `refresh_token_missing` |
| direct `new AppException(...)` | 400 / 402 / 503 | `csrf_header_missing`, `payment_declined`, `payment_unavailable` |

- **Routes:** `GET /api/products?search=&category=&brand=&minPrice=&maxPrice=&inStock=&sort=&page=&pageSize=`,
  `GET /api/products/{slug}`, `POST /api/cart/quote`, `POST /api/orders` (requires `Idempotency-Key`),
  `POST /api/orders/{id}/cancel`, `/api/wishlist/{productId}` (PUT/DELETE, idempotent), `/api/admin/*`.
- **Paging contract:** `PagedResult<T> { items, page, pageSize, totalCount, totalPages }`; page size validated
  (`[Range(1, 48)]` for the catalog, 50 for orders/reviews, 100 for admin lists).

## 5. Why

The UI maps codes to behaviour (`checkout-page.ts`: `insufficient_stock` → refresh quote; `register-page.ts`:
`email_taken` → field error). Messages can change or be localized without breaking clients. One exception type keeps
services readable (no `Result<T>` plumbing) while the global handler guarantees a uniform shape.

## 6. Trade-offs

Exceptions for expected failures cost a stack trace (negligible here) and hide failure paths from method signatures;
codes must be documented and kept stable.

## 7–8. Simpler / rejected alternatives

Returning `BadRequest("text")` from controllers (inconsistent, unparseable) — rejected. A `Result<T, Error>` library —
viable, rejected to keep idiomatic ASP.NET Core and avoid a dependency. Minimal APIs — equally valid; controllers
chosen for familiar attribute-based authorization and grouping for learners coming from NestJS.

## 9. Implementation references

`Domain/AppException.cs`, `Infrastructure/ErrorHandling/AppExceptionHandler.cs`, `Program.cs`
(`AddProblemDetails` customization adds `traceId` and `validation_failed`), `Features/Shared/PagedResult.cs`,
`libs/shared/data-access/src/lib/api-error.ts` (`toApiError` normalizes `HttpErrorResponse` → `ApiError {status, code, message, details}`).

## 10. Code

```csharp
// Program.cs
builder.Services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
{
    context.ProblemDetails.Extensions.TryAdd("traceId", Activity.Current?.Id ?? context.HttpContext.TraceIdentifier);
    if (context.ProblemDetails is HttpValidationProblemDetails)
        context.ProblemDetails.Extensions.TryAdd("code", "validation_failed");
});
```

```ts
// checkout-page.ts — branch on code, never on message
if (error.code === 'insufficient_stock' || error.code === 'product_unavailable') this.cart.refreshQuote();
```

## 11. Failure scenarios

Client aborts → 499 `client_closed_request`, not logged as an error. Unknown exception → 500 ProblemDetails with `traceId`, full
exception only in logs.

## 12. Testing

Integration tests assert status **and** `code` (`Invalid_query_returns_validation_problem`,
`Unknown_product_returns_not_found_problem`, checkout/auth/admin suites); `api-error.spec.ts` for the client mapping.

## 13. Performance and security

No stack traces or SQL in responses; login errors are generic; enumerations serialized as strings (stable contract).

## 14. When different

Public multi-consumer APIs → versioning (`/v1`), generated clients from OpenAPI, and possibly `Result` types for
explicit failure contracts.

## 15. Interview explanation

"All errors are RFC 9457 ProblemDetails with a machine-readable `code` and a `traceId`. Services throw one
`AppException` type whose factory decides the status — 409 for conflicts, 422 for rule violations — and a global
`IExceptionHandler` formats them. The Angular side normalizes every HTTP error into an `ApiError` and branches on
`code`."

## 16. Evidence

Build + unit tests verified; HTTP-level behaviour (status codes, ProblemDetails `code`) verified by integration
tests (40/40).
