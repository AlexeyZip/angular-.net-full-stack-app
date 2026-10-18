# ADR-0010: Move payment capture outside the order transaction

- **Status:** proposed
- **Date:** 2026-10-18
- **Implementation evidence:** none — current code calls the payment simulator inside the checkout transaction
  (`CheckoutService.cs`, KI-10).

## Context
With the simulator, calling "payment" inside the database transaction is harmless and keeps rollback trivial. With a
real provider, a crash or commit failure after a successful capture would charge the customer without an order; the
transaction would also stay open during a slow network call.

## Problem
Make checkout safe with an external, non-transactional payment provider.

## Decision (proposed)
1. Transaction 1: reserve stock (same conditional update) and create the order as `PendingPayment`; commit.
2. Call the provider **outside** the transaction with the order's idempotency key (authorize, then capture).
3. Transaction 2: mark the order `Paid`, or `PaymentFailed` and release stock.
4. A background reconciler (or provider webhooks) completes orders stuck in `PendingPayment` and releases expired
   reservations. Follow-up work (emails) goes through a transactional **outbox**.

## Alternatives considered
- Keep it inside the transaction — unsafe with a real provider.
- Distributed transaction (2PC) — not supported by payment providers.

## Consequences
New order states, a background service, and reconciliation logic plus tests.

## Trade-offs
More moving parts; "eventually paid" states visible to customers.

## Security and operational implications
Provider idempotency prevents double charges on retries; reconciliation needs monitoring and alerts.

## Revisit when
Before integrating any real payment provider (prerequisite).
