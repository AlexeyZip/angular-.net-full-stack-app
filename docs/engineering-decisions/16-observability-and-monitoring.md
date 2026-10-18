# 16 — Observability and monitoring

**Status: PARTIALLY_IMPLEMENTED** — structured logs, correlation ids, health checks exist; metrics/tracing export
(OpenTelemetry) is backlog A-01.

## 1. Problem
When a customer reports "checkout failed", find the exact request, its error and its database work.

## 2. Context
Local-first; no APM service; must not log secrets or personal data unnecessarily.

## 3. Options
Plain text logs; **structured JSON logs + trace id in every error**; OpenTelemetry traces/metrics/logs to a backend.

## 4. Chosen approach (implemented)
- **Structured logging:** `appsettings.json` → JSON console formatter with scopes and UTC timestamps (Development uses
  the simple formatter for readability). Message templates with named properties:
  `logger.LogInformation("Order {OrderNumber} placed by {UserId}, total {Total}", ...)`.
- **Correlation:** every ProblemDetails includes `traceId` (`Activity.Current?.Id`), so a user-visible error links to
  the log line.
- **Health checks:** `/health/live` (process) and `/health/ready` (includes the EF Core `DbContext` check) — used by the
  compose health check and Playwright's web-server readiness.
- **Security signals logged:** refresh-token reuse (`LogWarning`), failed requests with status and code.
- **Frontend:** `provideBrowserGlobalErrorListeners()`; errors surface as user-visible states, not swallowed.

## 5. Why
Cheap, already effective locally and in containers (stdout is the 12-factor log stream).

## 6. Trade-offs
No metrics (request rate, latency percentiles, checkout failures by code) and no distributed traces yet.

## 7. Simpler alternative
Text logs only — insufficient for querying by property.

## 8. Rejected (for now)
Vendor SDKs (lock-in) — OpenTelemetry is the planned standard.

## 9. References
`Program.cs` (ProblemDetails `traceId`, health checks), `appsettings*.json`, `AppExceptionHandler.cs`,
`CheckoutService.cs`, `AuthService.cs`.

## 10. Planned code (A-01)
```csharp
builder.Services.AddOpenTelemetry()
    .WithTracing(t => t.AddAspNetCoreInstrumentation().AddHttpClientInstrumentation().AddNpgsql().AddOtlpExporter())
    .WithMetrics(m => m.AddAspNetCoreInstrumentation().AddRuntimeInstrumentation().AddMeter("Shop.Checkout").AddOtlpExporter());
// custom metric: checkout outcomes by code (paid / insufficient_stock / payment_declined)
```

## 11. Failure scenarios
DB unavailable → readiness fails, liveness stays healthy (no restart loop for a dependency outage).

## 12. Testing
Health endpoints are exercised by the E2E web-server config and compose health checks (not yet run).

## 13. Security
Do not log tokens, passwords or full request bodies; user ids are logged, emails are not in checkout logs.

## 14. When to go further
Multiple instances/services → OpenTelemetry + a backend (Grafana/Tempo/Loki, Azure Monitor); SLOs and alerts on
checkout error rate and p95 latency.

## 15. Interview explanation
"Structured JSON logs with message templates, a trace id in every error response so support can find the log line,
and separate liveness and readiness probes. Next step is OpenTelemetry traces and a checkout-outcome metric."

## 16. Evidence
Observed against the running API: JSON log lines with scopes and `TraceId` (integration-test output and the compose
`api` container), `traceId` in ProblemDetails, `/health/ready` used by the compose health check and Playwright
(`Healthy` through nginx). Metrics/tracing export: not implemented (A-01).
