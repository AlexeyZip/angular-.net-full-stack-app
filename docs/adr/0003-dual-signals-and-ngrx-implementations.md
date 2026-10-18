# ADR-0003: Dual Signals / NgRx implementations selected at build time

- **Status:** accepted
- **Date:** 2026-10-18
- **Implementation evidence:** `libs/state/signals`, `libs/state/ngrx`, `apps/web/src/app/state/state.providers.ts`
  (Signals) and `state.providers.ngrx.ts`, `fileReplacements` in `apps/web/project.json` (`production-ngrx`,
  `development-ngrx`). Both production builds pass; the Signals bundle contains no `@ngrx/store` code (checked by
  grep, also a CI step). Shared contract suite `libs/state/contracts/src/testing/state-contract-suite.ts` runs against
  both. Verified against the real backend (spec 7.4): Playwright `signals` 23/23 and `ngrx` 23/23, on the dev servers
and through nginx with production builds.

## Context
The project must demonstrate both a Signals-based and a classic NgRx (actions/reducers/effects/selectors) approach for
the same features, without both being active at once.

## Problem
How to switch the implementation without runtime flags and without shipping both libraries.

## Decision
Two provider files export the same function name `provideAppState()`. The default configuration imports the Signals
providers; the `*-ngrx` configurations replace that one file with the NgRx providers via Angular `fileReplacements`.
Each provider registers its concrete store and binds the contract with `useExisting`. The footer shows the active
variant (`STATE_VARIANT`).

## Alternatives considered
- Runtime switch (query string / env flag) — both libraries in the bundle, risk of both being active.
- Two separate apps — duplicated pages and routes.
- Environment files — same mechanism, but an explicit provider file keeps the replacement narrow.

## Consequences
Exactly one implementation per build; tree-shaking removes the other; E2E runs once per variant (ports 4200/4300).

## Trade-offs
Two builds in CI; every contract change needs two implementations.

## Security and operational implications
None beyond normal builds; neither store holds credentials.

## Revisit when
The learning comparison is complete — keep one variant and delete the other library.
