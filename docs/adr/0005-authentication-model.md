# ADR-0005: JWT in memory + rotating HttpOnly refresh cookie

- **Status:** accepted
- **Date:** 2026-10-18
- **Implementation evidence:** `Features/Auth/*`, `Infrastructure/Auth/AuthOptions.cs`, `Program.cs` (JWT bearer with
  pinned algorithm), `libs/shared/data-access/src/lib/auth/*`; frontend unit tests `auth-session.spec.ts`,
  `auth.interceptor.spec.ts` pass; API integration tests in `AuthApiTests.cs` pass; E2E covers sign-in and session
  restore after reload in both variants.

## Context
SPA + API on the same origin (dev proxy / nginx), customer and admin roles, no external identity provider allowed
without cost/approval.

## Problem
How to authenticate the SPA without exposing long-lived credentials to JavaScript.

## Decision
- **Access token:** JWT (HS256, 15 minutes, `sub`, `role`, issuer/audience validated), kept only in `AuthSession`
  memory and attached by an interceptor.
- **Refresh token:** 32 random bytes, stored as SHA-256 hash, 7 days, sent as cookie `shop_refresh`
  (`HttpOnly`, `SameSite=Strict`, `Path=/api/auth`, `Secure` outside local dev). Rotated on every refresh;
  reusing a rotated token revokes all of the user's sessions.
- **CSRF:** refresh/logout additionally require the `X-Shop-Client` header.
- **Passwords:** ASP.NET Core `PasswordHasher` (PBKDF2); policy ≥ 8 chars with letters and digits (backend and form).
- **Authorization:** `AdminPolicy` on admin controllers; ownership enforced in queries (other users' orders → 404).
- Concurrent 401s share a single in-flight refresh.

## Alternatives considered
- Tokens in `localStorage` — readable by any XSS.
- Pure cookie session (ASP.NET Core cookie auth) — simpler and valid for same-origin; JWT chosen to teach bearer
  tokens and claims, recorded as a conscious learning choice.
- External IdP (Entra ID, Auth0, Keycloak) — MFA, federation; out of scope (cost/infra).

## Consequences
Page reload restores the session via the cookie; XSS cannot read the refresh token.

## Trade-offs
Access tokens cannot be revoked before expiry (KI-14); two dev servers share the cookie (KI-12).

## Security and operational implications
Signing key from configuration/secrets; startup fails without it outside Development (verified).

## Revisit when
Real users or MFA requirements → external IdP with OIDC (BFF pattern).
