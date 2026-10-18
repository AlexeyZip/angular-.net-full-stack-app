# Official documentation links — verification status

All external links in `docs/learning/`, `docs/adr/` and `docs/engineering-decisions/` point to vendor or standards
sites (angular.dev, rxjs.dev, ngrx.io, learn.microsoft.com, postgresql.org, npgsql.org, developer.mozilla.org,
typescriptlang.org, rfc-editor.org, owasp.org, docs.docker.com, docs.github.com, playwright.dev, vitest.dev,
nx.dev, opentelemetry.io, dotnet.testcontainers.org).

**Status: NOT VERIFIED.** The links were written from knowledge of these sites' URL structure; an automated
reachability check was not run in the authoring session (outbound requests to many URLs were not performed). Vendors
occasionally move pages, so treat a broken link as "search the vendor site for the page title", not as wrong content.

## How to verify

```powershell
# from the repository root; lists every external link with its HTTP status
foreach ($url in rg -o --no-filename "https://[^\s\)\`>]+" docs | Sort-Object -Unique) {
  try { "{0} {1}" -f (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 20).StatusCode, $url }
  catch { "FAIL $url" }
}
```

Or add a link-checker step (for example [lychee](https://github.com/lycheeverse/lychee)) to CI — backlog item DOC-06.
After a successful run, change the status above to `VERIFIED <date>` and fix any failures.
