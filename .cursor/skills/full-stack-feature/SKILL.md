---
name: full-stack-feature
description: Implements a spec-driven vertical slice across PostgreSQL/EF Core, the ASP.NET Core API, the Angular data-access layer, both state variants and the UI, with tests and docs. Use when adding or changing a user-visible feature that touches more than one layer of NorthwindShop.
---

# Full-stack feature (vertical slice)

## 1. Specify first

Write down, before coding (in the backlog task or the chat):

- user story and **acceptance criteria** (observable behaviour, including failure paths);
- business rules and who is authoritative (server for money, stock, identity);
- API shape: method, route, request/response records, error `code`s and status codes;
- affected state (which contract: `CatalogStore`, `CartStore`, `WishlistStore`, or component-local);
- tests that will prove each criterion.

Add/adjust the task in `docs/project/IMPLEMENTATION_BACKLOG.md` (status `IN_PROGRESS`).

## 2. Implement in dependency order

```
Task Progress:
- [ ] Domain: entity invariants in services/api/src/Shop.Api/Domain/
- [ ] Persistence: EntityConfigurations.cs + migration (see ef-migration skill)
- [ ] API: Features/<Module>/ contracts, service, controller (see aspnet-endpoint skill)
- [ ] Backend tests: unit (pure rules) + integration (HTTP against real PostgreSQL)
- [ ] Data access: models.ts + api-clients.ts in libs/shared/data-access
- [ ] State: contract + BOTH implementations + contract suite (see state-feature skill) — only if shared state
- [ ] UI: page/component in apps/web/src/app/features/<area>/ with loading, empty, error states
- [ ] Frontend unit tests; E2E scenario in apps/web-e2e/src if it is a user journey
- [ ] Docs: engineering decision / ADR if a decision was made; tracking files
```

## 3. Verify

```powershell
cd services/api; dotnet build Shop.sln; dotnet test --project tests/Shop.Api.UnitTests
dotnet test --project tests/Shop.Api.IntegrationTests      # needs Docker or SHOP_TEST_CONNECTION_STRING
dotnet ef migrations has-pending-model-changes --project src/Shop.Api; cd ../..
npx nx run-many -t lint test
npx nx run web:build:production; npx nx run web:build:production-ngrx
npx nx e2e web-e2e                                           # needs PostgreSQL
```

Record every command and its real result in `docs/project/PROGRESS.md`. If something cannot run, say so and add
or update an entry in `KNOWN_ISSUES.md`; set traceability to `IMPLEMENTED_NOT_FULLY_VERIFIED`, not "verified".

## Reference slice to copy

Checkout is the most complete example: `checkout-page.ts` → `OrdersApi.placeOrder` (`api-clients.ts`) →
`OrdersController.Checkout` → `CheckoutService` → `Pricing` / `PaymentSimulator` → migration constraints →
`CheckoutApiTests.cs` → `apps/web-e2e/src/cart-checkout.spec.ts` → `docs/engineering-decisions/08-*.md`.
