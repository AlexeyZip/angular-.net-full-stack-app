# ADR-0001: Modular monolith for the backend

- **Status:** accepted
- **Date:** 2026-10-18
- **Implementation evidence:** `services/api/src/Shop.Api/Features/*` (Catalog, Auth, Wishlist, Orders, Reviews,
  Admin), shared `Domain/` and `Infrastructure/`; `dotnet build` passes with 0 warnings.

## Context
One developer, one deployable, a single relational database, strong consistency needed between orders and inventory.

## Problem
How to structure the backend so features stay separable without paying the cost of distributed systems.

## Decision
A single ASP.NET Core application organised by **feature folders** (controller + service + DTOs per feature) over a
shared domain model and one `ShopDbContext`. Cross-feature calls go through services, not other features' controllers.
Checkout updates orders and stock in **one local transaction**.

## Alternatives considered
- Microservices (catalog/orders/inventory) — would turn the checkout transaction into a saga, add brokers, tracing,
  contract versioning; no team or scaling need justifies it.
- Layered "Controllers/Services/Repositories" solution split into many projects — more ceremony, weaker feature
  cohesion.

## Consequences
Simple deployment and debugging; atomic checkout; one migration history. Module boundaries are a convention, not a
compiler-enforced rule.

## Trade-offs
All features scale together; one shared schema.

## Security and operational implications
One process to secure and monitor; a bug can affect every feature.

## Revisit when
Independent teams need independent release cadences, or a module (e.g. catalog search) needs to scale or use a
different store. First step would be enforcing boundaries (separate projects per module), not extracting services.

See also: [`02-modular-monolith-vs-microservices.md`](../engineering-decisions/02-modular-monolith-vs-microservices.md).
