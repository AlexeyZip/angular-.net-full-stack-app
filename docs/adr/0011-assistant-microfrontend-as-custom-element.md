# ADR-0011: Assistant microfrontend as a runtime-loaded custom element in a side panel

- **Status:** accepted
- **Date:** 2026-10-18
- **Implementation evidence:** `apps/assistant-mfe` (Angular Elements, `type:remote`), host loader and panel in
  `apps/web/src/app/features/assistant/`, proxies in `apps/web/proxy.conf.json` and `apps/web/nginx.conf`, compose
  service `assistant-mfe`. Executed on 2026-10-18: widget unit tests 9/9, host unit tests (web 28/28), lint, production
  builds, Playwright `assistant.spec.ts` 4/4 (both state variants), manual check through nginx on :8080.

## Context
The shop is one Angular application (decision 03, ADR-0002). The master prompt asks for an optional microfrontend
example. The AI assistant is optional for the shop, changes more often than the shop (prompt/UI iterations), and
needs only a tiny contract with the host.

## Problem
How to ship the assistant UI as an independently built and deployed part without coupling the shop's build,
dependencies or availability to it — and how to present it to users.

## Decision
- The remote is an **Angular Elements custom element** `<shop-assistant>` with Shadow DOM, built by its own Nx
  project and served by its own container. Public contract: attributes `api-base`, `compact`; DOM event
  `productSelected` (slug). It keeps its own copy of the API types and may not import workspace libraries (lint).
- The host loads `/mfe/assistant/main.js` **at runtime** (`RemoteElementLoader`) from its own origin through a
  proxy, waits for `customElements.whenDefined` with a timeout, and shows a recoverable error if loading fails.
- The UI is an **overlay side panel** available on every page, opened from the header: deferred until first use,
  hidden (not destroyed) when closed so the conversation survives navigation, slides in with a transform/opacity
  transition, does not change the page layout.
- The host validates every event payload from the remote before acting on it.

## Alternatives considered
- **Plain component inside `apps/web`** — simplest and fastest; rejected only because the requirement asked for a
  microfrontend example. It remains the right choice for a single team.
- **Module/Native Federation** — shares Angular between host and remote (smaller download) but couples their
  versions and builds and needs shared-dependency configuration; overkill for one widget.
- **iframe** — strongest isolation, but sizing, focus management, theming and communication (`postMessage`) are
  clumsy, and it does not blend into the page.
- **Dedicated `/assistant` route** (first version) — the user had to leave the page they were browsing; replaced by
  the panel.
- **Panel that pushes the page on wide screens** — shifted the layout on open; replaced by an overlay.

## Consequences
- The shop works when the remote is down (E2E "the shop keeps working when the microfrontend cannot be loaded").
- The remote can be redeployed alone; `main.js` is served with `no-cache`, chunks are hashed and immutable.
- Two Angular runtimes are on the page after the panel opens (KI-17).

## Trade-offs
Duplicate framework download; a hand-versioned DOM contract; a second build, image and dev server (port 4400).

## Security and operational implications
Same-origin loading keeps CSP `script-src 'self'`; the endpoint is anonymous so the remote never handles tokens;
event payloads are validated; nginx resolves the remote per request so a missing container only breaks
`/mfe/assistant/`.

## Revisit when
Several teams own large UI areas (then federation for those areas), or the duplicated runtime becomes a measured
performance problem (then fold the widget back into the shop as a lazy component).
