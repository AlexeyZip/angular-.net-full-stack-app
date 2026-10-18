# MASTER PROMPT — Full-Stack Engineering Reference Platform

## 1. Mission and Operating Principles

Act as a senior full-stack software architect, senior Angular engineer, senior C#/.NET engineer, database engineer, QA engineer, DevOps engineer, security reviewer, and technical mentor.

Your mission is to inspect the existing repository and turn it into a **comprehensive, working, production-inspired Full-Stack Engineering Reference Platform**.

The product will be a realistic e-commerce platform with a storefront and an administration portal. It must serve two purposes:

1. **A functional application** with real business logic, persistence, authentication, authorization, tests, and a reproducible local development environment.
2. **A long-term engineering learning platform** that demonstrates modern Angular, C#/.NET, database engineering, software architecture, testing, security, DevOps, and AI-assisted development through actual working code.

This must not become a superficial demo, a collection of disconnected examples, or an overengineered collection of fashionable technologies.

The primary goal is to create a repository I can study independently after implementation, understand file by file, use as a reference when building other applications, and extend over time.

### Mandatory execution priorities

Follow this order of importance:

1. Repository integrity and reproducible development environment.
2. A working end-to-end application using Angular, ASP.NET Core, and PostgreSQL.
3. Correct business rules, authentication, authorization, and data integrity.
4. Two working and tested Angular state-management implementations: Signals-based state and classic NgRx.
5. Automated tests and reliable verification.
6. High-quality engineering documentation grounded in the actual codebase.
7. Advanced architectural examples and optional integrations.

Maintain the complete requirements backlog, including advanced topics, but do not sacrifice a working, tested application to maximize the number of technologies implemented.

**Do not attempt to implement microfrontends, independently deployable microservices, production RAG infrastructure, or optional cloud integrations before the core application, both state-management implementations, essential tests, and foundational documentation are working.**

Prefer a smaller, fully verified implementation over a larger, partially working one.

Do not stop after generating a plan, architecture documents, or placeholder files. Inspect the repository, create the plan, and begin implementing tasks autonomously.

Do not ask for confirmation for routine engineering decisions. Make reasonable decisions, document them, and continue. Ask questions only when a genuinely blocking decision requires user input or when an action could create material cost, security, data-loss, or external-service consequences.

---

## 2. My Background and Learning Objectives

I have approximately five years of professional frontend development experience, primarily with:

- Angular and TypeScript.
- RxJS and reactive programming.
- NgRx and frontend state management.
- REST API integration.
- Frontend architecture, dependency injection, and reusable components.
- Unit, component, and end-to-end testing.
- HTML, CSS, SCSS, design systems, and theming.

I am already familiar with enterprise frontend development, but I want to become a confident **Angular + .NET Full-Stack Engineer**.

I have an existing personal project that uses Angular, NestJS, Prisma, and PostgreSQL. The target backend for this learning platform is **C# and ASP.NET Core**, not Node.js or NestJS.

Use my existing TypeScript and Angular knowledge as a foundation when teaching backend concepts.

For important concepts, compare the familiar TypeScript/NestJS approach with the corresponding C#/.NET approach when the comparison is genuinely useful.

Examples:

- TypeScript interfaces versus C# interfaces and classes.
- JavaScript promises and async/await versus C# asynchronous programming.
- NestJS dependency injection versus ASP.NET Core dependency injection.
- NestJS controllers, providers, guards, and interceptors versus ASP.NET Core controllers, services, authorization, and middleware.
- Prisma versus Entity Framework Core.
- JavaScript exceptions and error handling versus C# exceptions and API error handling.
- Angular Signals versus RxJS and NgRx.
- TypeScript structural typing versus C#'s type system.
- Node.js runtime characteristics versus the .NET runtime.
- JavaScript collections versus C# collections and LINQ.

Do not explain basic Angular concepts unnecessarily. Focus on advanced Angular practices and the new backend technologies while providing enough context to connect them to what I already know.

### Code quality preferences

- Prefer readable, explicit code over clever abstractions.
- Follow established framework conventions.
- Use dependency injection and clear separation of responsibilities where they provide real value.
- Keep business logic out of Angular templates and controllers.
- Avoid unnecessary layers, interfaces, factories, generic frameworks, and indirection.
- Do not automatically introduce Repository, Unit of Work, CQRS, MediatR, or similar abstractions without a clear reason.
- Do not introduce abstractions merely to demonstrate design patterns.
- Prefer small, cohesive, testable units.
- Keep types explicit where that improves understanding and maintainability.
- Use consistent naming and predictable file organization.
- Explain non-obvious design decisions.
- Avoid duplicating logic across the two state-management implementations when shared contracts or reusable UI components can solve the problem cleanly.
- Never hide meaningful complexity behind an abstraction without documenting why it exists.

---

## 3. Repository Inspection and Initial Assessment

Before changing the repository:

1. Inspect the entire project structure.
2. Identify the existing applications, packages, backend, database configuration, tests, scripts, CI pipelines, and documentation.
3. Read existing README files, configuration files, package manifests, lockfiles, project files, and relevant source code.
4. Identify existing business logic, architectural conventions, and reusable functionality.
5. Determine which requirements are already implemented.
6. Identify broken, incomplete, duplicated, or obsolete functionality.
7. Identify the existing package manager, build tools, and workspace structure.
8. Identify the current database setup and migration strategy.
9. Determine whether the repository is already a monorepo and whether it actually needs additional workspace tooling.

**Preserve unrelated work.** Do not blindly overwrite existing implementations, reset Git changes, delete files, replace working architecture, or introduce destructive database operations.

Never expose, copy, or commit corporate credentials, proprietary source code, private configuration, or unrelated confidential information.

### Technology verification

Before selecting or upgrading dependencies:

- Check official documentation and release information for current supported stable versions.
- Prefer supported stable releases over previews, release candidates, and experimental features.
- Prefer the currently supported .NET LTS release unless a documented compatibility constraint requires another supported version.
- Select compatible Angular, TypeScript, Node.js, .NET SDK, EF Core, PostgreSQL, and tooling versions.
- Respect the existing lockfile and repository constraints unless there is a documented reason to change them.
- Record exact versions and compatibility decisions.
- Do not claim a version is current without verifying it.
- Avoid unnecessary upgrades that would destabilize the repository.

Create or update a technology inventory, architecture overview, initial implementation plan, and decision records.

After the initial assessment, **continue into implementation in the same working session**.

---

## 4. Product Scope

Build a realistic e-commerce application with two main user experiences:

1. Customer storefront.
2. Administrative portal.

Use coherent, realistic business rules and persistent data rather than hardcoded mock data for the core application.

### 4.1 Customer storefront

