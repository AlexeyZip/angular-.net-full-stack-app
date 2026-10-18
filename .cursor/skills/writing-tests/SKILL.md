---
name: writing-tests
description: Chooses the right test level and writes behaviour-focused unit, integration or Playwright tests for NorthwindShop, including failure paths and concurrency cases. Use when adding tests, when the user asks for test coverage, or when a change lacks verification.
---

# Writing tests

## Choose the level

| What you are proving | Level | Location |
| --- | --- | --- |
| Pure rule (pricing, state machine, validation helper) | unit | `services/api/tests/Shop.Api.UnitTests`, `*.spec.ts` next to the code |
| Shared state behaviour | contract suite (runs for both variants) | `libs/state/contracts/src/testing/state-contract-suite.ts` |
| NgRx reducer / selector | unit | `libs/state/ngrx/src/lib/**/*.feature.spec.ts` |
| HTTP contract, auth, SQL, transactions, concurrency | integration (real PostgreSQL) | `services/api/tests/Shop.Api.IntegrationTests` |
| A user journey across UI + API + DB | E2E (both variants) | `apps/web-e2e/src/*.spec.ts` |

Prefer the lowest level that can fail for the right reason. Do not mock EF Core or PostgreSQL.

## Every behaviour gets

1. the happy path;
2. at least one failure path (invalid input, unauthorized, conflict, dependency failure);
3. a "nothing changed" assertion after failures that must be atomic (stock, order count);
4. for concurrency: run the competing operations in parallel (`Task.WhenAll`) and assert the invariant.

## Templates

```csharp
[Fact]
public async Task Concurrent_buyers_cannot_oversell_the_last_units()
{
    // Arrange via API helpers, Act with Task.WhenAll, Assert on HTTP status counts AND database state.
}
```

```ts
test('failure path: a declined payment keeps the cart and explains what happened', async ({ page, customer, adminApi }) => {
  const product = await adminApi.createProduct({ stock: 5 });   // arrange through the API, unique data
  // act through the UI with role/label selectors; assert visible outcome
});
```

## Run

```powershell
npx nx test <project>                                    # e.g. state-ngrx, web, shared-data-access
cd services/api; dotnet test --project tests/Shop.Api.UnitTests
dotnet test --project tests/Shop.Api.IntegrationTests    # Docker or SHOP_TEST_CONNECTION_STRING
npx nx e2e web-e2e                                       # PostgreSQL required
```

A test that has never failed proves little: when practical, break the code briefly and watch it fail.
