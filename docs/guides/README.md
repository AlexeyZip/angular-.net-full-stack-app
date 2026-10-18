# Implementation guides

Hands-on walkthroughs: how a part of the system is built, why, and how to repeat it in another project. Each guide
names the files to read next to it. Decisions are recorded in `../adr/`; their long-form discussion is in
`../engineering-decisions/`.

| Guide | Covers |
| --- | --- |
| [Developer guide](developer-guide.md) | system map, ports, run combinations, where to put a change, verification, troubleshooting |
| [Shopping assistant](assistant-implementation.md) | RAG pipeline, prompt and output guardrails, model adapter and resilience, chat with follow-ups, microfrontend side panel, trade-offs, threat model, tests, how to build it yourself |
| [Outbox and notifications service](outbox-and-notifications-service.md) | transactional outbox, claim/lease with `SKIP LOCKED`, retries and dead letters, idempotent consumer, service auth, contract samples, adding an event |
| [Design patterns and principles](design-patterns.md) | creational, structural, behavioral, architectural and application patterns with code from this repository, SOLID and other principles, patterns deliberately not used |
