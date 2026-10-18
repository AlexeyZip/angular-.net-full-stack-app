---
name: interview-prep
description: Prepares technical interview explanations, questions and model answers grounded in the NorthwindShop codebase (Angular, Signals, RxJS, NgRx, C#, ASP.NET Core, EF Core, PostgreSQL, security, testing, architecture). Use when the user wants to practise interviews, explain a design decision, or asks "how would I explain X".
---

# Interview preparation from this codebase

1. Identify the topic and find its implementation (`rg`), the engineering decision doc and the learning topic in
   `docs/learning/`.
2. Build the answer in this shape (2–3 minutes spoken):
   - **Problem** in one sentence ("two buyers, one unit left").
   - **What we did**, pointing at real code (file + 5–15 lines).
   - **Why** — the alternatives and why they lost here.
   - **Trade-offs / when I'd choose differently.**
   - **How it is tested** (test name).
3. Add 3–5 follow-up questions an interviewer would ask, with short model answers.
4. Offer a practice mode: ask one question at a time, wait for the user's answer, then give specific feedback
   (missing points, inaccuracies, a stronger phrasing).

## Strong topics in this repo

| Topic | Code | Doc |
| --- | --- | --- |
| Overselling prevention | `CheckoutService.cs` conditional UPDATE | `08-database-transactions-and-concurrency.md` |
| Idempotent checkout | `Idempotency-Key`, fingerprint, unique index | `08`, `21` |
| Signals vs NgRx | `libs/state/*` same contract, two implementations | `04-signals-vs-rxjs-vs-ngrx.md` |
| Token storage and refresh | `auth-session.ts`, `auth.interceptor.ts`, `AuthService.cs` | `11-authentication-and-authorization.md` |
| Optimistic concurrency | `Product.Version` vs `xmin` | `08`, ADR-0007 |
| switchMap races | catalog store, cart quote | `04`, `docs/learning/rxjs.md` |

Answers must match the code; if the repository does not implement something, say so and describe how it would.
