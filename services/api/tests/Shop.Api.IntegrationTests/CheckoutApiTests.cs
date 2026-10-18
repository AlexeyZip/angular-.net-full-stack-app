using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Shop.Api.Domain;
using Shop.Api.Features.Orders;
using Shop.Api.Features.Shared;

namespace Shop.Api.IntegrationTests;

public sealed class CheckoutApiTests(ApiFixture api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static readonly ShippingAddressDto Address = new("Test Customer", "1 Test Street", "Springfield", "12345", "US");

    [Fact]
    public async Task Checkout_uses_server_prices_and_decrements_stock()
    {
        var product = await api.CreateProductAsync(stock: 10, price: 30.00m);
        var (client, _) = await api.RegisterCustomerAsync();

        var response = await Checkout(client, NewKey(), [new(product.Id, 2)]);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var order = await response.ReadAsync<OrderDetailDto>();
        Assert.Equal(OrderStatus.Paid, order.Status);
        Assert.Equal(60.00m, order.Subtotal);
        Assert.Equal(Pricing.StandardShipping, order.ShippingCost);
        Assert.Equal(60.00m + Pricing.StandardShipping, order.Total);
        Assert.Equal(8, await api.GetStockAsync(product.Id));

        var history = await (await client.GetAsync("/api/orders", Ct)).ReadAsync<PagedResult<OrderSummaryDto>>();
        Assert.Contains(history.Items, o => o.Id == order.Id);
    }

    [Fact]
    public async Task Client_supplied_prices_are_ignored()
    {
        var product = await api.CreateProductAsync(stock: 5, price: 200.00m);
        var (client, _) = await api.RegisterCustomerAsync();

        // Extra JSON properties (price, total, userId) are not part of the contract and are not bound.
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/orders")
        {
            Content = JsonContent.Create(new
            {
                items = new[] { new { productId = product.Id, quantity = 1, unitPrice = 0.01m } },
                shippingAddress = Address,
                paymentToken = PaymentSimulator.ApprovedToken,
                total = 0.01m,
                userId = Guid.NewGuid(),
            }),
        };
        request.Headers.Add(OrdersController.IdempotencyHeader, NewKey());

        var order = await (await client.SendAsync(request, Ct)).ReadAsync<OrderDetailDto>();

        Assert.Equal(200.00m, order.Total);
    }

    [Fact]
    public async Task Retrying_with_the_same_key_returns_the_original_order_once()
    {
        var product = await api.CreateProductAsync(stock: 10);
        var (client, _) = await api.RegisterCustomerAsync();
        var key = NewKey();

        var first = await Checkout(client, key, [new(product.Id, 3)]);
        var retry = await Checkout(client, key, [new(product.Id, 3)]);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        Assert.Equal("true", retry.Headers.GetValues("Idempotent-Replayed").Single());
        Assert.Equal((await first.ReadAsync<OrderDetailDto>()).Id, (await retry.ReadAsync<OrderDetailDto>()).Id);
        Assert.Equal(7, await api.GetStockAsync(product.Id));
    }

    [Fact]
    public async Task Reusing_a_key_for_a_different_request_is_rejected()
    {
        var product = await api.CreateProductAsync(stock: 10);
        var (client, _) = await api.RegisterCustomerAsync();
        var key = NewKey();
        await Checkout(client, key, [new(product.Id, 1)]);

        var response = await Checkout(client, key, [new(product.Id, 2)]);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Equal("idempotency_key_reused", await response.ReadProblemCodeAsync());
        Assert.Equal(9, await api.GetStockAsync(product.Id));
    }

    [Fact]
    public async Task Concurrent_duplicate_requests_create_a_single_order()
    {
        var product = await api.CreateProductAsync(stock: 50);
        var (client, auth) = await api.RegisterCustomerAsync();
        var key = NewKey();

        var responses = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => Checkout(client, key, [new(product.Id, 1)])));

        Assert.All(responses, r => Assert.True(r.IsSuccessStatusCode, $"Unexpected {r.StatusCode}"));
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Created);
        Assert.Equal(1, await api.QueryAsync(db => db.Orders.CountAsync(o => o.UserId == auth.User.Id, Ct)));
        Assert.Equal(49, await api.GetStockAsync(product.Id));
    }

    [Fact]
    public async Task Missing_idempotency_key_is_a_validation_error()
    {
        var product = await api.CreateProductAsync(stock: 1);
        var (client, _) = await api.RegisterCustomerAsync();

        var response = await client.PostAsJsonAsync("/api/orders",
            new CheckoutRequest([new(product.Id, 1)], Address, PaymentSimulator.ApprovedToken), Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(1, await api.GetStockAsync(product.Id));
    }

    [Fact]
    public async Task Insufficient_stock_is_rejected_and_nothing_changes()
    {
        var plenty = await api.CreateProductAsync(stock: 10);
        var scarce = await api.CreateProductAsync(stock: 1);
        var (client, _) = await api.RegisterCustomerAsync();

        var response = await Checkout(client, NewKey(), [new(plenty.Id, 2), new(scarce.Id, 2)]);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("insufficient_stock", await response.ReadProblemCodeAsync());
        Assert.Equal(10, await api.GetStockAsync(plenty.Id)); // rolled back, although it was decremented first
        Assert.Equal(1, await api.GetStockAsync(scarce.Id));
    }

    [Fact]
    public async Task Declined_payment_rolls_back_the_stock_reservation()
    {
        var product = await api.CreateProductAsync(stock: 4);
        var (client, auth) = await api.RegisterCustomerAsync();

        var response = await Checkout(client, NewKey(), [new(product.Id, 2)], PaymentSimulator.DeclinedToken);

        Assert.Equal(HttpStatusCode.PaymentRequired, response.StatusCode);
        Assert.Equal("payment_declined", await response.ReadProblemCodeAsync());
        Assert.Equal(4, await api.GetStockAsync(product.Id));
        Assert.Equal(0, await api.QueryAsync(db => db.Orders.CountAsync(o => o.UserId == auth.User.Id, Ct)));
    }

    [Fact]
    public async Task Concurrent_buyers_cannot_oversell_the_last_units()
    {
        const int stock = 5;
        const int buyers = 12;
        var product = await api.CreateProductAsync(stock);
        var clients = await Task.WhenAll(Enumerable.Range(0, buyers).Select(_ => api.RegisterCustomerAsync()));

        var responses = await Task.WhenAll(clients.Select(c => Checkout(c.Client, NewKey(), [new(product.Id, 1)])));

        Assert.Equal(stock, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(buyers - stock, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        Assert.Equal(0, await api.GetStockAsync(product.Id));
        Assert.Equal(stock, await api.QueryAsync(db => db.OrderItems.Where(i => i.ProductId == product.Id).SumAsync(i => i.Quantity, Ct)));
    }

    [Fact]
    public async Task Inactive_products_cannot_be_bought()
    {
        var (client, _) = await api.RegisterCustomerAsync();

        var response = await Checkout(client, NewKey(), [new(int.MaxValue, 1)]);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Equal("product_unavailable", await response.ReadProblemCodeAsync());
    }

    [Fact]
    public async Task Quote_reports_stock_issues_without_reserving_anything()
    {
        var product = await api.CreateProductAsync(stock: 2, price: 60.00m);
        var client = api.CreateClient();

        var quote = await (await client.PostAsJsonAsync("/api/cart/quote", new CartQuoteRequest([new(product.Id, 3), new(int.MaxValue, 1)]), Ct))
            .ReadAsync<CartQuoteDto>();

        Assert.False(quote.CanCheckout);
        Assert.Equal(CartLineIssue.InsufficientStock, quote.Lines.Single(l => l.ProductId == product.Id).Issue);
        Assert.Equal(CartLineIssue.Unavailable, quote.Lines.Single(l => l.ProductId == int.MaxValue).Issue);
        Assert.Equal(180.00m, quote.Subtotal);
        Assert.Equal(0m, quote.Shipping);
        Assert.Equal(2, await api.GetStockAsync(product.Id));
    }

    [Fact]
    public async Task Customers_cannot_see_other_customers_orders()
    {
        var product = await api.CreateProductAsync(stock: 5);
        var (owner, _) = await api.RegisterCustomerAsync();
        var (stranger, _) = await api.RegisterCustomerAsync();
        var order = await (await Checkout(owner, NewKey(), [new(product.Id, 1)])).ReadAsync<OrderDetailDto>();

        var response = await stranger.GetAsync($"/api/orders/{order.Id}", Ct);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Customer_cancellation_returns_stock_and_is_not_repeatable()
    {
        var product = await api.CreateProductAsync(stock: 5);
        var (client, _) = await api.RegisterCustomerAsync();
        var order = await (await Checkout(client, NewKey(), [new(product.Id, 2)])).ReadAsync<OrderDetailDto>();

        var cancel = await client.PostAsync($"/api/orders/{order.Id}/cancel", null, Ct);
        var again = await client.PostAsync($"/api/orders/{order.Id}/cancel", null, Ct);

        Assert.Equal(OrderStatus.Cancelled, (await cancel.ReadAsync<OrderDetailDto>()).Status);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, again.StatusCode);
        Assert.Equal(5, await api.GetStockAsync(product.Id));
    }

    internal static string NewKey() => Guid.NewGuid().ToString("N");

    internal static async Task<HttpResponseMessage> Checkout(
        HttpClient client, string key, CartLineRequest[] items, string paymentToken = PaymentSimulator.ApprovedToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/orders")
        {
            Content = JsonContent.Create(new CheckoutRequest(items, Address, paymentToken), options: ApiFixture.Json),
        };
        request.Headers.Add(OrdersController.IdempotencyHeader, key);
        return await client.SendAsync(request, Ct);
    }
}