Implement the following features progressively:

- Responsive home page.
- Product catalog.
- Product detail pages.
- Search.
- Filtering by category, price, availability, and other appropriate product attributes.
- Sorting.
- Server-side pagination.
- Product images and image handling.
- Product variants where useful.
- Shopping cart.
- Quantity updates and item removal.
- Cart totals and subtotal calculation.
- Wishlist.
- Product reviews and ratings, subject to appropriate authorization and business rules.
- Registration and login.
- Logout and session handling.
- Customer profile.
- Order history.
- Order details.
- Checkout.
- Order status display.
- Loading, empty, success, and error states.
- Responsive layouts and accessible interactions.

### 4.2 Checkout and business integrity

The backend must be authoritative for all financial and inventory calculations.

Implement:

- Server-side price validation.
- Server-side discount validation if discounts are implemented.
- Server-side subtotal and total calculations.
- Validation of product existence and availability.
- Prevention of purchasing quantities greater than available stock.
- Transactional order creation.
- Appropriate inventory reservation or decrement logic.
- Protection against duplicate checkout requests.
- Idempotency for checkout operations.
- Concurrency handling when multiple customers attempt to purchase the same stock.
- Consistent order and inventory state if a checkout fails.
- Meaningful API errors that the frontend can display.

Do not trust client-provided prices, totals, user IDs, roles, or inventory values.

Create a payment simulator for local development. Do not integrate real payment processing or handle real payment credentials.

### 4.3 Administrative portal

Implement:

- Administrative dashboard with useful KPIs.
- Product CRUD.
- Category CRUD.
- Product image management or a safe local substitute.
- Inventory management.
- Order listing and filtering.
- Order details.
- Validated order-status transitions.
- Customer/order summaries where appropriate.
- Audit records for important administrative operations.
- Role-based access restrictions.
- Loading, empty, success, and error states.

Administrative functionality must be protected by backend authorization, not just hidden in the Angular UI.

### 4.4 Seed data

Provide realistic seed data for local development:

- Multiple categories.
- Enough products to demonstrate filtering, sorting, and pagination.
- Product variants if supported.
- Several customer accounts.
- An administrator account.
- Example orders and order items.
- Inventory records.
- Reviews where applicable.

Document development credentials clearly and make it impossible to mistake seeded credentials for production credentials.

Seed operations should be repeatable and must not unintentionally destroy existing data.

---

## 5. Target Technology Stack

Adapt this stack to the repository where appropriate. Do not force a complete restructure just to match a suggested folder layout.

### Frontend

- Angular using a current supported stable release.
- TypeScript with strict type checking.
- Standalone components.
- Angular Router.
- Signals and RxJS.
- NgRx Store, Actions, Reducers, Selectors, and Effects.
- NgRx Entity where justified.
- Angular reactive forms and typed forms.
- Dependency injection.
- Functional guards and interceptors where appropriate.
- Reusable UI components.
- Design tokens and theme support.
- Accessible and responsive layouts.
- Unit and component tests.
- Playwright end-to-end tests.

### Backend

- C#.
- A supported .NET LTS release.
- ASP.NET Core Web API.
- Entity Framework Core.
- PostgreSQL.
- ASP.NET Core dependency injection.
- Authentication and authorization.
- API validation and consistent error handling.
- OpenAPI documentation.
- Structured logging.
- Health checks.
- CancellationToken-aware asynchronous operations.
- Rate limiting where appropriate.
- Caching where justified.
- Background services only when there is a genuine use case.
- Integration and unit tests.

### Infrastructure and engineering tools

- Docker.
- Docker Compose for local development.
- PostgreSQL.
- Redis only where a concrete use case justifies it.
- GitHub Actions or the existing CI platform.
- OpenTelemetry where practical.
- Infrastructure as Code using Bicep for optional Azure examples.
- Optional SignalR examples.
- Optional AI integration with a provider abstraction and local mock mode.

Use the simplest stack that satisfies the requirements. Do not introduce Redis, messaging infrastructure, a service bus, Kubernetes, or additional databases merely because they appear in the requirements.

### Technology documentation

Maintain a file documenting:

- Exact versions.
- Compatibility constraints.
- Why each major dependency exists.
- Which dependencies are essential.
- Which are optional.
- Which advanced features have not been implemented.

---

## 6. Angular Reference Implementation

Build a modern, maintainable Angular application using current supported Angular conventions.

### 6.1 Application architecture

Use standalone components and a clear feature-oriented structure.

Separate concerns appropriately:

- Feature pages.
- Presentational components.
- Reusable UI components.
- API clients.
- State management.
- Domain models and contracts.
- Form validation.
- Authentication and authorization-related frontend behavior.
- Shared utilities.

Avoid turning every file into a separate abstraction without a reason.

Keep templates declarative. Put nontrivial business and orchestration logic into TypeScript classes, state services, facades, or other appropriate units.

### 6.2 Angular concepts to demonstrate

Use actual application code to demonstrate:

- Standalone components.
- Component inputs and outputs.
- Signal inputs and outputs where supported and appropriate.
- Signals and computed values.
- Effects only when appropriate.
- RxJS observables and operators.
- Interoperability between Signals and RxJS.
- Dependency injection.
- InjectionToken where a real abstraction or configuration token is useful.
- Functional guards and interceptors.
- Lazy-loaded routes.
- Route-level providers where appropriate.
- Typed reactive forms.
- Custom validators.
- ControlValueAccessor for a meaningful reusable form control.
- Error handling.
- Async request cancellation.
- Loading and error states.
- Change detection and performance considerations.
- `@defer` where it provides measurable or understandable value.
- Content projection where useful.
- Accessibility.
- Component and service testing.
- Feature boundaries.
- API integration.
- Runtime theme switching.
- Light and dark themes.

Use SSR and hydration only if they solve a real problem for this application. If omitted, explain why.

### 6.3 UI design and accessibility

Create a consistent, polished interface suitable for a professional portfolio.

Include:

- Reusable buttons, inputs, dialogs, tables, cards, notifications, and loading indicators.
- Consistent spacing, typography, colors, and responsive breakpoints.
- Design tokens.
- Light and dark themes.
- Accessible labels and keyboard navigation.
- Appropriate semantic HTML.
- Focus states.
- Empty states.
- Error states.
- Responsive navigation.
- Reusable table patterns.
- Clear validation messages.

Avoid building an unnecessarily large design system. Reusable components should serve real application needs.

---

## 7. Mandatory Dual Angular State Management

This requirement is mandatory and must not be silently dropped.

Implement **two runnable, testable variants of the application state-management layer**:

1. A modern Signals-based implementation.
2. A classic NgRx implementation using Store, Actions, Reducers, Selectors, and Effects.

