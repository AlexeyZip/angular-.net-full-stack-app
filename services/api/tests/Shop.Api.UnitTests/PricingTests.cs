using Shop.Api.Domain;

namespace Shop.Api.UnitTests;

public sealed class PricingTests
{
    [Fact]
    public void Below_threshold_adds_standard_shipping()
    {
        var price = Pricing.Calculate([(19.99m, 2), (5.00m, 1)]);

        Assert.Equal(44.98m, price.Subtotal);
        Assert.Equal(Pricing.StandardShipping, price.Shipping);
        Assert.Equal(54.97m, price.Total);
    }

    [Fact]
    public void At_threshold_shipping_is_free()
    {
        var price = Pricing.Calculate([(50.00m, 2)]);

        Assert.Equal(100.00m, price.Subtotal);
        Assert.Equal(0m, price.Shipping);
        Assert.Equal(100.00m, price.Total);
    }

    [Fact]
    public void Empty_cart_costs_nothing()
    {
        var price = Pricing.Calculate([]);

        Assert.Equal(new PriceBreakdown(0m, 0m, 0m), price);
    }

    [Fact]
    public void Decimal_arithmetic_has_no_binary_rounding_error()
    {
        // 0.1 + 0.2 != 0.3 with double; decimal is exact for money.
        var price = Pricing.Calculate([(0.10m, 1), (0.20m, 1)]);

        Assert.Equal(0.30m, price.Subtotal);
    }
}
