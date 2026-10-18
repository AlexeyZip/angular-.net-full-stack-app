# 15 — Cloud and Azure architecture (design only)

**Status: DESIGN_ONLY.** No cloud resources exist and none were created; provisioning requires explicit approval.

## 1. Problem
Describe how this system would run in Azure with managed services, secure configuration and observability.

## 2. Context
Containers already exist (`services/api/Dockerfile`, `apps/web/Dockerfile`); stateless API; PostgreSQL.

## 3. Options
Azure App Service (containers); **Azure Container Apps**; AKS; static web hosting for the SPA.

## 4. Proposed target
```text
Azure Front Door (WAF, TLS) ─┬─► Static Web Apps / Storage static site  (Angular build, one variant)
                             └─► Container Apps: shop-api (min 1, scale on HTTP)  ── Managed Identity ──► Key Vault (signing key)
                                        │                                              
                                        └─► Azure Database for PostgreSQL Flexible Server (private endpoint, zone-redundant HA optional)
Application Insights + Log Analytics (OpenTelemetry exporter, A-01)
```
- Same-origin routing via Front Door (`/api/*` → API) preserves the SameSite=Strict refresh cookie design.
- Secrets: `Auth__SigningKey` from Key Vault references; DB auth via Entra ID managed identity instead of passwords.
- Migrations: run as a one-off job (`dotnet ef migrations bundle`) in the release pipeline, never on app start
  (`Database:ApplyMigrationsOnStartup` is `false` outside Development already).

## 5. Why Container Apps
Runs the existing images, scales to zero/up on HTTP, built-in revisions for blue/green, less ops than AKS.

## 6. Trade-offs
Cold starts if scaled to zero (keep min replicas 1); Front Door + private networking adds cost.

## 7. Simpler alternative
Single App Service plan hosting the API container and serving the SPA from the same container via nginx.

## 8. Rejected
AKS — operational burden without a cluster-level need.

## 9. Future references
`infra/bicep/main.bicep` (not created), GitHub Actions deploy job with OIDC federation (no stored cloud secrets).

## 10. Bicep sketch
```bicep
resource api 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'shop-api'
  properties: {
    configuration: { ingress: { external: false, targetPort: 8080 }, secrets: [ { name: 'signing-key', keyVaultUrl: kvSecretUri, identity: 'system' } ] }
    template: { containers: [ { name: 'api', image: apiImage, env: [ { name: 'Auth__SigningKey', secretRef: 'signing-key' } ] } ] }
  }
}
```

## 11. Failure scenarios
Region outage → single-region design is down (accepted); DB failover with zone-redundant HA ≈ 60–120 s per Azure docs.

## 12. Testing
`az bicep build` / `what-if` in CI (no deployment) — backlog A-06.

## 13. Security
Private endpoints for PostgreSQL, managed identities, Key Vault, WAF, HTTPS only (`RefreshCookieSecure=true`).

## 14. When different
Kubernetes skills/platform already exist → AKS; very low traffic → App Service.

## 15. Interview explanation
"Containers on Azure Container Apps behind Front Door for same-origin routing, PostgreSQL Flexible Server on a private
endpoint, secrets in Key Vault via managed identity, migrations as a pipeline step, telemetry to Application Insights."

## 16. Evidence
Design only; no Azure resources were created or validated.