Both implementations must support the same meaningful business scenarios and be documented using actual code from this repository.

Do not run both competing state-management systems simultaneously for the same feature in the same application instance.

Use an explicit, documented strategy to make each implementation runnable. For example, provide separate application configurations, routes, feature entry points, or development variants, depending on the existing architecture.

Shared API clients, domain models, validation contracts, and presentational components should be reused where practical.

Do not duplicate the entire UI or backend simply to demonstrate the two approaches.

### 7.1 Required state scenarios

Both variants must support:

- Product catalog loading.
- Search.
- Filtering.
- Sorting.
- Server-side pagination.
- Cart item addition.
- Cart item removal.
- Cart quantity updates.
- Cart clearing.
- Cart item count.
- Cart subtotal and derived totals.
- Wishlist operations.
- Loading states.
- Success states.
- Empty states.
- Error states.
- Asynchronous requests.
- Appropriate request cancellation or stale-response handling.
- Logout and user-specific state reset.
- Persistence where appropriate.
- Derived state.
- Recoverable API errors.

Do not place sensitive credentials, passwords, or tokens in global state.

### 7.2 Signals-based implementation

Use Angular Signals and `computed` for appropriate state and derived values.

Implement an understandable state-service or facade-based approach with:

- Explicit state ownership.
- Read-only public state where practical.
- Controlled mutations.
- Derived state using `computed`.
- Asynchronous API integration.
- RxJS where it is a better fit.
- Clear loading and error handling.
- Appropriate cleanup.
- Persistence only where justified.
- Logout/reset behavior.
- Protection against stale user-specific persisted state.
- Unit tests.

Use `effect` only for genuine side effects. Do not use effects as a default mechanism for deriving state or synchronizing everything with everything else.

Document the boundary between local component state, shared Signals-based state, and RxJS streams.

### 7.3 Classic NgRx implementation

Implement:

- Typed actions.
- Reducers.
- Selectors.
- Effects.
- Feature state registration.
- Typed state and API contracts.
- Request lifecycle state.
- Error handling.
- Logout/reset actions.
- Appropriate entity management where useful.
- DevTools integration for development where appropriate.
- Unit tests for reducers and selectors.
- Tests for effects where practical.
- Tests for relevant facade or service behavior.

Reducers must remain pure. Never perform side effects inside reducers.

Use current supported NgRx conventions. Do not use deprecated APIs merely because they appear in old tutorials.

### 7.4 State implementation acceptance criteria

Do not mark this requirement complete until:

- Both variants compile.
- Both can be run.
- Both interact with the real backend.
- Both support the required scenarios.
- Both have meaningful tests.
- Logout and reset behavior are verified.
- Loading, success, empty, and error states are demonstrated.
- The comparison documentation reflects the actual code.

### 7.5 Mandatory comparison document

Create:

`docs/engineering-decisions/04-signals-vs-rxjs-vs-ngrx.md`

Explain:

- Signals versus RxJS versus NgRx.
- Component-local state versus shared state.
- Signals services versus a global store.
- `computed` versus selectors.
- Synchronous state changes versus asynchronous workflows.
- Where Effects belong.
- Request cancellation and stale responses.
- Testing strategies.
- Debugging and observability.
- Boilerplate and complexity.
- Performance considerations.
- Common mistakes.
- When each approach is appropriate.
- How to migrate between approaches.
- Interview questions and strong example answers.

Include diagrams and code snippets from the actual project.

---

## 8. JavaScript and TypeScript Learning Catalog

Create a structured learning catalog for important JavaScript and TypeScript concepts.

The purpose is not to teach programming from scratch. It is to strengthen deeper language knowledge, explain runtime behavior, and improve interview readiness.

Cover at least:

### JavaScript

- Execution contexts.
- Scope.
- Lexical environments.
- Closures.
- Hoisting.
- `var`, `let`, and `const`.
- Temporal Dead Zone.
- `this`.
- Arrow functions.
- Prototypes.
- Prototype chain.
- Classes and inheritance.
- Event loop.
- Call stack.
- Microtasks and macrotasks.
- Promises.
- Async/await.
- Error propagation.
- Equality and coercion.
- Immutability.
- Object references.
- Shallow versus deep copying.
- Modules.
- Memory management.
- Debouncing and throttling.
- Functional programming concepts.

### TypeScript

- Structural typing.
- Interfaces and type aliases.
- Unions and intersections.
- Generics.
- Utility types.
- Type narrowing.
- Discriminated unions.
- `unknown` versus `any`.
- `never`.
- `void`.
- `strictNullChecks`.
- Type inference.
- Type guards.
- Mapped and conditional types.
- Template literal types.
- `keyof` and indexed access types.
- `as const`.
- `satisfies`.
- Type assertions and their risks.
- Runtime validation versus compile-time types.
- TypeScript types at API boundaries.

For every major topic, provide:

1. A concise conceptual explanation.
2. A runnable minimal example.
3. A real example from the application where possible.
4. Common mistakes.
5. Why the concept matters.
6. Alternatives and trade-offs.
7. Interview questions and model answers.

Keep the catalog searchable and organized by topic.

---

## 9. C# and ASP.NET Core Learning Catalog

Create a practical C#/.NET learning path grounded in the actual backend.

### 9.1 C# fundamentals

Cover:

- Value types and reference types.
- Classes and records.
- Structs where appropriate.
- Interfaces.
- Encapsulation.
- Inheritance and composition.
- Access modifiers.
- Nullable reference types.
- Generics.
- Collections.
- LINQ.
- Extension methods.
- Delegates and events.
- Exceptions.
- `async` and `await`.
- `Task` and `Task<T>`.
- CancellationToken.
- Pattern matching.
- Enums.
- Records and immutability.
- Dependency injection.
- Configuration and options.
- Attributes.
- Reflection where relevant.
- Disposal and `IDisposable`/`IAsyncDisposable`.
- Resource management.
- C# language features actually used by the project.

Explain the differences between compile-time types and runtime validation.

### 9.2 ASP.NET Core

Demonstrate:

- Application startup and hosting.
- Dependency injection.
- Controllers and routing.
- HTTP methods and status codes.
- DTOs.
- Model validation.
- Middleware.
- Exception handling.
- Dependency lifetime choices.
- Configuration and environment-specific settings.
- Options pattern.
- Authentication.
- Authorization policies.
- Role-based access control.
- Claims.
- JWT or another justified local authentication strategy.
- OpenAPI.
- Structured logging.
- Health checks.
- Rate limiting.
- CancellationToken propagation.
- Request and response processing.
- API versioning only if useful.
- Background services only when justified.
- Caching and resilience where appropriate.
- Consistent error responses, preferably using supported problem-details conventions.

