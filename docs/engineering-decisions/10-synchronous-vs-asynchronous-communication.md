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
The user needs an immediate, definitive answer at checkout ("paid" or "declined"). The one downstream consumer — the
notifications service — must not be able to slow down or fail a checkout, so it is fed asynchronously through the
outbox (§10).

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

## 10. Asynchronous part (A-02, implemented 2026-10-18)
```text
CheckoutService / OrderStatusService:  order changes + INSERT outbox_messages(type='order.placed.v1', payload, traceparent)
                                       one SaveChanges → COMMIT (both or neither)
OutboxPublisher (BackgroundService):   claim: SELECT … FOR UPDATE SKIP LOCKED LIMIT 20 + lease, COMMIT
                                       deliver outside the transaction → POST notifications /internal/events
                                       processed | backoff 5 s·2^(n−1) ≤ 15 min | dead-letter (8 attempts or permanent 4xx)
services/notifications:                inbox (PK message_id) + notification in one transaction → idempotent
```
The customer-facing checkout is still synchronous (the answer must be definitive); only the side effect is
asynchronous. Full guide: `docs/guides/outbox-and-notifications-service.md`; record: ADR-0012.

The assistant is a third style: synchronous request/response to a slow dependency (a local model), protected with
timeouts, a circuit breaker and a degraded answer instead of a queue — the user is waiting for the answer, so queueing
it would not help (decision 12).

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
"Checkout is synchronous because the customer needs a definitive answer. Side effects such as the confirmation e-mail
go through a transactional outbox: the event is written in the same transaction as the order and delivered later,
at least once, to an idempotent consumer."

## 16. Evidence
Synchronous paths implemented. Outbox + notifications implemented and verified on 2026-10-18 (integration tests
`OutboxTests`, notifications tests 14/14, manual outage-and-recovery run with compose). Broker, SignalR (A-03): design.
