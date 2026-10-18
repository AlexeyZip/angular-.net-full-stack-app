using System.Globalization;
using System.Text.RegularExpressions;

namespace Shop.Api.Features.Assistant;

public sealed record GuardedAnswer(string Text, int RemovedPrices);

/// <summary>
/// Output boundary for money: the shop shows prices from the database next to the answer, so a price written by
/// the model (invented, stale or injected through catalog text) is replaced. Amounts the user wrote in the
/// question ("under $150") may be repeated, because they are the user's budget, not a product price.
/// </summary>
public static partial class PriceGuard
{
    public const string Replacement = "(see the price below)";

    public static GuardedAnswer Apply(string answer, string question)
    {
        var allowed = Number().Matches(question).Select(m => Normalize(m.Value)).ToHashSet();
        var removed = 0;
        var text = Money().Replace(answer, match =>
        {
            if (allowed.Contains(Normalize(match.Groups["n"].Value)))
            {
                return match.Value;
            }

            removed++;
            return Replacement;
        });
        return new GuardedAnswer(text, removed);
    }

    private static string Normalize(string number) =>
        decimal.TryParse(number.Replace(",", string.Empty), NumberStyles.Number, CultureInfo.InvariantCulture, out var value)
            ? value.ToString("0.##", CultureInfo.InvariantCulture)
            : number;

    // $49, $ 49.99, €1,299, 49.99 USD, 49 dollars
    [GeneratedRegex(@"[$€£]\s?(?<n>\d[\d,]*(?:\.\d{1,2})?)|(?<n>\d[\d,]*(?:\.\d{1,2})?)\s?(?:USD|EUR|GBP|dollars?|bucks)\b",
        RegexOptions.IgnoreCase)]
    private static partial Regex Money();

    [GeneratedRegex(@"\d[\d,]*(?:\.\d+)?")]
    private static partial Regex Number();
}