Explain what each layer does and why it exists.

### 9.3 Backend architecture

Start with a **modular monolith**.

Use a clear separation of responsibilities, such as:

- API and presentation.
- Application/business workflows.
- Domain models and rules.
- Persistence and infrastructure.
- Shared contracts only where necessary.

Adapt the exact structure to the application's real complexity.

Do not automatically create a separate project for every folder or layer.

Avoid unnecessary CQRS, MediatR, repositories, generic base classes, or Unit of Work wrappers around EF Core.

Where a design pattern is used, explain:

- The problem it solves.
- Why the simpler alternative was insufficient.
- The additional complexity it introduces.

Include examples of meaningful business rules and validation that belong in the backend rather than in controllers.

---

## 10. PostgreSQL and Entity Framework Core

Use PostgreSQL as the primary persistent database and EF Core as the primary ORM.

The application must use real persistence for its core functionality.

Demonstrate:

- Entity modeling.
- Primary and foreign keys.
- Relationships.
- One-to-many and many-to-many relationships where appropriate.
- Constraints.
- Indexes.
- Unique constraints.
- Migrations.
- Seeding.
- LINQ queries.
- Projection into DTOs.
- Tracking versus no-tracking queries.
- Server-side pagination.
- Filtering and sorting.
- Transactions.
- Optimistic concurrency.
- Inventory consistency.
- Idempotency.
- Query performance.
- Avoiding N+1 queries.
- Appropriate loading strategies.
- Safe schema evolution.
- Database testing.
- Connection management.
- Migration workflows.

Use database constraints to enforce important invariants where appropriate, not only application-level validation.

### Specific business integrity requirements

Demonstrate a safe approach to concurrent stock changes and order creation.

Explain which mechanism is used and why. Depending on the implementation, this may involve transactions, concurrency tokens, atomic updates, appropriate isolation, or conditional database updates.

Do not assume that merely wrapping operations in a transaction automatically solves every concurrency problem.

Demonstrate how checkout behaves under retries, concurrent requests, and partial failures.

### Comparison topics

Create practical comparisons for:

- EF Core versus Dapper.
- PostgreSQL versus SQL Server.
- ORM tracking versus no-tracking.
- Offset versus cursor/keyset pagination.
- Optimistic versus pessimistic concurrency.
- Database transactions versus distributed transactions.
- Database constraints versus application validation.
- Migrations in local development versus production deployment.

Use examples from the actual application rather than generic snippets whenever possible.

---

## 11. Authentication, Authorization, and Security

Implement a secure and understandable local authentication flow.

Use established ASP.NET Core authentication and authorization capabilities.

Demonstrate:

- Registration.
- Login.
- Logout.
- Password hashing through a trusted framework or library.
- Token or session handling.
- Role-based access control.
- Authorization policies where appropriate.
- Backend authorization on protected endpoints.
- Expiration and refresh strategy where applicable.
- Safe development credential handling.
- Secrets management.
- CORS configuration.
- CSRF considerations appropriate to the chosen authentication mechanism.
- Input validation.
- Output handling.
- Rate limiting.
- Safe error messages.
- Protection against mass assignment.
- Secure file upload validation if uploads are implemented.
- Audit logging for sensitive administrative operations.
- Least-privilege principles.

Explain the security trade-offs of the chosen authentication model.

Do not store passwords, access tokens, refresh tokens, or other sensitive credentials in NgRx or Signals global state.

Do not store production secrets in the repository.

Never make security claims without testing or evidence. Clearly document any remaining security limitations.

---

## 12. Testing Strategy

Testing is a core deliverable, not a final optional step.

Implement a practical testing pyramid.

### 12.1 Frontend tests

Use the existing suitable framework or a modern compatible testing setup.

Cover:

- Utility functions.
- State services.
- Signals-based state.
- NgRx reducers.
- NgRx selectors.
- NgRx effects.
- API services.
- Component behavior.
- Form validation.
- Loading, error, and empty states.
- Authentication-related behavior.
- Important business interactions.

Avoid testing implementation details that do not represent user-visible or meaningful behavior.

### 12.2 Backend tests

Cover:

- Domain/business rules.
- Service behavior.
- Validation.
- API endpoints.
- Authentication and authorization.
- Persistence.
- EF Core queries.
- Transactions.
- Concurrency-sensitive operations.
- Checkout idempotency.
- Order-state transitions.
- Error responses.

Use integration tests with a real PostgreSQL instance where database-specific behavior matters.

Do not rely exclusively on EF Core's in-memory provider to validate relational database behavior.

Provide repeatable test database setup and teardown.

### 12.3 End-to-end tests

Use Playwright to cover important user journeys, including:

1. Browse products.
2. Search and filter products.
3. Open a product detail page.
4. Add a product to the cart.
5. Update cart quantities.
6. Complete a checkout using the payment simulator.
7. Verify the created order.
8. View order history.
9. Log in as an administrator.
10. Create or edit a product.
11. Update inventory.
12. Change an order status.
13. Verify unauthorized users cannot access protected administrative actions.

Also verify important failure paths, including invalid input, unavailable inventory, and relevant API errors.

### 12.4 Test quality requirements

- Tests must be executable.
- Do not generate placeholder tests merely to inflate coverage.
- Do not make assertions that always pass.
- Do not silently skip failing tests.
- Do not weaken tests just to make the build green.
- Fix the underlying problem when practical.
- Document known flaky tests or environmental limitations.
- Keep test commands in the README.
- Verify the critical paths after major changes.

---

## 13. Advanced Architecture and Distributed Systems

These topics belong in the learning backlog and should be introduced only after the core modular monolith is working.

Do not split the core application into microservices just to demonstrate them.

### 13.1 Microservices

Document when a modular monolith is sufficient and when independently deployable services become justified.

Use hypothetical or optional examples for boundaries such as:

- Catalog.
- Orders.
- Inventory.
- Notifications.
- AI assistance.

Where an advanced example is implemented, demonstrate:

- Service boundaries.
- Synchronous HTTP communication.
- Asynchronous messaging.
- Message contracts.
- Outbox pattern.
- Idempotent consumers.
- Retries and backoff.
- Timeouts.
- Circuit breakers.
- Eventual consistency.
- Dead-letter handling.
- Distributed tracing.
- Service-to-service authentication.
- Failure recovery.

Use a real message broker only if the implementation justifies its cost and operational complexity.

If these features remain conceptual or illustrative, label them clearly.

### 13.2 Microfrontends

Compare:

- A modular Angular application.
- Independently deployed microfrontends.
- Module Federation or another justified integration approach.

Explain the trade-offs around:

- Deployment independence.
- Shared dependencies.
- Runtime integration.
- Routing.
- Authentication.
- Design systems.
- Team ownership.
- Version compatibility.
- Testing and debugging.

