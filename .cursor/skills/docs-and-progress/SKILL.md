---
name: docs-and-progress
description: Updates NorthwindShop project tracking files, engineering decision documents and Architecture Decision Records so they match the code and real verification results. Use after implementing or changing a feature, when ending a session, when a decision was made, or when the user asks to update docs, progress, backlog or ADRs.
---

# Documentation and progress updates

## After every meaningful milestone

1. `docs/project/PROGRESS.md` — what changed (files), commands run **with actual results**, decisions, limitations,
   the exact next task, and a refreshed continuation prompt at session end.
2. `docs/project/IMPLEMENTATION_BACKLOG.md` — status (`TODO/IN_PROGRESS/BLOCKED/DONE`); `DONE` only with evidence.
3. `docs/project/REQUIREMENTS_TRACEABILITY.md` — status per requirement using the defined vocabulary.
4. `docs/project/KNOWN_ISSUES.md` — new defects, unavailable checks, workarounds; close resolved items with the date.

## When a decision was made

- Significant and architectural → new ADR `docs/adr/NNNN-kebab-title.md` from `docs/adr/0000-template.md`
  (status `accepted` only if implemented; `proposed` otherwise). Superseding: mark the old ADR `superseded by NNNN`.
- Always update the matching `docs/engineering-decisions/NN-*.md`: problem, options, choice, trade-offs, failure
  scenarios, tests, interview explanation, **evidence and confidence**. Reference real files and paste real code.
- Learning value → add/extend a topic in `docs/learning/` and link it from `docs/learning/README.md`.

## Rules

- Describe what the code does today; mark plans as plans.
- Never invent numbers (coverage, timings, bundle sizes) — copy them from command output or omit them.
- Keep one source of truth: link instead of duplicating long explanations.
