using System.Text;

namespace Shop.Api.Domain;

public static class Slugs
{
    /// <summary>Lower-case, ASCII letters/digits separated by single hyphens.</summary>
    public static string Normalize(string value)
    {
        var builder = new StringBuilder(value.Length);
        var previousWasHyphen = true; // suppresses leading hyphens

        foreach (var character in value.Trim().ToLowerInvariant())
        {
            if (character is >= 'a' and <= 'z' or >= '0' and <= '9')
            {
                builder.Append(character);
                previousWasHyphen = false;
            }
            else if (!previousWasHyphen)
            {
                builder.Append('-');
                previousWasHyphen = true;
            }
        }

        return builder.ToString().TrimEnd('-');
    }
}
