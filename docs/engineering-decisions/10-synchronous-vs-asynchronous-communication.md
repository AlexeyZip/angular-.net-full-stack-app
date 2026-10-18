# 10 — Synchronous vs asynchronous communication

## 1. Problem
Decide which interactions are request/response and which should be events or messages (now and later).

## 2. Context
One API, one database, no message broker; payment is a synchronous simulator.

## 3. Options
Synchronous HTTP everywhere; in-process events; transactional outbox + broker; real-time push (SignalR/SSE).

## 4. Chosen approach (implemented)
Everything is synchronous HTTP between SPA and API; inside the API, a checkout is one synchronous transaction
including the simulated payment. Client-side asynchrony is RxJS (debounced quotes, cancellation, optimistic wishlist).

## 5. Why
The user needs an immediate, definitive answer at checkout ("paid" or "declined"). There are no downstream consumers
yet (no email, search index or warehouse) — asynchronous messaging would have no reader.

## 6. Trade-offs
Coupling to the payment call's latency and availability (a 503 aborts the checkout and the client may retry with the
same idempotency key). No fan-out for future side effects.

## 7. Simpler alternative
This *is* the simple alternative.

## 8. Rejected (for now)
A broker (RabbitMQ / Azure Service Bus) — infrastructure without consumers. Fire-and-forget `Task.Run` after the
response — loses work on crash.

## 9. References
`OrdersController.cs`, `CheckoutService.cs`, `PaymentSimulator.cs`; client: `signals-cart.store.ts`, `cart.effects.ts`.

## 10. Design for the asynchronous next step (A-02, not implemented)
```text
CheckoutService transaction:  INSERT orders ...;  INSERT outbox_messages(type='OrderPlaced', payload, created_at)
                              COMMIT  (both or neither)
OutboxPublisher (BackgroundService): SELECT ... FOR UPDATE SKIP LOCKED LIMIT 50 → publish → mark sent (retry with backoff)
Consumers: email, search index, SignalR notifier — idempotent by message id
```

## 11. Failure scenarios
Today: payment provider down → 503, nothing persisted. With an outbox: publish failures are retried; consumers must
tolerate duplicates (at-least-once).

## 12. Testing
Today: integration tests for 402/503 rollbacks. Outbox: an integration test that kills the publisher between commit
and publish and asserts eventual delivery.

## 13. Performance / security
Sync calls hold DB locks during the payment call (fast simulator; with a real provider use authorize-then-capture
outside the lock — 21).

## 14. When asynchronous is better
Long-running or unreliable work (emails, fulfilment, search indexing), fan-out to several consumers, cross-service
consistency (sagas), and real-time UI updates (SignalR for order status, A-03).

## 15. Interview explanation
"Checkout is synchronous because the customer needs a definitive answer and there are no consumers yet. The next step
is a transactional outbox so that events like OrderPlaced are written in the same transaction and published reliably."

## 16. Evidence
Synchronous paths implemented; asynchronous parts are design only.
