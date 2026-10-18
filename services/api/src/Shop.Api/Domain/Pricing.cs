namespace Shop.Api.Domain;

public sealed record PriceBreakdown(decimal Subtotal, decimal Shipping, decimal Total);

/// <summary>
/// The single source of truth for monetary calculations. Used by both the cart quote and checkout,
/// so the price a customer sees is computed by exactly the same code that charges them.
/// </summary>
public static class Pricing
{
    public const decimal FreeShippingThreshold = 100.00m;
    public const decimal StandardShipping = 9.99m;
    public const int MaxQuantityPerLine = 20;
    public const int MaxLinesPerOrder = 50;

    public static PriceBreakdown Calculate(IEnumerable<(decimal UnitPrice, int Quantity)> lines)
    {
        var subtotal = lines.Sum(line => line.UnitPrice * line.Quantity);
        var shipping = subtotal == 0 || subtotal >= FreeShippingThreshold ? 0m : StandardShipping;
        return new PriceBreakdown(subtotal, shipping, subtotal + shipping);
    }
}
