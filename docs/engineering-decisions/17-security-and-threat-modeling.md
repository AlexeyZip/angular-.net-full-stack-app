# 17 — Security and threat modelling

## 1. Problem
Identify what an attacker would try against a shop and show which control stops each attempt.

## 2. Context
Public storefront, authenticated customers, privileged admins, money and inventory, browser-based client.

## 3. Method
STRIDE over the main flows (sign-in, checkout, admin), then controls mapped to code and tests.

## 4. Threats and controls

| Threat (STRIDE) | Example attack | Control | Where | Test |
| --- | --- | --- | --- | --- |
| Spoofing | credential stuffing | rate limit (auth), generic errors, PBKDF2 hashes | `RateLimitPolicies.cs`, `AuthService.cs` | `Wrong_password_and_unknown_email_get_the_same_error` |
| Spoofing | stolen refresh token replayed | rotation + reuse detection revokes all sessions | `AuthService.RefreshAsync` | `Refresh_rotates_the_token_and_reuse_revokes_the_session` |
| Tampering | client sends price 0.01 | server ignores client prices; `Pricing.Calculate` | `CheckoutService.cs` | `Client_supplied_prices_are_ignored` |
| Tampering | forged JWT / role claim | HS256 signature, issuer/audience validation, `ValidAlgorithms` pinned | `Program.cs` | `Tampered_token_is_rejected` |
| Tampering | user-editable `localStorage` cart | strict validation on read, server re-validation | `cart-persistence.ts` | `cart-persistence.spec.ts` |
| Repudiation | admin denies a price change | audit log with actor, before/after | `AuditLogger.cs` | `Admin_can_create_and_update_a_product_with_audit_records` |
| Information disclosure | read another customer's order | owner filter in query → 404 | `OrderQueries.cs` | `Customers_cannot_see_other_customers_orders` |
| Information disclosure | XSS steals tokens | access token memory-only; refresh HttpOnly; Angular escaping; no `innerHTML`; CSP in nginx | `auth-session.ts`, `nginx.conf` | `auth-session.spec.ts` |
| Information disclosure | stack traces in errors | ProblemDetails without internals | `AppExceptionHandler.cs` | integration suites |
| Denial of service | checkout/auth flooding | per-IP/user rate limits; page size limits | `RateLimitPolicies.cs`, `[Range]` | — |
| Denial of service | LIKE pattern abuse (`%%%_`) | wildcards escaped | `CatalogService.EscapeLikePattern` | `Like_wildcards_in_search_are_escaped` |
| Elevation of privilege | customer calls `/api/admin/*` | `AdminPolicy` on the controller | `AdminController.cs` | `Customers_cannot_call_admin_endpoints`, E2E journey 13 |
| CSRF | cross-site POST to `/api/auth/refresh` | `SameSite=Strict` + required `X-Shop-Client` header | `AuthController.cs` | `Refresh_requires_the_csrf_header` |
| Open redirect | `/login?returnUrl=//evil.example` | `safeReturnUrl` | `validators.ts` | `validators.spec.ts` |
| Supply chain | vulnerable dependencies | `npm audit` (prod deps clean), lockfiles, pinned SDK | KI-03 | — |
| Secrets | signing key committed | only `DEV-ONLY-` placeholders; startup fails without a key outside Development | `AuthOptions.cs` | verified by running in Production mode |

## 5–8. Why / trade-offs / alternatives
Defence in depth with controls close to the data (DB constraints, owner filters) rather than relying on UI guards.
Trade-offs: in-memory rate limits per instance (KI-13), non-revocable access tokens for 15 min (KI-14). An external
IdP with MFA would strengthen authentication (22).

## 9. References
See the table; plus `.cursor/rules/security-and-api.mdc` for the rules applied to new code.

## 10. Code — CSRF and cookie
```csharp
// AuthController.cs
HttpOnly = true, SameSite = SameSiteMode.Strict, Path = "/api/auth", Secure = options.RefreshCookieSecure
...
if (!Request.Headers.ContainsKey(CsrfHeaderName))
    throw new AppException(StatusCodes.Status400BadRequest, "csrf_header_missing", $"The {CsrfHeaderName} header is required.");
```

## 11. Residual risks
Payment captured before commit (simulator only, KI-10); no MFA; no account lockout beyond rate limiting;
dev-tool vulnerabilities (KI-03). The CSP was verified in the browser: the whole E2E suite passes through nginx with
the policy active. That run also exposed that nginx dropped the security headers on HTML and assets (a location-level
`add_header` cancels inherited ones) — fixed with `apps/web/nginx-security-headers.conf` included in every block.

## 12. Testing
Security behaviours are part of the normal suites (see the Test column), not a separate manual checklist.

## 13. Operational security
HTTPS required outside development (`RefreshCookieSecure=true` by default), secrets via environment/Key Vault, API not
exposed directly behind the proxy in compose.

## 14. When to go further
Real payments (PCI DSS scope), personal data at scale (GDPR: export/delete), multiple admins (least-privilege roles).

## 15. Interview explanation
"I threat-modelled with STRIDE: prices are server-side, tokens can't be read by scripts, refresh tokens rotate with
reuse detection, CSRF is blocked by SameSite plus a custom header, ownership is enforced inside queries, and admin
endpoints use a policy — each control has a test."

## 16. Evidence
Unit-level controls verified; HTTP-level controls (401/403, ownership 404, server-side pricing, refresh rotation) by
integration tests 40/40 and E2E journey 13; security headers checked with `curl` through nginx. Rate limiting is
configured but not covered by a test.
