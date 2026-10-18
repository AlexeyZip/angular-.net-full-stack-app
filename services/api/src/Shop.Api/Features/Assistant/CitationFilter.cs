using System.Text.RegularExpressions;

namespace Shop.Api.Features.Assistant;

public sealed record FilteredAnswer(string Text, IReadOnlyList<int> CitedIds, int RejectedCitations);

/// <summary>
/// Output boundary: the model may only cite products that retrieval returned. Citations of anything else
/// (hallucinated or injected ids) are dropped, and the markers are removed from the text shown to users.
/// </summary>
public static partial class CitationFilter
{
    public static FilteredAnswer Apply(string modelOutput, IReadOnlySet<int> allowedIds)
    {
        var cited = new List<int>();
        var rejected = 0;
        foreach (Match match in Citation().Matches(modelOutput))
        {
            if (int.TryParse(match.Groups["id"].Value, out var id) && allowedIds.Contains(id))
            {
                if (!cited.Contains(id))
                {
                    cited.Add(id);
                }
            }
            else
            {
                rejected++;
            }
        }

        // Models sometimes wrap the citation with the name ("[Kettle One [P:3]]"); the answer is plain text, so
        // brackets left over after removing citations are dropped too.
        var text = SquareBrackets().Replace(Citation().Replace(modelOutput, string.Empty), string.Empty);
        text = Spaces().Replace(text, " ").Trim();
        text = SpaceBeforePunctuation().Replace(text, "$1");
        if (text.Length > AssistantLimits.MaxAnswerLength)
        {
            text = text[..AssistantLimits.MaxAnswerLength] + "…";
        }

        return new FilteredAnswer(text, cited, rejected);
    }

    /// <summary>
    /// Fallback grounding for models that skip the citation markers: retrieved products whose exact name appears
    /// in the answer, in order of appearance. Names of products that were not retrieved never match.
    /// </summary>
    public static IReadOnlyList<int> FindMentionedProducts(string text, IEnumerable<(int Id, string Name)> products) =>
        products
            .Select(p => (p.Id, Position: text.IndexOf(p.Name, StringComparison.OrdinalIgnoreCase)))
            .Where(p => p.Position >= 0)
            .OrderBy(p => p.Position)
            .Select(p => p.Id)
            .ToList();

    [GeneratedRegex(@"\[P:(?<id>\d{1,9})\]")]
    private static partial Regex Citation();

    [GeneratedRegex(@"[\[\]]")]
    private static partial Regex SquareBrackets();

    [GeneratedRegex(@"[ \t]{2,}")]
    private static partial Regex Spaces();

    [GeneratedRegex(@"\s+([.,;:!?])")]
    private static partial Regex SpaceBeforePunctuation();
}
