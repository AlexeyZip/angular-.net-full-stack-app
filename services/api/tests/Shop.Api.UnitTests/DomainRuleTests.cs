using Shop.Api.Domain;
using Shop.Api.Features.Admin;
using Shop.Api.Features.Auth;
using Shop.Api.Features.Catalog;
using Shop.Api.Features.Orders;

namespace Shop.Api.UnitTests;

public sealed class OrderStatusTransitionTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 18, 12, 0, 0, TimeSpan.Zero);

    private static Order NewPaidOrder() => new(
        Guid.NewGuid(),
        "key-12345678",
        "fingerprint",
        new ShippingAddress("Alice", "1 Main St", "Springfield", "12345", "US"),
        [new OrderItem(1, "Widget", 10m, 2)],
        Pricing.Calculate([(10m, 2)]),
        "sim_ref",
        Now);

    [Theory]
    [InlineData(OrderStatus.Shipped)]
    [InlineData(OrderStatus.Cancelled)]
    public void Paid_order_can_be_shipped_or_cancelled(OrderStatus next)
    {
        var order = NewPaidOrder();

        order.TransitionTo(next, Now.AddHours(1));

        Assert.Equal(next, order.Status);
        Assert.Equal(Now.AddHours(1), order.UpdatedAt);
    }

    [Fact]
    public void Paid_order_cannot_skip_to_delivered()
    {
        var order = NewPaidOrder();

        var error = Assert.Throws<AppException>(() => order.TransitionTo(OrderStatus.Delivered, Now));

        Assert.Equal("invalid_status_transition", error.Code);
        Assert.Equal(OrderStatus.Paid, order.Status);
    }

    [Theory]
    [InlineData(OrderStatus.Paid)]
    [InlineData(OrderStatus.Shipped)]
    [InlineData(OrderStatus.Delivered)]
    public void Cancelled_is_terminal(OrderStatus next)
    {
        var order = NewPaidOrder();
        order.TransitionTo(OrderStatus.Cancelled, Now);

        Assert.Throws<AppException>(() => order.TransitionTo(next, Now));
    }

    [Fact]
    public void Shipped_order_can_no_longer_be_cancelled()
    {
        var order = NewPaidOrder();
        order.TransitionTo(OrderStatus.Shipped, Now);

        Assert.False(order.CanTransitionTo(OrderStatus.Cancelled));
        Assert.Equal([OrderStatus.Delivered], Order.NextStatuses(OrderStatus.Shipped));
    }

    [Fact]
    public void Order_totals_come_from_the_price_breakdown()
    {
        var order = NewPaidOrder();

        Assert.Equal(20m, order.Subtotal);
        Assert.Equal(Pricing.StandardShipping, order.ShippingCost);
        Assert.Equal(20m + Pricing.StandardShipping, order.Total);
        Assert.StartsWith("SO-20261018-", order.OrderNumber);
    }

    [Fact]
    public void Order_requires_items()
    {
        var error = Assert.Throws<AppException>(() => new Order(
            Guid.NewGuid(), "key-12345678", "fp", new ShippingAddress("A", "B", "C", "D", "US"), [], Pricing.Calculate([]), "ref", Now));

        Assert.Equal("empty_order", error.Code);
    }
}

public sealed class ProductRuleTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.UnixEpoch;

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(9.999)]
    public void Invalid_prices_are_rejected(decimal price)
    {
        var error = Assert.Throws<AppException>(() => new Product("Name", "slug", "", "Brand", price, 1, 1, null, Now));

        Assert.Equal("invalid_price", error.Code);
    }

    [Fact]
    public void Negative_initial_stock_is_rejected()
    {
        var error = Assert.Throws<AppException>(() => new Product("Name", "slug", "", "Brand", 10m, -1, 1, null, Now));

        Assert.Equal("invalid_stock", error.Code);
    }

    [Fact]
    public void Reviews_update_the_running_average()
    {
        var product = new Product("Name", "slug", "", "Brand", 10m, 1, 1, null, Now);

        product.ApplyReview(5);
        product.ApplyReview(4);
        product.ApplyReview(4);

        Assert.Equal(3, product.ReviewCount);
        Assert.Equal(13, product.RatingTotal);
        Assert.Equal(4.33m, product.AverageRating);
    }

    [Fact]
    public void The_average_is_derived_from_the_exact_total_so_rounding_never_accumulates()
    {
        var product = new Product("Name", "slug", "", "Brand", 10m, 1, 1, null, Now);

        for (var i = 0; i < 300; i++)
        {
            product.ApplyReview(i % 3 == 0 ? 5 : 4); // 100 fives, 200 fours -> exactly 4.333...
        }

        Assert.Equal(4.33m, product.AverageRating);
        Assert.Equal(Product.AverageOf(1300, 300), product.AverageRating);
    }

    [Fact]
    public void Only_detail_edits_advance_the_concurrency_version()
    {
        var product = new Product("Name", "slug", "", "Brand", 10m, 5, 1, null, Now);
        var initial = product.Version;

        product.ApplyReview(5);
        Assert.Equal(initial, product.Version);

        product.UpdateDetails("Renamed", "slug", "", "Brand", 12m, 1, null, true, Now);
        Assert.Equal(initial + 1, product.Version);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    public void Ratings_outside_one_to_five_are_rejected(int rating)
    {
        Assert.Throws<AppException>(() => new Review(1, Guid.NewGuid(), rating, "text", Now));
    }
}

