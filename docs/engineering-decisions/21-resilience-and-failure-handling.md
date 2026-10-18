# 21 — Resilience and failure handling

**Status: PARTIALLY_IMPLEMENTED.**

## 1. Problem
Networks drop, users double-click, providers time out, databases restart. The system must fail safely: never charge
twice, never lose an order that was confirmed, never leave inconsistent stock.

## 2. Context
Synchronous checkout with a payment simulator; one API instance; browser clients on unreliable networks.

## 3. Options
Client retries with idempotency; server-side retries (Polly / `Microsoft.Extensions.Http.Resilience`); EF Core
execution strategy (retry on transient DB errors); circuit breakers; outbox; authorize/capture separation.

## 4. Implemented
| Failure | Handling | Code |
| --- | --- | --- |
| Duplicate/retried checkout | idempotency key + fingerprint + unique index; replay returns the original order | `CheckoutService.cs`, `checkout-page.ts` (key per attempt) |
| Payment declined / provider outage | exception before commit → full rollback; `402`/`503`; UI keeps the cart and explains | `PaymentSimulator.cs`, `checkout-page.ts` |
| Stock changed after quote | `409 insufficient_stock` with available quantities; UI refreshes the quote and blocks checkout | `CheckoutService.cs`, `checkout-page.ts` |
| Concurrent edits | `409 concurrency_conflict` + "Reload latest version" | `product-edit-page.ts` |
| Expired access token | single shared refresh, then retry once | `auth.interceptor.ts`, `auth-session.ts` |
| Stale async responses | `switchMap` cancellation | state stores (04) |
| Optimistic UI failure | per-item rollback + error | wishlist stores |
| Storage unavailable | cart works in memory | `cart-persistence.ts` |
| Client disconnect | `CancellationToken` everywhere; 499 not logged as error | `AppExceptionHandler.cs` |
| DB down | readiness probe fails; error states with retry in the UI | `Program.cs`, `libs/shared/ui/src/lib/states.ts` |
| Notifications service down / slow | checkout unaffected; outbox retries with backoff, dead-letters after 8 attempts or a permanent 4xx; consumer idempotent | `Infrastructure/Messaging/*`, `services/notifications` (ADR-0012) |
| Crash between commit and delivery | event is in the same transaction as the order; claim lease expires and another tick delivers it | `OutboxProcessor.cs` |
| Model server down / slow | attempt + total timeout, one retry for fast failures only, circuit breaker, `Degraded` answer with search results | `Features/Assistant/AssistantRegistration.cs`, `AssistantService.cs` |
| Microfrontend unavailable | loader rejects after error/timeout; panel shows "unavailable" with retry; shop unaffected | `remote-element-loader.ts`, `assistant-panel.ts` |

## 5. Why
Idempotency makes *client* retries safe, which is the retry that matters most on the web.

## 6. Trade-offs / gaps
- **Payment inside the DB transaction (KI-10):** with a real provider, a crash after capture and before commit charges
  without an order. Fix: create order `PendingPayment` → commit → authorize/capture with provider idempotency key →
  update status; reconcile via webhooks; outbox for follow-up work.
- No EF Core retrying execution strategy: transient DB errors surface as 500. Adding `EnableRetryOnFailure()` requires
  wrapping explicit transactions in `db.Database.CreateExecutionStrategy().ExecuteAsync(...)` — planned with care
  because checkout must stay idempotent (it is, thanks to the key).
- No circuit breaker around the (simulated) payment provider. Circuit breakers and resilience handlers exist for
  the two real HTTP dependencies: the notifications service (outbox client) and the assistant's model server.

## 7. Simpler alternative
Disable the button while submitting (done too) — but that alone does not protect against network-level retries.

## 8. Rejected
Server-side automatic retries of payment calls without provider idempotency (risk of double charge).

## 9. References
See table.

## 10. Code
```ts
// checkout-page.ts — one idempotency key per attempt; identical payload ⇒ same key
const payload = JSON.stringify(request);
if (this.attempt?.payload !== payload) {
  this.attempt = { payload, key: createIdempotencyKey() };
}
```

## 11. Failure matrix for checkout
See `08-database-transactions-and-concurrency.md` §10.

## 12. Testing
`Retrying_with_the_same_key_returns_the_original_order_once`, `Concurrent_duplicate_requests_create_a_single_order`,
`Declined_payment_rolls_back_the_stock_reservation`; E2E declined-payment and sold-out paths — all passing.

## 13. Performance
Retries add latency only on failure; idempotency check is one indexed lookup.

## 14. When to go further
Real provider and async fulfilment → outbox, sagas, circuit breakers (`Microsoft.Extensions.Http.Resilience`),
dead-letter handling.

## 15. Interview explanation
"Checkout is idempotent, so the client can retry safely; failures before commit roll everything back; the UI maps each
failure code to a recovery action. The known gap is payment capture inside the transaction — with a real provider I'd
split authorize and capture around the commit and use an outbox."

## 16. Evidence
Client-side behaviours verified by unit tests; server-side paths by integration tests; user-visible recovery
paths by E2E. Added on 2026-10-18: outbox retry/dead-letter/`SKIP LOCKED` integration tests and a manual outage run
(notifications stopped → checkout 201 → delivered on attempt 4 after restart); assistant degraded mode (integration
test with a failing model); remote-down E2E.