Do not claim independent deployment unless it is genuinely supported by the implementation and deployment configuration.

### 13.3 Real-time communication

Evaluate SignalR for appropriate features, such as live order updates or administrative notifications.

If implemented, provide a working local example and tests or verification steps.

If omitted, explain why real-time communication is not necessary for the initial application.

---

## 14. Optional AI Assistant and RAG

Treat AI functionality as an advanced, optional module.

The core application must work without an external AI provider, API key, or paid service.

If implemented, use:

- A provider abstraction.
- A mock provider for local development.
- Clear configuration.
- Safe handling of API credentials.
- Streaming responses where justified.
- Explicit timeouts and error handling.
- Appropriate logging without exposing sensitive data.
- Permission checks for user-specific information.
- Prompt-injection protections.
- Input and output boundaries.
- A clear distinction between trusted instructions and untrusted retrieved content.
- Restrictions against arbitrary SQL execution or unrestricted tool access.

If retrieval-augmented generation is implemented, explain:

- Document ingestion.
- Chunking.
- Embeddings.
- Retrieval.
- Context construction.
- Access control.
- Data freshness.
- Evaluation.
- Hallucination limitations.
- Cost and latency.
- Prompt-injection risks.

Do not build a large RAG infrastructure before the main application works.

Do not require a paid AI service for local development.

If the AI module is not implemented, provide an architecture decision and a realistic implementation plan rather than pretending it is complete.

---

## 15. Optional Azure and Cloud Architecture

The project should work locally without requiring an Azure subscription.

Document an optional Azure deployment architecture using appropriate services, potentially including:

- Azure Container Apps or App Service.
- Azure Container Registry.
- Microsoft Entra ID.
- Azure Key Vault.
- Azure Blob Storage.
- Azure Service Bus.
- Azure Monitor and Application Insights.
- Azure AI services where appropriate.
- Bicep for Infrastructure as Code.

Select services based on actual needs, not because every service is available.

Provide Bicep templates only where justified and validate them where tooling permits.

**Do not provision cloud resources, create billable services, deploy publicly, or incur external costs without explicit user approval.**

Do not claim cloud infrastructure is deployed merely because templates exist.

Clearly distinguish:

- Implemented locally.
- Infrastructure code created.
- Infrastructure validated.
- Infrastructure deployed.
- Deployment not performed.

Explain local-development alternatives for cloud dependencies.

---

## 16. Docker, CI/CD, and Developer Experience

Create a reproducible local environment.

Use Docker Compose where appropriate to run:

- PostgreSQL.
- The ASP.NET Core API.
- The Angular application.
- Optional supporting services only when required.

The environment should have clear startup, migration, seed, test, and shutdown instructions.

Include:

- `.env.example` or equivalent safe configuration templates.
- Appropriate `.gitignore` rules.
- Health checks.
- Dependency readiness handling.
- Database persistence for local development.
- Useful logs.
- Consistent scripts.
- Reproducible dependency installation.
- Clear failure diagnostics.

Do not commit real secrets.

### CI pipeline

Configure the existing CI platform, preferably GitHub Actions if appropriate, to run relevant checks:

- Dependency installation.
- Formatting and linting.
- Frontend build.
- Frontend tests.
- Backend build.
- Backend tests.
- Database-backed integration tests where feasible.
- End-to-end tests where the environment supports them.
- Infrastructure validation where applicable.

Avoid workflows that depend on undocumented manual steps.

Do not add Kubernetes unless there is a concrete learning or deployment requirement beyond what Docker Compose and a simpler cloud deployment can demonstrate.

---

## 17. Observability, Performance, and Reliability

Implement foundational observability for the actual application.

Include, where appropriate:

- Structured backend logging.
- Correlation or trace identifiers.
- Useful error logs.
- Health checks.
- Request duration visibility.
- Database query performance awareness.
- OpenTelemetry instrumentation.
- Distributed tracing for implemented cross-service flows.
- Metrics for important business operations.
- Frontend error handling.
- Reasonable API timeouts.
- Cancellation propagation.
- Appropriate retry policies.
- Cache invalidation considerations.

Avoid adding observability infrastructure that cannot be run or meaningfully verified.

Document:

- What is instrumented.
- How to inspect it locally.
- What is not instrumented.
- Known performance limitations.
- How to investigate slow database queries.
- How to distinguish client, API, and database failures.

Do not retry non-idempotent operations blindly.

---

## 18. Mandatory Engineering Decision Handbook

Create a comprehensive decision handbook under:

`docs/engineering-decisions/`

The handbook must explain the actual architecture and implementation choices in this repository.

For every major decision, include:

1. Problem being solved.
2. Context and constraints.
3. Options considered.
4. Chosen approach.
5. Why it was selected.
6. Trade-offs.
7. Simpler alternatives and why they were insufficient or preferable in some circumstances.
8. Rejected alternatives and the reasons for rejection.
9. Exact implementation references.
10. Relevant code examples.
11. Failure scenarios and limitations.
12. Testing implications.
13. Performance and security implications where relevant.
14. When a different approach would be better.
15. How to explain the decision in a technical interview.
16. Evidence and confidence level, including any assumptions.

Use actual code from the repository. Do not write generic essays disconnected from the implementation.

Create at least the following documents:

- `01-system-architecture.md`
- `02-modular-monolith-vs-microservices.md`
- `03-modular-angular-vs-microfrontends.md`
- `04-signals-vs-rxjs-vs-ngrx.md`
- `05-angular-dependency-injection-and-facades.md`
- `06-ef-core-vs-dapper.md`
- `07-postgresql-vs-sql-server.md`
- `08-database-transactions-and-concurrency.md`
- `09-pagination-and-query-performance.md`
- `10-synchronous-vs-asynchronous-communication.md`
- `11-authentication-and-authorization.md`
- `12-ai-integration-and-rag.md`
- `13-caching-strategy.md`
- `14-testing-strategy.md`
- `15-cloud-and-azure-architecture.md`
- `16-observability-and-monitoring.md`
- `17-security-and-threat-modeling.md`
- `18-ci-cd-and-infrastructure-as-code.md`
- `19-api-design-and-error-handling.md`
- `20-domain-modeling-and-validation.md`
- `21-resilience-and-failure-handling.md`
- `22-deliberately-not-built.md`

Adapt the filenames if the existing repository has a documented convention, but preserve the topics and cross-references.

The `deliberately-not-built` document is important. Explain which advanced features were intentionally excluded, why, what their implementation would require, and when they should be introduced.

---

## 19. Architecture Decision Records

Create:

`docs/adr/`

Use Architecture Decision Records to capture major architectural decisions.

