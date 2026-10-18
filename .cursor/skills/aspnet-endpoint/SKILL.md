---
name: aspnet-endpoint
description: Adds or modifies an ASP.NET Core endpoint in Shop.Api following the Features/<Module> layout, ProblemDetails error codes, authorization policies and integration testing against PostgreSQL. Use when creating, changing or reviewing API routes, controllers, request/response contracts or service methods.
---

# ASP.NET Core endpoint

## Steps

1. **Contract** in `Features/<Module>/<Module>Contracts.cs`: `public sealed record XxxRequest(...)` with
   DataAnnotations (`[property: Required, MaxLength(..)]`); response DTO record. Never expose entities.
2. **Service** method in `Features/<Module>/<Module>Service.cs` (sealed class, primary constructor, scoped):
   - take the user id as a parameter (from the token), plus `CancellationToken`;
   - reads: `AsNoTracking()` + `Select` projection; owner filter inside the query;
   - writes: domain methods enforce invariants; concurrent counters via `ExecuteUpdateAsync`;
   - failures: `throw AppException.NotFound/Conflict/BusinessRule(code, message)` with a new snake_case `code`;
   - admin writes: `audit.Record(...)` before `SaveChangesAsync`.
3. **Controller** action: route attribute, `[Authorize]` or `[Authorize(Policy = ShopClaims.AdminPolicy)]`,
   `[ProducesResponseType<T>(...)]`, `CreatedAtAction` for creates, rate-limit attribute for abuse-prone actions.
4. **Register** the service in `Program.cs` if it is new (`AddScoped`).
5. **Tests** in `tests/Shop.Api.IntegrationTests/<Module>ApiTests.cs` using `ApiFixture` helpers: happy path, validation
   (400), auth (401/403/404 for other users' data), business rule (409/422) and that nothing changed after a failure.
   Pure rules → `tests/Shop.Api.UnitTests`.
6. **Client**: add the method to `libs/shared/data-access/src/lib/api-clients.ts`, model to `models.ts`; map new error
   codes in the UI by `code`.
7. **Docs**: `docs/engineering-decisions/19-api-design-and-error-handling.md` if a new convention appears.

## Checklist before done

- [ ] No client-supplied price/total/role/user id is trusted
- [ ] Every failure path returns ProblemDetails with `code` (check with an integration test)
- [ ] `dotnet build Shop.sln` has 0 warnings; unit + integration tests run (or blocker recorded)
- [ ] Scalar UI (`/scalar`, Development) shows the endpoint with the right response types
