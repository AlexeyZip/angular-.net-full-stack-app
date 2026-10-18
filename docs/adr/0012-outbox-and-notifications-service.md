# ADR-0012: Transactional outbox and a separate notifications service

- **Status:** accepted
- **Date:** 2026-10-18
- **Implementation evidence:** `services/api/src/Shop.Api/Infrastructure/Messaging/*`, migration `AddOutbox`,
  `services/notifications` (own solution and database), `services/contracts/events`. Executed on 2026-10-18: API unit
  and integration tests including `OutboxTests` and `EventContractTests`, notifications tests 14/14,
  `has-pending-model-changes` clean for both projects, manual compose run (delivery, shared trace id, outage + recovery).

## Context
Order confirmations and status e-mails must not be lost and must not be sent for rolled-back orders. The master prompt
asks for an optional microservice example. The checkout must stay one ACID transaction (ADR-0001, ADR-0007).

## Problem
Deliver order events reliably to another service without distributed transactions and without slowing checkout.

## Decision
- Write integration events to `outbox_messages` in the **same `SaveChanges`** as the business change.
- A hosted `OutboxPublisher` claims due rows with `FOR UPDATE SKIP LOCKED` and a lease, delivers them **outside any
  transaction** by HTTP POST, retries with exponential backoff and dead-letters after `MaxAttempts` or on permanent
  4xx. Delivery is at-least-once.
- `services/notifications` is a minimal API with its **own database**; an inbox table keyed by message id makes it
  idempotent; it authenticates the producer with a shared service key (constant-time hash comparison).
- Event contracts are versioned by type name (`order.placed.v1`) and pinned by JSON samples that both sides test.

## Alternatives considered
- **Call the service inside/after the transaction** — sends for rolled-back orders or loses messages on crash.
- **Message broker (RabbitMQ / Azure Service Bus)** — the right step with several consumers; needs infrastructure the
  local setup does not have. The outbox stays; only the delivery target changes.
- **CDC (Debezium) from the WAL** — no polling, but heavy infrastructure.
- **Pact for contract testing** — broker/infrastructure for two services is not worth it; shared samples suffice.
- **Shared database between services** — would defeat the point of a separate service.

## Consequences
Checkout is unaffected by the notifications service's availability; duplicates are harmless; events carry the data
the consumer needs (including e-mail), so there are no callbacks.

## Trade-offs
Eventual consistency (seconds); polling load on the database (bounded by a partial index); processed rows accumulate
(KI-18); personal data in the event payload; a shared secret instead of workload identity.

## Security and operational implications
`/internal/*` requires the service key; logs on both sides avoid recipients and content; dead letters are logged as
errors and need monitoring; the local notifications database shares the PostgreSQL server and user (KI-19).

## Revisit when
A second consumer appears (introduce a broker), throughput makes polling expensive (CDC or broker), or the platform
offers workload identity/mTLS (replace the shared key).
