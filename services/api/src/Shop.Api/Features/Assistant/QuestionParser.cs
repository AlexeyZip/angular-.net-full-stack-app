using System.Globalization;
using System.Text.RegularExpressions;

namespace Shop.Api.Features.Assistant;

/// <summary>What the retrieval step searches for. Structured filters are applied in SQL, not by the model.</summary>
public sealed record AssistantQuery(IReadOnlyList<string> Terms, decimal? MinPrice, decimal? MaxPrice, bool InStockOnly);

/// <summary>
/// Turns a free-text question into search terms and price/stock filters with plain rules. Deterministic and
/// testable; a model is not needed to understand "under $60".
/// </summary>
public static partial class QuestionParser
{
    private const int MaxTerms = 8;

    private static readonly HashSet<string> StopWords =
    [
        "a", "an", "the", "for", "and", "or", "with", "without", "under", "below", "over", "above", "less", "more", "than",
        "cheaper", "up", "to", "max", "maximum", "least", "from", "in", "on", "of", "at", "stock", "available", "i", "me",
        "my", "we", "our", "need", "want", "looking", "look", "show", "find", "any", "some", "something", "good", "best",
        "great", "nice", "what", "which", "is", "are", "do", "does", "you", "your", "have", "has", "recommend", "please",
        "can", "could", "would", "should", "like", "that", "this", "these", "those", "there", "price", "prices", "dollars",
        "usd", "cost", "costs", "buy", "get", "it", "its", "be", "not", "all", "one", "new", "about", "around",
        // Follow-up wording ("which of them is better?") refers to earlier answers, not to catalog text.
        "them", "they", "their", "ones", "other", "others", "else", "also", "both", "either", "tell", "better",
        "how", "much", "why", "will", "was", "were", "just", "only", "very", "really", "too", "then",
    ];

    public static AssistantQuery Parse(string question)
    {
        var text = question.ToLowerInvariant();

        var maxPrice = MatchPrice(MaxPriceRegex(), text);
        var minPrice = MatchPrice(MinPriceRegex(), text);
        var inStockOnly = InStockRegex().IsMatch(text);

        var withoutPrices = MinPriceRegex().Replace(MaxPriceRegex().Replace(text, " "), " ");
        var terms = WordRegex()
            .Matches(withoutPrices)
            .Select(m => m.Value)
            .Where(w => w.Length >= 3 && !StopWords.Contains(w) && !w.All(char.IsDigit))
            .Select(Singular)
            .Distinct()
            .Take(MaxTerms)
            .ToList();

        return new AssistantQuery(terms, minPrice, maxPrice, inStockOnly);
    }

    /// <summary>Crude English singular so "headphones" also matches "Headphone". Contains-matching does the rest.</summary>
    internal static string Singular(string word) =>
        word switch
        {
            _ when word.Length > 4 && (word.EndsWith("ches") || word.EndsWith("shes") || word.EndsWith("xes")) => word[..^2],
            _ when word.Length > 3 && word.EndsWith('s') && !word.EndsWith("ss") => word[..^1],
            _ => word,
        };

    private static decimal? MatchPrice(Regex regex, string text)
    {
        var match = regex.Match(text);
        return match.Success && decimal.TryParse(match.Groups["amount"].Value.Replace(',', '.'), NumberStyles.Number, CultureInfo.InvariantCulture, out var amount)
            ? amount
            : null;
    }

    [GeneratedRegex(@"(?:under|below|less than|cheaper than|up to|max(?:imum)?|at most|<)\s*\$?\s*(?<amount>\d{1,6}(?:[.,]\d{1,2})?)")]
    private static partial Regex MaxPriceRegex();

    [GeneratedRegex(@"(?:over|above|more than|at least|from|>)\s*\$?\s*(?<amount>\d{1,6}(?:[.,]\d{1,2})?)")]
    private static partial Regex MinPriceRegex();

    [GeneratedRegex(@"\b(?:in stock|available)\b")]
    private static partial Regex InStockRegex();

    [GeneratedRegex(@"[\p{L}\p{N}]+")]
    private static partial Regex WordRegex();
}