Each ADR should include:

- ADR identifier and title.
- Status: proposed, accepted, superseded, or rejected.
- Context.
- Problem.
- Decision.
- Alternatives considered.
- Consequences.
- Trade-offs.
- Security and operational implications where applicable.
- Conditions that would justify revisiting the decision.

Create ADRs for the most consequential choices, including:

- Modular monolith.
- Frontend state-management strategy.
- Dual Signals and NgRx implementations.
- EF Core and PostgreSQL.
- Authentication model.
- API error handling.
- Checkout and inventory concurrency.
- Testing approach.
- Local development environment.
- Optional distributed architecture decisions when actually relevant.

Keep ADRs synchronized with the code. If implementation changes, update the corresponding records.

Do not create an ADR claiming a decision is implemented if it is only proposed.

---

## 20. Searchable Engineering Topic Catalog

Create a searchable learning catalog under `docs/learning/`.

Organize the documentation by topic and link each topic to the relevant implementation.

Each substantial topic should contain:

- What problem the concept solves.
- When it is useful.
- When it is unnecessary.
- Exact source files in this repository.
- A minimal understandable example.
- The actual production-inspired implementation.
- Common mistakes.
- Alternatives and trade-offs.
- How to test the implementation.
- Debugging guidance.
- Relevant interview questions and answers.
- Links to official documentation.

Include topic indexes for:

- Angular.
- JavaScript and TypeScript.
- RxJS.
- Signals.
- NgRx.
- C#.
- ASP.NET Core.
- Entity Framework Core.
- PostgreSQL.
- HTTP and REST.
- Authentication and security.
- Testing.
- Architecture.
- Docker and CI/CD.
- Observability.
- Optional cloud and distributed systems.

Prefer concise, accurate, interconnected documentation over duplicated chapters.

Use official documentation links where possible.

Distinguish official documentation, personal explanations, and implementation-specific decisions.

---

## 21. AI-Assisted Engineering Workflow

Create repository-level AI instructions appropriate for Cursor and other coding agents.

Inspect existing `AGENTS.md`, Cursor rules, and similar files before adding or modifying them.

The repository should guide AI tools to:

- Read relevant documentation before implementing features.
- Inspect existing code before proposing replacements.
- Follow the architecture and established conventions.
- Work from explicit requirements and acceptance criteria.
- Implement small, coherent changes.
- Run relevant tests and verification.
- Update documentation when behavior or architecture changes.
- Avoid unnecessary abstractions.
- Avoid unrelated refactoring.
- Never expose or commit secrets.
- Report failed checks honestly.
- Resume work using persistent progress files.

Create specialized agent instructions where they provide practical value, such as:

- Architecture.
- Angular.
- C#/.NET.
- Database and EF Core.
- Security.
- Testing.
- DevOps and Azure.
- Documentation.

Do not create numerous redundant agent definitions simply to increase their count.

### Reusable skills

Create reusable, task-focused instructions for workflows such as:

- Spec-driven feature development.
- Angular feature implementation.
- ASP.NET Core endpoint implementation.
- Database schema changes and migrations.
- State-management implementation.
- Automated test creation.
- Security review.
- Code review.
- Architecture Decision Records.
- Documentation updates.
- Technical interview preparation.

Use the capabilities actually supported by the installed tools. Do not assume every agent, hook, MCP server, or skill format is available.

If a proposed automation requires an unavailable tool or service, document the limitation and provide a compatible alternative.

---

## 22. Repository Structure

Use the existing repository structure where practical.

A possible structure is:

- `apps/`
  - Angular storefront.
  - Optional separate admin application or application entry point if justified.
- `services/`
  - ASP.NET Core API.
- `packages/`
  - Shared frontend libraries or contracts where justified.
- `tests/`
  - Cross-project and end-to-end tests where appropriate.
- `infra/`
  - Docker, CI/CD, and optional Infrastructure as Code.
- `docs/`
  - Architecture.
  - Engineering decisions.
  - ADRs.
  - Learning materials.
  - Project plans and progress.
- Root-level project instructions and developer scripts.

This is a suggestion, not a mandate.

Do not introduce Nx, additional workspace tooling, microfrontends, or separate deployable applications unless the existing repository and requirements justify them.

Prefer the smallest structure that supports clear ownership, independent testing, and future extension.

---

## 23. Phased Implementation Priorities

Maintain the full backlog from the beginning, but execute work in dependency order.

### Phase 1 — Foundation

- Inspect the repository.
- Record existing state and constraints.
- Select and document compatible stable versions.
- Define architecture.
- Create persistent planning and progress files.
- Establish reproducible local development.
- Configure PostgreSQL and EF Core.
- Establish migrations and seed data.
- Configure baseline frontend and backend builds.
- Add foundational tests and CI checks.

### Phase 2 — Core end-to-end application

Build a coherent vertical slice, then expand it.

Prioritize:

1. Product catalog API and database model.
2. Angular catalog UI.
3. Search, filtering, sorting, and pagination.
4. Product details.
5. Registration and login.
6. Backend authorization.
7. Cart.
8. Checkout and order creation.
9. Inventory integrity.
10. Customer order history.
11. Administrative product and order management.

At every stage, connect the frontend to the real backend and database.

Do not replace core functionality with hardcoded mock data.

### Phase 3 — Both state-management implementations

Implement and verify:

- Signals-based state.
- Classic NgRx state.
- Equivalent scenarios.
- Shared contracts and reusable UI.
- Tests.
- A clear way to run either implementation.
- Comparison documentation.

Do not mark the requirement complete until both variants are working.

### Phase 4 — Quality and frontend depth

- Complete essential unit and integration tests.
- Add Playwright end-to-end workflows.
- Improve accessibility and responsive design.
- Add reusable components and themes.
- Improve validation and error states.
- Add the JavaScript/TypeScript learning catalog.
- Add foundational Angular learning materials.

### Phase 5 — Backend and architecture depth

- Complete C#/.NET learning materials.
- Improve database and concurrency examples.
- Add architecture decision documentation.
- Add ADRs.
- Add security and performance reviews.
- Document testing and debugging practices.

### Phase 6 — Advanced topics

Only after the core is stable, evaluate:

- SignalR.
- Caching.
- Messaging and outbox patterns.
- Microservices examples.
- Microfrontend examples.
- AI assistant and RAG.
- Azure deployment architecture.
- Advanced observability.
- Additional Infrastructure as Code.

Advanced topics may be partially implemented or documented-only if time, environment, or complexity makes full implementation inappropriate. Their status must be explicit.

### Phase 7 — Final verification

