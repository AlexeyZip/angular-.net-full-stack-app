# ADR-0013: Assistant model behind one OpenAI-compatible adapter, with server-side guardrails

- **Status:** accepted
- **Date:** 2026-10-18
- **Implementation evidence:** `services/api/src/Shop.Api/Features/Assistant/*`; unit tests `AssistantTests.cs`,
  integration tests `AssistantApiTests.cs`; executed on 2026-10-18 (API unit 88/88, integration 61/61) and manually
  with qwen2.5:7b on Ollama 0.40.5 (decision 12 §13). Full walkthrough: `docs/guides/assistant-implementation.md`.

## Context
Local development must not need a paid AI service; tests must be deterministic; the server is the authority for
prices and stock; the user asked for a real model instead of a mock and chose a local Ollama model.

## Problem
How to integrate a language model so that providers are swappable, tests stay free and deterministic, and wrong or
manipulated model output cannot reach users as fact.

## Decision
- `IChatModel` with two implementations: `MockChatModel` (default) and `OpenAiCompatibleChatModel`
  (`/chat/completions`, temperature 0, `max_tokens`), selected by `Assistant:Provider`, options validated on start.
- Retrieval-augmented: rules parse filters, SQL retrieves active products; without sources the model is not called.
- Output boundary on the server: citations limited to retrieved ids, exact-name fallback, uncited text replaced,
  model-written prices replaced, product data always from the database, degraded mode on failure.
- Conversation is stateless on the server; the client sends earlier questions and shown product ids, never answers.
- Resilience: per-attempt and total timeouts, one retry only for fast failures, circuit breaker, optional warm-up.

## Alternatives considered
- Vendor SDK or Semantic Kernel — more dependencies for a single HTTP call; worth it for tool calling or agents.
- Hosted model by default — costs money and needs approval; possible through the same adapter.
- Trusting the prompt ("only mention listed products") — observed to fail with qwen2.5:7b; guardrails are code.
- Server-side chat sessions — store free text with possible personal data; not needed for follow-ups.

## Consequences
Switching Mock → Ollama → hosted is configuration; CI never calls a model; some genuinely good answers are replaced
when the model forgets to cite or name products (KI-16).

## Trade-offs
Lexical retrieval quality, English-only parsing, local-model latency (cold start ~57 s on the development machine),
no streaming.

## Security and operational implications
Anonymous endpoint with a per-IP rate limit; question text not logged; no customer data in prompts; API keys only
from user secrets/environment; nginx timeout longer than the API's total model timeout.

## Revisit when
The catalog or languages outgrow lexical retrieval (pgvector, hybrid search), answers get long (SSE streaming), or
tool calling/personalised answers are needed.
