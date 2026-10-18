# 22 — Deliberately not built

Knowing what *not* to build is an engineering decision. Each item: why it is excluded, what it would take, and the
trigger for introducing it. Status vocabulary matches `docs/project/REQUIREMENTS_TRACEABILITY.md`.

| Feature | Status | Why not now | What it would require | Introduce when |
| --- | --- | --- | --- | --- |
| **Microservices for core modules** (catalog / orders / identity) | OPTIONAL_NOT_IMPLEMENTED | Checkout needs stock + order + payment atomically; one DB transaction does it. Splitting adds sagas, broker, distributed tracing, N deployments. One side effect *was* extracted: `services/notifications` (ADR-0012). | Service per module, own DB, broker (RabbitMQ/Azure Service Bus), saga for checkout with stock reservation and compensation, API gateway. | Independent teams/release cadence, or a module with very different scaling (02). |
| **Microfrontends for the shop's areas** | OPTIONAL_NOT_IMPLEMENTED | One team, one Angular version, lazy routes already split bundles. One optional widget *is* a remote: the assistant (ADR-0011). | Native Federation host + remotes, shared dependency negotiation, cross-app auth/state contracts, versioned design system. | Several teams shipping parts of the UI independently (03). |
| **Real payment provider** | NOT_IMPLEMENTED (by requirement) | Must not handle real payments/credentials. | Provider SDK, authorize → capture split, webhooks, provider idempotency keys, PCI scope review, refund flow. | A real shop. Also closes KI-10. |
| **Server-side cart** | NOT_IMPLEMENTED | Client cart (per-user `localStorage`) + server quote is enough; prices are always re-validated. | `carts` table, merge-on-login endpoint, TTL cleanup. | Cross-device carts, abandoned-cart features, KI-11. |
| **Message broker** | NOT_IMPLEMENTED | The transactional outbox exists (ADR-0012) and pushes to its single consumer over HTTP; a broker adds infrastructure without a second consumer. | Broker + publisher instead of the HTTP client, subscriptions per consumer, dead-letter queues. | A second consumer of the same events. |
| **SignalR real-time order status** | OPTIONAL_NOT_IMPLEMENTED (A-03) | Order status changes are rare; reload is acceptable. | Hub with per-user groups, JWT on the hub (`access_token` query), backplane (Redis) when scaled out. | Live dashboards or customer notifications. |
| **Distributed cache (Redis)** | DESIGN_ONLY (13) | Catalog queries are indexed and small; no measured latency problem. | Output caching with tag invalidation on admin writes, Redis for multi-instance. | Measured read latency/DB load issue. |
| **Full-text search engine** | NOT_IMPLEMENTED | `ILIKE` + `pg_trgm` GIN index is adequate for thousands of products. | PostgreSQL `tsvector` or Elastic/OpenSearch/Azure AI Search + sync via outbox. | Relevance ranking, facets at scale, typo tolerance. |
| **Embedding retrieval (pgvector), streaming answers, evaluation set for the assistant** | DESIGN_ONLY (12) | The assistant exists with lexical retrieval and a local model (ADR-0013); for 64 products this is enough. | `vector` extension, embedding worker fed by the outbox, hybrid retrieval, SSE streaming, offline question → expected-ids set. | Larger or multilingual catalog, measured answer-quality problems. |
| **Cloud deployment / IaC** | DESIGN_ONLY (15) | No cloud spend without approval. | Bicep: App Service/Container Apps, Azure Database for PostgreSQL Flexible Server, Key Vault, App Insights. | When deployment is approved. |
| **OpenTelemetry export** | OPTIONAL_NOT_IMPLEMENTED (A-01) | JSON logs + trace ids + health checks cover local needs. | `OpenTelemetry.Extensions.Hosting`, ASP.NET Core/EF/HTTP instrumentation, OTLP exporter, collector. | Next backend-depth task. |
| **NgRx SignalStore** | NOT_IMPLEMENTED | The requirement compares *Signals services* with *classic NgRx*; a third variant would blur that. | A third provider set behind the same contracts, run with the same contract suite. | As a learning extension. |
| **SSR / prerendering** | NOT_IMPLEMENTED | Auth-heavy SPA; SEO not a goal. Would complicate in-memory token handling. | `@angular/ssr`, hydration, transfer state, server-safe storage access. | Public SEO-critical catalog pages. |
| **Internationalisation, multi-currency, taxes** | NOT_IMPLEMENTED (KI-15) | Scope control; USD only, flat shipping. | `@angular/localize`, currency per order, tax service, price lists. | Selling in more than one market. |
| **Real e-mail delivery, password reset** | NOT_IMPLEMENTED | Order e-mails are rendered and stored by the notifications service but never sent (simulated). | SMTP/provider client in `services/notifications`; signed reset tokens. | Real users. |
| **Admin user management, MFA, OAuth/OIDC login** | NOT_IMPLEMENTED | Two roles seeded; local accounts demonstrate the token model. | Identity provider (Entra ID / Keycloak), OIDC code + PKCE, role admin UI. | Multiple admins/staff or SSO requirements. |
| **Repository/Unit-of-Work layer over EF Core** | Rejected | `DbContext` already is a unit of work and `DbSet` a repository; an extra layer would hide EF features (projections, `ExecuteUpdate`). | — | Only if a second persistence technology must be swapped in (06). |
| **CQRS with separate read store / MediatR** | Rejected for now | Services already separate reads (`AsNoTracking` projections) from writes; a mediator adds indirection without a pipeline need. | Read models, pipeline behaviours. | Many cross-cutting pipeline concerns or a separate read store. |

## How to use this list in an interview

"I deliberately kept it a modular monolith with one database because checkout needs atomicity, and I documented
what microservices, an outbox, a cache or a search engine would cost and which signal would justify each. Building
them without a driver would have made the core harder to verify."

## Evidence

This document describes absence; nothing here is claimed as implemented. Cross-check with the traceability matrix.
