# 12 — AI integration and RAG (design only)

**Status: DESIGN_ONLY.** Nothing in this document is implemented. Building it requires choosing a model provider;
paid APIs need explicit approval (no external costs were incurred).

## 1. Problem
Customers ask questions the filters cannot express ("a quiet kettle under $60 for a small kitchen"); admins want
help drafting product descriptions.

## 2. Context
Product data lives in PostgreSQL; the catalog is small; privacy: no customer data should leave the system.

## 3. Options
(a) Prompt a hosted LLM with the whole catalog (does not scale, leaks data); (b) **RAG**: retrieve the relevant
products, then generate an answer citing them; (c) fine-tuning (expensive, stale data); (d) classic search improvements
only (trigram/full-text).

## 4. Proposed approach
```text
Admin product save ──(outbox, A-02)──► Embedding worker ─► product_embeddings(product_id, embedding vector(N), content_hash)
Customer question ─► POST /api/assistant/ask
   1. embed question  2. pgvector similarity search (top-k, only active products) + structured filters (price, stock)
   3. prompt = system rules + retrieved products (id, name, price, stock, description)  4. LLM answer with product ids
   5. validate: every cited id exists in the retrieved set; prices shown from the DB, never from the model text
```
- Provider behind an interface (`IChatModel`, `IEmbeddingModel`); local option: Ollama; hosted option: Azure OpenAI.
- `pgvector` extension keeps vectors next to the data (no extra service).

## 5. Why RAG
Answers stay grounded in current data; no retraining when products change; citations make answers checkable.

## 6. Trade-offs
Latency (embedding + generation), cost per request, non-determinism, prompt-injection risk via product descriptions.

## 7. Simpler alternative
Better search (PostgreSQL full-text with synonyms) may solve most queries without an LLM — try first.

## 8. Rejected
Sending the full catalog or customer data in prompts; letting the model decide prices or stock.

## 9. Implementation references (future)
`Features/Assistant/` (new), migration adding `vector` extension and `product_embeddings`, `libs/shared/data-access`
client, a chat component with streaming (SSE).

## 10. Code sketch
```csharp
var hits = await db.ProductEmbeddings
    .OrderBy(e => e.Embedding.CosineDistance(questionVector))   // Pgvector.EntityFrameworkCore
    .Take(8).Select(e => new { e.ProductId, e.Product.Name, e.Product.Price }).ToListAsync(ct);
```

## 11. Failure scenarios
Provider down → return search results without generated text; hallucinated product → filtered out by id validation.

## 12. Testing
Fake model in integration tests (deterministic); offline evaluation set of questions with expected product ids.

## 13. Performance / security
Rate-limit the endpoint; cap tokens; strip instructions from retrieved text; never include PII; log prompts without
user identifiers.

## 14. When it's worth it
When search analytics show many unanswerable natural-language queries.

## 15. Interview explanation
"I'd use RAG: embed products with pgvector, retrieve top-k with structured filters, generate an answer that must cite
retrieved product ids, and always show prices from the database. The model never decides money or stock."

## 16. Evidence
Design only; confidence in the design: medium (no prototype).
