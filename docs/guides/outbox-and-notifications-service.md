# Transactional outbox and the notifications microservice (developer guide)

How an order event leaves `Shop.Api`, reaches the separately deployed `services/notifications` and becomes a
(simulated) e-mail — reliably, without a message broker. Short record: [ADR 0012](../adr/0012-outbox-and-notifications-service.md);
background: decisions [02](../engineering-decisions/02-modular-monolith-vs-microservices.md),
[10](../engineering-decisions/10-synchronous-vs-asynchronous-communication.md),
[21](../engineering-decisions/21-resilience-and-failure-handling.md).

## 1. The problem it solves

After checkout the customer should get a confirmation e-mail. Calling an e-mail service inside the checkout request
has two bad options:
- call it **before** `COMMIT`: the e-mail may go out for an order that is then rolled back;
- call it **after** `COMMIT`: a crash or network error between the two loses the e-mail forever, and a slow e-mail
  service makes checkout slow.

The **transactional outbox** writes the event into the same database transaction as the order. Either both exist or
neither. A background worker delivers events later and retries until the consumer confirms.

## 2. Flow

```text
Shop.Api                                                            services/notifications (own DB shop_notifications)
CheckoutService / OrderStatusService                                POST /internal/events  (X-Service-Key)
  ├ order changes                                                     ├ ServiceKeyAuthenticationHandler (SHA-256 + FixedTimeEquals)
  ├ Outbox.Enqueue(OrderPlacedV1)  ── same SaveChanges/COMMIT ──┐     ├ EventIngestor
  └ COMMIT                                                      │     │   inbox row (PK message_id) + notification row
outbox_messages ◀───────────────────────────────────────────────┘     │   in ONE SaveChanges; duplicate → "duplicate"
OutboxPublisher (BackgroundService, every 2 s, drains full batches)   └ 200 {status} | 400 problem {code}
  └ OutboxProcessor.ProcessBatchAsync
      1 claim: short tx, SELECT … FOR UPDATE SKIP LOCKED LIMIT 20,
               next_attempt_at = now + 5 min (lease), COMMIT
      2 deliver each: NotificationsClient POST + traceparent ─────────▶
      3 record outcome per message: processed | retry with backoff | dead-letter
```

## 3. Producer side (`services/api/src/Shop.Api/Infrastructure/Messaging/`)

| File | Responsibility |
| --- | --- |
| `IntegrationEvents.cs` | versioned event records (`order.placed.v1`, `order.status_changed.v1`) and the envelope |
| `OutboxMessage.cs` | entity + state rules: `Claim`, `MarkProcessed`, `RecordTransientFailure`, `RecordPermanentFailure`, `OutboxBackoff` |
| `Outbox.cs` | `Enqueue(type, payload)` adds a row to the *current* `DbContext` — the caller's `SaveChanges` commits it |
| `OutboxProcessor.cs` | claim → deliver → record, per batch |
| `OutboxPublisher.cs` | `BackgroundService` with `PeriodicTimer`; new DI scope (DbContext) per batch |
| `NotificationsClient.cs` | typed `HttpClient`, options, `IsPermanent(status)` classification |
| `MessagingRegistration.cs` | `AddShopMessaging`: options validation, resilience handler, hosted service only when configured |

Key decisions:
- **Claim with a lease instead of holding a lock during HTTP.** The claim transaction is milliseconds long; delivery
  happens outside any transaction. `FOR UPDATE SKIP LOCKED` lets several API instances work in parallel without
  picking the same rows. If the process dies after claiming, the lease (`ClaimDuration`, 5 min) expires and another
  instance retries — at-least-once, never lost.
- **Backoff** `5 s × 2^(attempt−1)`, capped at 15 min; after `MaxAttempts` (8) the row is **dead-lettered**
  (`dead_lettered_at`), logged as an error and no longer polled.
- **Permanent vs transient**: 4xx means "this message will never be accepted" → dead-letter at once; except 401
  (key rotation), 408 and 429, which are retried like 5xx and network errors.
- **Partial index** `ix_outbox_messages_pending` on `next_attempt_at WHERE processed_at IS NULL AND dead_lettered_at
  IS NULL`: the poll query stays fast however many processed rows accumulate.
- **Tracing**: each message stores the W3C `traceparent` of the request that created it; delivery sends it, so the
  checkout and the notification share one trace id across both services' logs.
- **No broker** (RabbitMQ, Azure Service Bus): one consumer, one producer — HTTP push from the outbox is enough and
  needs no extra infrastructure. The outbox pattern is the same with a broker: the worker would publish to the broker
  instead of POSTing.
