# Architecture Decision Records

Short, durable records of the most consequential decisions. The longer, teaching-oriented discussion of each topic
lives in [`docs/engineering-decisions/`](../engineering-decisions/README.md); an ADR states *what was decided and why*,
an engineering-decision document explains the trade-offs in depth.

**Status values:** `proposed` (not implemented), `accepted` (decided and implemented), `superseded`, `rejected`.
Each ADR also has an **Implementation evidence** line, because "accepted" must not be read as "verified at runtime".

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-modular-monolith.md) | Modular monolith for the backend | accepted |
| [0002](0002-frontend-state-strategy-and-boundaries.md) | Frontend state strategy and module boundaries | accepted |
| [0003](0003-dual-signals-and-ngrx-implementations.md) | Dual Signals / NgRx implementations selected at build time | accepted |
| [0004](0004-ef-core-and-postgresql.md) | EF Core with PostgreSQL | accepted |
| [0005](0005-authentication-model.md) | JWT in memory + rotating HttpOnly refresh cookie | accepted |
| [0006](0006-api-error-handling.md) | ProblemDetails with stable error codes | accepted |
| [0007](0007-checkout-and-inventory-concurrency.md) | Checkout and inventory concurrency | accepted |
| [0008](0008-testing-approach.md) | Testing approach | accepted |
| [0009](0009-local-development-environment.md) | Local development environment | accepted |
| [0010](0010-payment-outside-the-order-transaction.md) | Move payment capture outside the order transaction | proposed |
| [0011](0011-assistant-microfrontend-as-custom-element.md) | Assistant microfrontend as a runtime-loaded custom element in a side panel | accepted |
| [0012](0012-outbox-and-notifications-service.md) | Transactional outbox and a separate notifications service | accepted |
| [0013](0013-assistant-provider-abstraction-and-guardrails.md) | Assistant model behind one OpenAI-compatible adapter, with server-side guardrails | accepted |

New ADRs: copy [`0000-template.md`](0000-template.md), take the next number, add a row here, and update the record
whenever the implementation changes (superseding instead of silently rewriting history).
