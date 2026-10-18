using Microsoft.EntityFrameworkCore;
using Shop.Api.Domain;
using Shop.Api.Infrastructure.Persistence;

namespace Shop.Api.Features.Orders;

/// <summary>
/// Prices a client-side cart with current server data. The SPA calls it whenever the cart changes,
/// so the totals it displays always come from <see cref="Pricing"/>, never from client arithmetic.
/// </summary>
public sealed class CartQuoteService(ShopDbContext db)
{
    public async Task<CartQuoteDto> QuoteAsync(IReadOnlyList<CartLineRequest> items, CancellationToken cancellationToken)
    {
        var lines = CartLines.Merge(items);
        var ids = lines.Select(l => l.ProductId).ToArray();

        var products = await db.Products
            .AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new { p.Id, p.Name, p.Slug, p.ImageUrl, p.Price, p.StockQuantity, p.IsActive })
            .ToDictionaryAsync(p => p.Id, cancellationToken);

        var quoted = new List<CartQuoteLineDto>(lines.Count);
        foreach (var line in lines)
        {
            if (!products.TryGetValue(line.ProductId, out var product) || !product.IsActive)
            {
                quoted.Add(new CartQuoteLineDto(line.ProductId, "Unavailable product", string.Empty, null, 0, line.Quantity, 0, 0, CartLineIssue.Unavailable));
                continue;
            }

            var issue = product.StockQuantity < line.Quantity ? CartLineIssue.InsufficientStock : (CartLineIssue?)null;
            quoted.Add(new CartQuoteLineDto(
                product.Id,
                product.Name,
                product.Slug,
                product.ImageUrl,
                product.Price,
                line.Quantity,
                product.Price * line.Quantity,
                product.StockQuantity,
                issue));
        }

        var price = Pricing.Calculate(quoted.Where(l => l.Issue != CartLineIssue.Unavailable).Select(l => (l.UnitPrice, l.Quantity)));
        var canCheckout = quoted.Count > 0 && quoted.All(l => l.Issue is null);
        return new CartQuoteDto(quoted, price.Subtotal, price.Shipping, price.Total, Pricing.FreeShippingThreshold, canCheckout);
    }
}

public static class CartLines
{
    /// <summary>Combines duplicate product lines and orders them by product id (also the stock lock order).</summary>
    public static IReadOnlyList<CartLineRequest> Merge(IEnumerable<CartLineRequest> items)
    {
        var merged = items
            .GroupBy(i => i.ProductId)
            .Select(g => new CartLineRequest(g.Key, g.Sum(i => i.Quantity)))
            .OrderBy(l => l.ProductId)
            .ToList();

        var tooMany = merged.FirstOrDefault(l => l.Quantity > Pricing.MaxQuantityPerLine);
        if (tooMany is not null)
        {
            throw AppException.BusinessRule(
                "quantity_limit_exceeded",
                $"At most {Pricing.MaxQuantityPerLine} units of a product can be ordered at once.",
                new Dictionary<string, object?> { ["productId"] = tooMany.ProductId });
        }

        return merged;
    }
}
