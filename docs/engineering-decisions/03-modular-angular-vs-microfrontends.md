# 03 — Modular Angular vs microfrontends

## 1. Problem
Structure the frontend so features are isolated, bundles stay small, and storefront and admin can evolve — without
operational overhead.

## 2. Context
One team; storefront and admin share auth, API models and UI components; Nx is available.

## 3. Options
(a) One app, lazy feature routes, Nx libraries with enforced boundaries; (b) two separate Angular apps (shop, admin);
(c) microfrontends via Module/Native Federation.

## 4. Chosen approach
One application (`apps/web`) with lazy routes (every page `loadComponent`, admin `loadChildren` behind `canMatch`),
plus libraries tagged by type: `type:ui`, `type:data-access`, `type:state-contracts`, `type:state-impl`.
`@nx/enforce-module-boundaries` encodes the allowed dependency directions.

## 5. Why
Lazy routes already give per-feature code splitting (the admin code is never downloaded by customers who are not
admins: `canMatch` prevents the route from even matching). Boundaries are enforced by lint rather than by separate
deployments.

## 6. Trade-offs
Storefront and admin release together; a breaking change in a shared library affects both at once.

## 7. Simpler alternative
A single app without libraries — fine at first, but the dual state-management requirement needs real seams (contracts
vs implementations), which libraries provide.

## 8. Rejected
Microfrontends: runtime dependency sharing, version skew, duplicated auth bootstrapping and a host/remote deployment
matrix — all cost, no benefit for one team. Separate admin app: duplicated shell/auth with little gain.

## 9. References
`apps/web/src/app/app.routes.ts`, `features/admin/admin.routes.ts`, `eslint.config.mjs` (depConstraints),
`libs/*/project.json` (tags).

## 10. Code
```ts
// app.routes.ts
{ path: 'admin', canMatch: [adminGuard], loadChildren: () => import('./features/admin/admin.routes').then((m) => m.adminRoutes) },
```

## 11. Failure scenarios
Lint is the guard: an illegal import fails `nx lint`. Without CI the rule could be skipped locally.

## 12. Testing
Libraries have their own Vitest projects; the app test only checks the shell.

## 13. Performance
Initial bundle (Signals) 396 kB raw / ~106 kB transferred; feature pages are separate lazy chunks.

## 14. When microfrontends are better
Multiple teams owning distinct product areas with independent deploys, or integrating apps built with different
frameworks. A migration would start by turning `features/admin` into a remote with Native Federation.

## 15. Interview explanation
"One Angular app with lazy routes and Nx libraries whose dependency rules are lint-enforced. Microfrontends solve an
organizational problem — independent teams and deploys — that this project doesn't have."

## 16. Evidence
Builds and lint verified. Microfrontends: design only.
