# ADR-0006: ProblemDetails with stable error codes

- **Status:** accepted
- **Date:** 2026-10-18
- **Implementation evidence:** `Infrastructure/ErrorHandling/AppException.cs`, `AppExceptionHandler.cs`,
  `Program.cs` (`AddProblemDetails` adds `traceId`), frontend `libs/shared/data-access/src/lib/api-error.ts`
  (`api-error.spec.ts` passes).

## Context
The UI must react differently to "out of stock", "payment declined", "version conflict" and validation errors, and
support must correlate an error with logs.

## Problem
One error format for all endpoints that the client can branch on safely.

## Decision
RFC 9457 ProblemDetails for every error, extended with a machine-readable `code` (e.g. `insufficient_stock`,
`payment_declined`, `concurrency_conflict`, `invalid_status_transition`) and `traceId`. Business failures throw
`AppException` (factories `NotFound`/`Conflict`/`BusinessRule`/`Unauthorized`); an `IExceptionHandler` maps them, maps
`DbUpdateConcurrencyException` to 409, client cancellation to 499 (logged as information), and anything else to a
generic 500 without internals. Validation errors use `ValidationProblemDetails` (400). The frontend converts every
`HttpErrorResponse` into a typed `ApiError` and switches on `code`, never on message text.

## Alternatives considered
- Custom envelope `{ success, error }` — non-standard, duplicates HTTP status.
- `Result<T>` everywhere instead of exceptions — explicit, but noisy for this size; exceptions are confined to
  expected business outcomes.

## Consequences
Consistent client handling; messages can change without breaking the UI.

## Trade-offs
Codes are a public contract and must be versioned with care.

## Security and operational implications
No stack traces or SQL in responses; `traceId` links responses to structured logs.

## Revisit when
Public API consumers appear (publish the code catalogue in OpenAPI).

See also: [`19-api-design-and-error-handling.md`](../engineering-decisions/19-api-design-and-error-handling.md).