- Run the builds.
- Run available tests.
- Validate migrations and seed data.
- Verify critical user journeys.
- Verify both state variants.
- Verify authorization.
- Verify checkout and inventory integrity.
- Verify Docker Compose where possible.
- Validate CI and infrastructure templates where possible.
- Review secrets and configuration.
- Update documentation.
- Produce an honest final status report.

---

## 24. Autonomous Execution Protocol — Mandatory

You must operate as an autonomous implementation agent, not just a coding adviser.

Create and maintain these persistent files:

- `docs/project/MASTER_PLAN.md`
- `docs/project/IMPLEMENTATION_BACKLOG.md`
- `docs/project/PROGRESS.md`
- `docs/project/KNOWN_ISSUES.md`
- `docs/project/REQUIREMENTS_TRACEABILITY.md`

If equivalent files already exist, inspect and update them instead of creating duplicates.

### 24.1 Master plan

`MASTER_PLAN.md` must describe:

- Product scope.
- Repository architecture.
- Technology choices.
- Implementation phases.
- Dependencies between phases.
- Verification strategy.
- Known constraints.
- Advanced topics and their intended priority.

### 24.2 Implementation backlog

`IMPLEMENTATION_BACKLOG.md` must contain actionable tasks with:

- Unique task IDs.
- Clear descriptions.
- Dependencies.
- Priority.
- Acceptance criteria.
- Required tests.
- Required documentation.
- Current status.

Use these statuses:

