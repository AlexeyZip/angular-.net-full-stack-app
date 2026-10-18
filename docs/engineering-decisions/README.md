# Engineering decision handbook

Each document explains a real decision in this repository using the same structure:
problem · context · options · choice · why · trade-offs · simpler alternatives · rejected alternatives · implementation
references · code · failure scenarios · testing · performance/security · when to choose differently · interview
explanation · evidence and confidence.

**Evidence levels used:** *Verified* = backed by a command executed in this repository (see `docs/project/PROGRESS.md`);
*Implemented, unverified* = code and tests exist but were not executed (e.g. a rate-limit test that does not exist yet);
*Design* = described, not implemented.

| # | Topic | Implementation state |
| --- | --- | --- |
| [01](01-system-architecture.md) | System architecture | implemented |
| [02](02-modular-monolith-vs-microservices.md) | Modular monolith vs microservices | monolith + one extracted service (notifications), verified |
| [03](03-modular-angular-vs-microfrontends.md) | Modular Angular vs microfrontends | modular app + one microfrontend (assistant), verified |
| [04](04-signals-vs-rxjs-vs-ngrx.md) | Signals vs RxJS vs NgRx | implemented, both variants verified (contract tests + E2E) |
| [05](05-angular-dependency-injection-and-facades.md) | Angular DI and facades | implemented |
| [06](06-ef-core-vs-dapper.md) | EF Core vs Dapper | implemented (EF Core) |
| [07](07-postgresql-vs-sql-server.md) | PostgreSQL vs SQL Server | implemented (PostgreSQL) |
| [08](08-database-transactions-and-concurrency.md) | Transactions and concurrency | implemented, verified by concurrency integration tests |
| [09](09-pagination-and-query-performance.md) | Pagination and query performance | implemented |
| [10](10-synchronous-vs-asynchronous-communication.md) | Sync vs async communication | sync + transactional outbox, verified; broker = design |
| [11](11-authentication-and-authorization.md) | Authentication and authorization | implemented |
| [12](12-ai-integration-and-rag.md) | AI integration and RAG | implemented and verified (mock + local Ollama model); pgvector = design |
| [13](13-caching-strategy.md) | Caching | static-asset HTTP caching in nginx (verified); API caching = design |
| [14](14-testing-strategy.md) | Testing strategy | implemented, all levels executed |
| [15](15-cloud-and-azure-architecture.md) | Cloud and Azure | design |
| [16](16-observability-and-monitoring.md) | Observability | partial (logs, health, trace ids) |
| [17](17-security-and-threat-modeling.md) | Security and threat model | implemented controls + threat model |
| [18](18-ci-cd-and-infrastructure-as-code.md) | CI/CD and IaC | CI green on GitHub; containers verified; IaC = design |
| [19](19-api-design-and-error-handling.md) | API design and errors | implemented |
| [20](20-domain-modeling-and-validation.md) | Domain modelling and validation | implemented |
| [21](21-resilience-and-failure-handling.md) | Resilience and failure handling | partial |
| [22](22-deliberately-not-built.md) | Deliberately not built | — |

ADRs (short, normative records) live in [`../adr`](../adr/README.md); this handbook is the long-form explanation.
Step-by-step implementation guides (how a feature is built, how to repeat it) live in [`../guides`](../guides/README.md).