public sealed class InputNormalizationTests
{
    [Theory]
    [InlineData("Northwind Pro 14", "northwind-pro-14")]
    [InlineData("  27\" 4K Monitor!! ", "27-4k-monitor")]
    [InlineData("---", "")]
    public void Slugs_are_url_safe(string input, string expected) => Assert.Equal(expected, Slugs.Normalize(input));

    [Fact]
    public void Like_wildcards_in_search_are_escaped()
    {
        Assert.Equal(@"100\%\_off\\", CatalogService.EscapeLikePattern(@"100%_off\"));
    }

    [Theory]
    [InlineData("https://cdn.example.com/a.png", true)]
    [InlineData("/images/a.png", true)]
    [InlineData("http://example.com/a.png", false)]
    [InlineData("javascript:alert(1)", false)]
    [InlineData("//evil.example.com/a.png", false)]
    public void Image_urls_must_be_https_or_relative(string url, bool valid)
    {
        if (valid)
        {
            Assert.Equal(url, AdminCatalogService.ValidateImageUrl(url));
        }
        else
        {
            Assert.Throws<AppException>(() => AdminCatalogService.ValidateImageUrl(url));
        }
    }

    [Theory]
    [InlineData("short1")]
    [InlineData("onlyletters")]
    [InlineData("12345678")]
    public void Weak_passwords_are_rejected(string password)
    {
        var error = Assert.Throws<AppException>(() => PasswordPolicy.EnsureValid(password));
        Assert.Equal("weak_password", error.Code);
    }

    [Fact]
    public void Strong_password_is_accepted() => PasswordPolicy.EnsureValid("correct-horse-42");

    [Fact]
    public void Duplicate_cart_lines_are_merged_and_sorted()
    {
        var merged = CartLines.Merge([new(5, 1), new(2, 3), new(5, 2)]);

        Assert.Equal([new CartLineRequest(2, 3), new CartLineRequest(5, 3)], merged);
    }

    [Fact]
    public void Merged_quantity_cannot_exceed_the_per_line_limit()
    {
        var error = Assert.Throws<AppException>(() => CartLines.Merge([new(1, Pricing.MaxQuantityPerLine), new(1, 1)]));

        Assert.Equal("quantity_limit_exceeded", error.Code);
    }

    [Fact]
    public void Checkout_fingerprint_is_stable_and_payload_sensitive()
    {
        var address = new ShippingAddressDto("Alice", "1 Main St", "Springfield", "12345", "US");
        var request = new CheckoutRequest([new(1, 1)], address, PaymentSimulator.ApprovedToken);
        var lines = CartLines.Merge(request.Items);

        var first = CheckoutService.Fingerprint(lines, request);
        var again = CheckoutService.Fingerprint(lines, request);
        var different = CheckoutService.Fingerprint(CartLines.Merge([new(1, 2)]), request);

        Assert.Equal(first, again);
        Assert.NotEqual(first, different);
    }
}

public sealed class PaymentSimulatorTests
{
    private readonly PaymentSimulator _simulator = new();

    [Fact]
    public void Approved_token_returns_deterministic_reference()
    {
        var first = _simulator.Charge(10m, PaymentSimulator.ApprovedToken, "key-1");
        var second = _simulator.Charge(10m, PaymentSimulator.ApprovedToken, "key-1");

        Assert.StartsWith("sim_", first);
        Assert.Equal(first, second);
    }

    [Theory]
    [InlineData(PaymentSimulator.DeclinedToken, 402, "payment_declined")]
    [InlineData(PaymentSimulator.UnavailableToken, 503, "payment_unavailable")]
    [InlineData("tok_unknown", 422, "invalid_payment_token")]
    public void Failing_tokens_raise_meaningful_errors(string token, int status, string code)
    {
        var error = Assert.Throws<AppException>(() => _simulator.Charge(10m, token, "key-1"));

        Assert.Equal(status, error.StatusCode);
        Assert.Equal(code, error.Code);
    }
}
