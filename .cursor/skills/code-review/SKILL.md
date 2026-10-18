---
name: code-review
description: Reviews NorthwindShop changes for correctness, architecture boundaries, security, data integrity, test adequacy and maintainability, producing prioritized findings. Use when reviewing a diff, a pull request, a branch, or when the user asks for a code or security review.
---

# Code and security review

## Gather

`git status`, `git diff` (or the PR diff). Read the touched files fully and the engineering decision for the area.

## Check, in this order

1. **Correctness:** edge cases (empty, max, concurrent, retried), error paths, cancellation, time zones (`TimeProvider`).
2. **Data integrity:** server-side prices/totals/stock; atomic updates or transactions where invariants span rows;
   idempotency for retryable writes; DB constraints mirror domain rules; migration SQL is safe.
3. **Security:** authorization on every endpoint and owner filtering in queries; no tokens/PII in state or storage;
   no secrets; input validation; no open redirects (`safeReturnUrl`); no `innerHTML`; rate limits on abuse-prone
   actions; generic auth errors; ProblemDetails do not leak internals.
4. **Architecture:** features use state contracts, not implementations; both state variants changed together; UI
   library stays presentational; no new abstraction without a second use; no unrelated refactors.
5. **Tests:** each behaviour and failure path is tested at the right level; both state variants covered; tests would
   fail without the change.
6. **Maintainability:** naming, comment quality (why, not what), dead code, consistency with neighbours.
7. **Docs/tracking:** decisions/ADRs updated, `PROGRESS.md`/traceability honest.

## Output

```markdown
## Summary
<one paragraph: what changed, overall risk>

## Findings
- 🔴 Critical — <file:line> <problem> → <concrete fix>
- 🟡 Should fix — ...
- 🟢 Suggestion — ...

## Verification performed
<commands actually run and results; what was not run and why>
```

Report only real, specific findings; say explicitly when an area looks correct.