- `TODO`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`

A task must not be marked `DONE` merely because files were created.

It must satisfy its acceptance criteria and have appropriate verification evidence.

### 24.3 Progress log

`PROGRESS.md` must record:

- Completed work.
- Files and components changed.
- Commands executed.
- Tests and builds executed.
- Results.
- Known limitations.
- The exact next recommended task.
- Important decisions made during implementation.

Update this file after meaningful implementation milestones.

### 24.4 Known issues

`KNOWN_ISSUES.md` must record:

- Reproducible defects.
- Failed or unavailable checks.
- Environmental limitations.
- Workarounds.
- Security or reliability limitations.
- Unimplemented requirements that matter to the current phase.

Do not hide failures to make progress appear better.

### 24.5 Requirements traceability

`REQUIREMENTS_TRACEABILITY.md` must map each significant requirement to:

- Requirement ID.
- Description.
- Implementation files or modules.
- Tests or verification commands.
- Documentation.
- Current status.
- Evidence or known limitations.

Use explicit statuses such as:

- `IMPLEMENTED_AND_VERIFIED`
- `IMPLEMENTED_NOT_FULLY_VERIFIED`
- `PARTIALLY_IMPLEMENTED`
- `DESIGN_ONLY`
- `OPTIONAL_NOT_IMPLEMENTED`
- `NOT_IMPLEMENTED`
- `BLOCKED`

### 24.6 Autonomous task execution loop

After the initial inspection and planning:

1. Select the highest-priority task whose dependencies are satisfied.
2. Read the relevant specifications and source files.
3. Implement the task.
4. Run focused verification.
5. Run broader verification when appropriate.
6. Fix discovered issues.
7. Update the backlog, progress log, known issues, and traceability.
8. Update relevant documentation and ADRs.
9. Commit no changes unless explicitly requested or repository conventions require otherwise.
10. Select the next eligible task and continue.

Do not stop after completing a single task if other eligible tasks can be implemented safely.

Do not repeatedly ask the user what to do next when the backlog already defines the next task.

If a task is blocked, record the exact blocker, choose another eligible task, and continue.

### 24.7 Vertical-slice development

Prefer complete vertical slices over broad scaffolding.

For example, a product catalog slice should include:

- Database model and migration.
- Backend endpoint.
- Validation and error handling.
- Frontend API integration.
- UI behavior.
- Loading, empty, and error states.
- Tests.
- Documentation.

Keep the repository in a usable state after each meaningful milestone.

Avoid large, unverified batches of generated code.

### 24.8 Session continuity

Assume the Agent session may end unexpectedly.

Persistent project files are the source of truth for continuing work.

Before concluding a session:

- Save the current state.
- Update progress.
- Record unfinished work.
- Record verification results.
- Identify the exact next task.

When a new session starts, inspect the persistent project files and current repository state, then resume from the next eligible task instead of restarting the entire plan or rewriting existing work.

---

## 25. Verification Rules

Do not equate code generation with a working implementation.

Use actual verification wherever the environment permits.

For frontend changes, run relevant linting, type checks, builds, and tests.

For backend changes, run relevant builds, tests, and API checks.

For database changes, validate migrations and persistence behavior.

For integration changes, verify communication between Angular, ASP.NET Core, and PostgreSQL.

For end-to-end behavior, use Playwright where the environment supports it.

For Docker and CI changes, validate the relevant configurations and execute them when feasible.

If a check cannot be run because a dependency, credential, service, or environment is unavailable:

1. Record the exact reason.
2. Perform alternative static or focused verification where useful.
3. Do not claim the check passed.
4. Identify what remains to be verified.

Never fabricate test results, build output, successful deployments, benchmark numbers, coverage percentages, or official documentation evidence.

### Minimum end-to-end acceptance criteria

The final core application should demonstrate:

- The Angular application starts.
- The ASP.NET Core API starts.
- PostgreSQL is available.
- Migrations can be applied through documented commands.
- Seed data can be created safely.
- Product data is retrieved from the backend.
- Search, filtering, sorting, and pagination work.
- Authentication works.
- Protected administrative operations enforce authorization.
- Cart operations work.
- Checkout creates persistent orders.
- Backend calculations determine authoritative totals.
- Inventory cannot be oversold under the chosen concurrency model.
- Duplicate checkout requests are handled appropriately.
- Customer order history works.
- Administrative product and order workflows work.
- Both state-management variants work independently.
- Essential automated tests pass.
- The local development setup is documented and reproducible.

If an acceptance criterion cannot be satisfied, explain the blocker and leave its status accurate.

---

## 26. Final Deliverables

The target repository should contain the following deliverables, with the actual status of each clearly documented.

### Functional software

- Angular storefront.
- Administrative portal or clearly separated administrative experience.
- ASP.NET Core API.
- PostgreSQL persistence.
- EF Core migrations.
- Development seed data.
- Authentication and authorization.
- E-commerce business workflows.
- Two runnable Angular state-management variants.
- Automated tests.
- Docker Compose local environment.
- CI pipeline where supported.

### Learning resources

- JavaScript and TypeScript learning catalog.
- Angular architecture and state-management guide.
- C# and ASP.NET Core learning catalog.
- PostgreSQL and EF Core guide.
- Testing guide.
- Security guide.
- Architecture handbook.
- ADRs.
- Searchable topic index.
- Interview questions and answers.
- Official documentation references.
- AI-assisted engineering instructions.

### Optional advanced deliverables

- SignalR example.
- Caching example.
- Distributed systems example.
- Microfrontend architecture example.
- AI assistant/RAG module.
- Azure architecture and Bicep templates.
- Advanced observability and performance examples.

These advanced deliverables must not be presented as complete if they are only documented or partially implemented.

---

## 27. Definition of Success

Success is not measured by the number of generated files or the number of technologies mentioned in the documentation.

Success means I have a reliable reference repository that I can use to:

- Understand how a realistic Angular + .NET application is structured.
- Follow a request from the UI through the API to PostgreSQL and back.
- Learn C# and ASP.NET Core by reading working application code.
- Understand EF Core and database design through real examples.
- Compare Signals-based state management with classic NgRx.
- Understand business rules, transactions, and concurrency.
- Run and debug the application locally.
- Read and execute tests.
- Explain architectural decisions in technical interviews.
- Reproduce features independently in a separate project.
- Gradually add more advanced technologies without rebuilding the foundation.

The core application must be understandable and maintainable, not just technically impressive.

---

## 28. Final Reporting Requirements

At the end of a substantial implementation session, provide a concise but evidence-based report containing:

1. What was implemented.
2. Which significant files or modules changed.
3. Which tests, builds, migrations, or verification commands were run.
4. Their actual results.
5. Which requirements are complete and verified.
6. Which requirements are partially implemented or unverified.
7. Which advanced topics remain deferred.
8. Any blockers or known issues.
9. The next task from the persistent backlog.

Do not describe planned work as completed work.

Do not claim that the entire platform is finished merely because the initial phases are implemented.

Use the statuses defined in `REQUIREMENTS_TRACEABILITY.md`.

---

## 29. Working Agreement

Begin by inspecting the repository and identifying its current state.

Then create or update the persistent planning files, establish the implementation backlog, and begin executing the highest-priority eligible tasks.

Do not stop at the planning stage.

Make reasonable engineering decisions autonomously, document important trade-offs, verify your work, and continue through the backlog for as long as the environment and session permit.

Preserve existing work, maintain a usable repository, and keep implementation, tests, architecture decisions, and learning documentation synchronized.

When optional integrations require external accounts, credentials, billable resources, or other explicit user decisions, implement a local alternative where possible and document the remaining work instead of blocking the core application.

**Your primary responsibility is to deliver a working, verified, understandable full-stack reference application first, then progressively expand it into a comprehensive engineering learning platform.**

Begin now: inspect the repository, summarize the initial findings in the persistent project files, create the dependency-aware backlog, and immediately start implementing the highest-priority task. Do not wait for another prompt unless a genuinely blocking decision requires my input.

## AI Agent, Skills, and Rules Architecture

Design and implement a practical, maintainable AI-assisted development environment for this repository using the features supported by the installed Cursor version.

### 1. Repository Instructions

- Create a root `AGENTS.md` containing concise, repository-wide development instructions.
- Document architecture boundaries, coding conventions, testing requirements, security requirements, and verification commands.
- Avoid duplicating large amounts of documentation across instruction files.

### 2. Scoped Rules

Create focused, file-scoped Cursor rules for relevant areas, such as:

- Angular frontend architecture and coding conventions.
- Angular state management: Signals and NgRx.
- ASP.NET Core and C# backend conventions.
- EF Core and PostgreSQL.
- Unit, integration, and end-to-end testing.
- Security and API design.

Use the native rule format supported by the installed Cursor version. Do not create obsolete or unsupported configuration formats.

### 3. Reusable Skills

Identify recurring workflows and create reusable skills where supported. Prioritize:

- Implementing a complete feature across frontend, API, and database.
- Adding or modifying ASP.NET Core endpoints.
- Implementing Angular features with Signals.
- Implementing Angular features with NgRx.
- Creating unit and integration tests.
- Debugging build failures and test failures.
- Reviewing code for architecture, security, and maintainability.
- Updating technical documentation and implementation progress.

Each skill must contain actionable steps, relevant constraints, and verification criteria. Avoid creating skills that merely restate generic instructions.

### 4. Specialized Agents

If the installed Cursor version supports custom subagents, create focused agents for independent responsibilities, such as:

- Angular architecture and frontend implementation.
- .NET backend and API implementation.
- Database and EF Core review.
- Testing and quality assurance.
- Security and architecture review.

Define clear responsibilities, boundaries, and expected outputs. Use agents only when they provide meaningful separation of work. Avoid parallel changes to the same files and require integration verification after delegated work.

### 5. Validation and Documentation

- Verify that every rule, skill, and agent uses a supported format and can actually be invoked.
- Document how to use each reusable skill and agent.
- Provide example prompts for common development workflows.
- Do not claim a capability exists if the installed Cursor version does not support it.
- Prefer a small set of high-value, tested workflows over generating a large number of unused configuration files.

### 6. Learning Objective

The AI-assisted development environment must support learning, not merely code generation. For significant changes, explain the reasoning, relevant alternatives, architectural trade-offs, and verification steps. Keep explanations linked to actual files and code in the repository.

## Mandatory Session Continuity and Progress Tracking

This requirement is mandatory throughout the entire project lifecycle.

### 1. Before Starting Work

- Read `AGENTS.md`, `docs/project/MASTER_PLAN.md`, `docs/project/IMPLEMENTATION_BACKLOG.md`, `docs/project/PROGRESS.md`, and `docs/project/KNOWN_ISSUES.md` when these files exist.
- Inspect the relevant source code and current Git state before making changes.
- Determine the exact next task from the implementation backlog.
- Do not assume that previous work succeeded without checking the current repository state.

### 2. During Implementation

- Update the implementation backlog when tasks are started, completed, deferred, or blocked.
- Update `PROGRESS.md` after each meaningful implementation milestone.
- Record actual verification results, including commands executed and whether they passed or failed.
- Document important architectural decisions and significant deviations from the original specification.
- Keep known issues and unresolved requirements up to date.
- Distinguish implemented, partially implemented, unverified, and blocked functionality.

### 3. Mandatory Session-End Procedure

Before ending a session, reaching a context limit, or stopping work for any reason, update `docs/project/PROGRESS.md` with:

- Overall project status and the current implementation phase.
- Completed work during this session.
- Relevant files and modules created or modified.
- Build, lint, test, and other verification results, including commands and failures.
- Remaining tasks, known defects, and unresolved decisions.
- The exact next task to perform.
- The relevant files to inspect before continuing.
- Any required setup steps, environmental dependencies, or blockers.
- A concise continuation prompt that can be copied into a new Cursor Agent chat.

The continuation prompt must instruct the next session to read the project documentation, verify the repository state, resume from the recorded next task, and continue autonomously without
