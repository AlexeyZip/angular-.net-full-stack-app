using System.Diagnostics;
using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Shop.Api.Domain;
using Shop.Api.Features.Catalog;
using Shop.Api.Infrastructure.Persistence;

namespace Shop.Api.Features.Assistant;

/// <summary>
/// Retrieval-augmented answers about the catalog:
/// 1. parse the question into terms and structured filters (rules, not the model);
/// 2. retrieve matching active products from PostgreSQL (lexical retrieval; pgvector is the documented next step),
///    plus the products the previous answer showed, so follow-up questions have something to refer to;
/// 3. ask the model to answer only from those products, citing them;
/// 4. keep only citations of retrieved products, replace prices the model wrote, and return product data
///    (prices, stock) from the database.
/// If the model fails, the caller still gets the retrieval results (graceful degradation).
/// See docs/engineering-decisions/12-ai-integration-and-rag.md.
/// </summary>
public sealed class AssistantService(ShopDbContext db, IChatModel model, ILogger<AssistantService> logger)
{
    private const int CandidateLimit = 40;

    internal const string NoMatchAnswer = "I could not find products that match your question. Try other words or browse the catalog.";
    internal const string UncitedAnswer = "I could not find an exact match. These catalog products are the closest to your question.";

    public async Task<AssistantAnswerDto> AskAsync(string question, IReadOnlyList<AssistantTurnDto> history, CancellationToken cancellationToken)
    {
        var query = QuestionParser.Parse(question);
        var products = await RetrieveAsync(query, cancellationToken);

        // Follow-ups ("which of them is in stock?") refer to what the previous answer showed. Those ids come from the
        // client, so they are only looked up again, with the same active/price/stock filters as any retrieval.
        var shownBefore = history.Count > 0 ? history[^1].ProductIds ?? [] : [];
        if (shownBefore.Count > 0)
        {
            products = [.. products, .. await LoadShownBeforeAsync(query, shownBefore, products, cancellationToken)];
        }

        if (products.Count == 0)
        {
            // Without sources a model can only invent products, so it is not asked at all.
            return new AssistantAnswerDto(NoMatchAnswer, [], model.Name, Degraded: false);
        }

        var sources = products.Select(p => new SourceProduct(p.Id, p.Name, p.Brand, p.CategoryName, p.Description)).ToList();
        var earlierQuestions = history.Select(turn => turn.Question).ToList();

        var started = Stopwatch.GetTimestamp();
        string output;
        try
        {
            output = await model.CompleteAsync(PromptBuilder.Build(question, sources, earlierQuestions), cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            // Question text is not logged: it is free user input and may contain personal data.
            logger.LogWarning(ex, "Assistant provider {Provider} failed after {ElapsedMs} ms; returning search results only",
                model.Name, Stopwatch.GetElapsedTime(started).TotalMilliseconds);
            return new AssistantAnswerDto(
                "The assistant is unavailable right now. Here are the products that match your search.",
                products.Select(ToDto).ToList(),
                model.Name,
                Degraded: true);
        }

        var filtered = CitationFilter.Apply(output, products.Select(p => p.Id).ToHashSet());
        // Amounts the user wrote anywhere in the conversation ("under $50") may be repeated by the model.
        var guarded = PriceGuard.Apply(filtered.Text, string.Join('\n', [.. earlierQuestions, question]));
        logger.LogInformation(
            "Assistant {Provider} answered in {ElapsedMs} ms with {Sources} sources, {HistoryTurns} earlier turns, {Cited} citations, {Rejected} rejected citations, {RemovedPrices} removed prices",
            model.Name, Stopwatch.GetElapsedTime(started).TotalMilliseconds, sources.Count, history.Count, filtered.CitedIds.Count,
            filtered.RejectedCitations, guarded.RemovedPrices);

        // Show what the answer cites, in citation order, falling back to retrieved products it names exactly.
        // An answer grounded in neither cannot be checked against the catalog (it may describe products the
        // shop does not sell), so its text is replaced and the retrieved products are shown instead.
        var grounded = filtered.CitedIds.Count > 0
            ? filtered.CitedIds
            : CitationFilter.FindMentionedProducts(guarded.Text, products.Select(p => (p.Id, p.Name)));
        if (grounded.Count == 0)
        {
            return new AssistantAnswerDto(UncitedAnswer, products.Select(ToDto).ToList(), model.Name, Degraded: false);
        }

        var shown = grounded.Select(id => products.First(p => p.Id == id)).ToList();
        return new AssistantAnswerDto(guarded.Text, shown.Select(ToDto).ToList(), model.Name, Degraded: false);
    }

    private async Task<List<RetrievedProduct>> RetrieveAsync(AssistantQuery query, CancellationToken cancellationToken)
    {
        if (query.Terms.Count == 0)
        {
            return [];
        }

        var patterns = query.Terms.Select(t => $"%{CatalogService.EscapeLikePattern(t)}%").ToArray();

        // One "searchable text" expression; Npgsql translates patterns.Any(ILike) to ILIKE ANY (@patterns).
        // Candidates are ordered by how many terms they match, names first, so the candidate limit cannot cut off the
        // most relevant products when a common word ("kettle") matches more than CandidateLimit rows.
        var candidates = await Filtered(query)
            .Where(p => patterns.Any(pattern => EF.Functions.ILike(p.Name + " " + p.Brand + " " + p.Category.Name + " " + p.Description, pattern)))
            .OrderByDescending(p => patterns.Count(pattern => EF.Functions.ILike(p.Name, pattern)))
            .ThenByDescending(p => patterns.Count(pattern => EF.Functions.ILike(p.Name + " " + p.Brand + " " + p.Category.Name + " " + p.Description, pattern)))
            .ThenBy(p => p.Id)
            .Take(CandidateLimit)
            .Select(ToRetrieved)
            .ToListAsync(cancellationToken);

        return candidates
            .Select(p => (Product: p, Score: Score(p, query.Terms)))
            .OrderByDescending(x => x.Score)
            .ThenByDescending(x => x.Product.AverageRating)
            .ThenBy(x => x.Product.Price)
            .Take(AssistantLimits.MaxSources)
            .Select(x => x.Product)
            .ToList();
    }

    /// <summary>Previously shown products that still pass the current filters, in the order they were shown.</summary>
    private async Task<List<RetrievedProduct>> LoadShownBeforeAsync(
        AssistantQuery query, IReadOnlyList<int> productIds, List<RetrievedProduct> retrieved, CancellationToken cancellationToken)
    {
        var ids = productIds.Distinct().Except(retrieved.Select(p => p.Id)).Take(AssistantLimits.MaxSources).ToArray();
        if (ids.Length == 0)
        {
            return [];
        }

        var found = await Filtered(query).Where(p => ids.Contains(p.Id)).Select(ToRetrieved).ToListAsync(cancellationToken);
        return ids.Select(id => found.Find(p => p.Id == id)).OfType<RetrievedProduct>().ToList();
    }

    private IQueryable<Product> Filtered(AssistantQuery query)
    {
        var products = db.Products.AsNoTracking().Where(p => p.IsActive);
        if (query.MinPrice is { } min)
        {
            products = products.Where(p => p.Price >= min);
        }

        if (query.MaxPrice is { } max)
        {
            products = products.Where(p => p.Price <= max);
        }

        if (query.InStockOnly)
        {
            products = products.Where(p => p.StockQuantity > 0);
        }

        return products;
    }

    private static readonly Expression<Func<Product, RetrievedProduct>> ToRetrieved = p =>
        new RetrievedProduct(p.Id, p.Name, p.Slug, p.Brand, p.Category.Name, p.Description, p.Price, p.StockQuantity, p.AverageRating);

    /// <summary>Terms found in the name count double: "kettle" in the name beats "kettle" in a description.</summary>
    internal static int Score(RetrievedProduct product, IReadOnlyList<string> terms) =>
        terms.Sum(term =>
            (Contains(product.Name, term) ? 2 : 0)
            + (Contains(product.Brand, term) || Contains(product.CategoryName, term) || Contains(product.Description, term) ? 1 : 0));

    private static bool Contains(string text, string term) => text.Contains(term, StringComparison.OrdinalIgnoreCase);

    private static AssistantProductDto ToDto(RetrievedProduct p) =>
        new(p.Id, p.Name, p.Slug, p.Brand, p.CategoryName, p.Price, p.StockQuantity);
}

internal sealed record RetrievedProduct(
    int Id, string Name, string Slug, string Brand, string CategoryName, string Description, decimal Price, int StockQuantity, decimal AverageRating);
