# ADR-0002: Frontend state strategy and module boundaries

- **Status:** accepted
- **Date:** 2026-10-18
- **Implementation evidence:** `libs/state/contracts` (abstract `CatalogStore`, `CartStore`, `WishlistStore`),
  `apps/web/eslint.config.mjs` (`no-restricted-imports` for `@shop/state/signals` / `@shop/state/ngrx` outside
  `src/app/state/**`, verified with a probe file), `nx run-many -t lint` passes.

## Context
The application has three kinds of state: server data (catalog, orders), shared client state (cart, wishlist), and
local UI state (form fields, toggles). The master prompt requires both Signals and NgRx variants.

## Problem
Where should each kind of state live, and how do components stay independent of the state library?

## Decision
- **Local UI state:** component `signal()`/`computed()`.
- **Shared feature state (catalog, cart, wishlist):** behind **abstract-class contracts** in `@shop/state/contracts`
  exposing read-only signals and intent methods. Components inject only the contract.
- **Server data used by one page** (orders, admin lists): fetched in the page via typed API clients, no global store.
- **Session/auth:** `AuthSession` service in `@shop/shared/data-access`; tokens never in global state.
- **URL is the source of truth** for catalog filters.
- Boundaries enforced by lint: only `apps/web/src/app/state/**` may import an implementation library.

## Alternatives considered
- Everything in NgRx — heavy for local/page state.
- Components inject the concrete store — couples UI to one library and makes the dual implementation impossible.
- Injection tokens instead of abstract classes — workable, but abstract classes give a type and a token in one.

## Consequences
Components are library-agnostic; a shared contract test suite can run against every implementation.

## Trade-offs
An extra abstraction layer; contracts must stay minimal to remain implementable by both libraries.

## Security and operational implications
Contracts expose no credentials; access token lives only inside `AuthSession` memory.

## Revisit when
The dual-implementation requirement is dropped — then the contract layer could be collapsed.

See also: [`04-signals-vs-rxjs-vs-ngrx.md`](../engineering-decisions/04-signals-vs-rxjs-vs-ngrx.md),
[`05-angular-dependency-injection-and-facades.md`](../engineering-decisions/05-angular-dependency-injection-and-facades.md).