- **The event carries the e-mail and name** (`OrderPlacedV1.CustomerEmail`), so the consumer never calls back into
  the shop (no runtime coupling). The cost: personal data travels in the payload; logs on both sides avoid it.

## 4. Consumer side (`services/notifications/`)

- Separate solution (`Notifications.sln`), own `global.json`, Dockerfile, migrations and database
  `shop_notifications` — nothing is shared with `Shop.Api` except the JSON contract.
- **Idempotency through an inbox table**: `inbox_messages.message_id` is the primary key. The check
  (`AnyAsync`) handles the common duplicate; the unique constraint handles the race of two concurrent deliveries
  (`UniqueViolation` → "duplicate"). Inbox row and notification are written in one `SaveChanges`.
- **Duplicates return 200**: the producer only needs to know it may stop retrying.
- **Strict deserialization** (`RespectRequiredConstructorParameters`, `RespectNullableAnnotations`): a payload missing
  required fields is a `400 invalid_payload`, which the producer dead-letters instead of retrying forever.
- **Service-to-service auth**: `X-Service-Key` header; the handler compares SHA-256 hashes with
  `CryptographicOperations.FixedTimeEquals` (no timing leak, no length leak). Key at least 16 characters, validated
  on start. Local value `DEV-ONLY-notifications-service-key`; real deployments use a secret store or, better,
  workload identity / mTLS.
- **Simulated e-mails** are stored, not sent. `GET /internal/notifications?reference=SO-…` lets developers and tests
  see them; lookup is by order number, never by e-mail, because query strings end up in access logs.

## 5. Contract tests without a broker or Pact

`services/contracts/events/*.json` hold one sample envelope per event type.
- Producer test (`Shop.Api.UnitTests/EventContractTests.cs`): the payload serialized by `Shop.Api` has exactly the
  sample's shape (property names and JSON kinds).
- Consumer test (`Shop.Notifications.Tests/EventsApiTests.cs`): the service accepts and correctly handles the sample.
If either side changes the shape, one of the two tests fails. Rules for evolving events: `services/contracts/README.md`
(additive changes only within a version; a breaking change becomes `.v2`, published alongside `.v1`).

## 6. Recipe: adding a new integration event

1. Add a record + type constant in `IntegrationEvents.cs` (`something.happened.v1`).
2. Call `outbox.Enqueue(...)` in the service method **before** its `SaveChanges`.
3. Add a sample to `services/contracts/events/` and a case to `EventContractTests`.
4. In the consumer: its own copy of the record (`Events/EventContracts.cs`), a `case` in `EventIngestor`, a test
   with the sample.
5. Integration test in `Shop.Api.IntegrationTests/OutboxTests.cs`: the business action writes exactly one row, a
   failed action writes none.

## 7. Configuration

| Setting | Default | Meaning |
| --- | --- | --- |
| `Notifications:BaseUrl` | null | not set → events are still written, nothing is published (KI-18) |
| `Notifications:ServiceKey` | "" | shared key; compose: `NOTIFICATIONS_SERVICE_KEY` |
| `Outbox:PublisherEnabled` | true | run the hosted publisher in this instance |
| `Outbox:PollInterval` | 2 s | idle polling interval |
| `Outbox:BatchSize` | 20 (1–500) | rows per claim |
| `Outbox:MaxAttempts` | 8 (1–50) | then dead-letter |
| `Outbox:ClaimDuration` | 5 min | lease; must exceed the worst-case delivery time of a batch |

## 8. Operating it

```sql
-- pending / failing messages
SELECT id, type, attempts, next_attempt_at, last_error FROM outbox_messages
WHERE processed_at IS NULL AND dead_lettered_at IS NULL ORDER BY next_attempt_at;
-- dead letters (fix the cause, then re-queue):
UPDATE outbox_messages SET dead_lettered_at = NULL, attempts = 0, next_attempt_at = now() WHERE id = '<id>';
```
Run the re-queue statement only deliberately and for specific ids. Processed rows are not cleaned up yet (KI-18).

## 9. Tests and evidence

- Unit: backoff, transient/permanent/dead-letter rules, error truncation, `IsPermanent` theory, contract shape.
- Integration (real PostgreSQL): checkout writes the event, declined payment writes none, status change writes one,
  delivery with key and trace, 503 schedules a retry, 400 dead-letters, locked rows are skipped (`SKIP LOCKED`, using
  a second connection holding `FOR UPDATE`).
- Notifications tests (14): auth, idempotency, concurrent duplicates, invalid envelopes/payloads, samples.
- Manually with compose (2026-10-18): order → notification; the same trace id in both services' logs; with the
  notifications container stopped checkout still succeeded (201), the outbox retried, and after restart the message
  was delivered on attempt 4.
