using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Shop.Api.Domain;
using Shop.Api.Features.Admin;
using Shop.Api.Features.Catalog;
using Shop.Api.Features.Orders;

namespace Shop.Api.IntegrationTests;

public sealed class AdminApiTests(ApiFixture api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Admin_can_create_and_update_a_product_with_audit_records()
    {
        var admin = await api.LoginAdminAsync();
        var categoryId = await api.QueryAsync(db => db.Categories.Select(c => c.Id).FirstAsync(Ct));
        var name = $"Admin Product {Guid.NewGuid():N}";

        var created = await admin.PostAsJsonAsync("/api/admin/products", new CreateProductRequest(
            new SaveProductRequest(name, null, "Created by a test", "TestBrand", 49.99m, categoryId, null, true), InitialStock: 7), Ct);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var product = await created.ReadAsync<AdminProductDto>();

        var updated = await admin.PutAsJsonAsync($"/api/admin/products/{product.Id}", new UpdateProductRequest(
            new SaveProductRequest(name + " v2", product.Slug, product.Description, product.Brand, 59.99m, categoryId, null, true), product.Version), Ct);
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        Assert.Equal(59.99m, (await updated.ReadAsync<AdminProductDto>()).Price);

        var actions = await api.QueryAsync(db => db.AuditLog.Where(a => a.EntityType == "Product" && a.EntityId == product.Id.ToString())
            .Select(a => a.Action).ToListAsync(Ct));
        Assert.Contains("product.created", actions);
        Assert.Contains("product.updated", actions);
    }

    [Fact]
    public async Task Stale_version_update_is_rejected_with_conflict()
    {
        var admin = await api.LoginAdminAsync();
        var product = await api.CreateProductAsync(stock: 3);
        var loaded = await (await admin.GetAsync($"/api/admin/products/{product.Id}", Ct)).ReadAsync<AdminProductDto>();
        var input = new SaveProductRequest(loaded.Name, loaded.Slug, loaded.Description, loaded.Brand, 11m, loaded.CategoryId, null, true);

        var first = await admin.PutAsJsonAsync($"/api/admin/products/{product.Id}", new UpdateProductRequest(input, loaded.Version), Ct);
        var second = await admin.PutAsJsonAsync($"/api/admin/products/{product.Id}", new UpdateProductRequest(input with { Price = 12m }, loaded.Version), Ct);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Equal("concurrency_conflict", await second.ReadProblemCodeAsync());
    }

    [Fact]
    public async Task A_checkout_does_not_cause_a_false_conflict_for_an_admin_editing_details()
    {
        var admin = await api.LoginAdminAsync();
        var product = await api.CreateProductAsync(stock: 3);
        var loaded = await (await admin.GetAsync($"/api/admin/products/{product.Id}", Ct)).ReadAsync<AdminProductDto>();
        var (customer, _) = await api.RegisterCustomerAsync();
        await CheckoutApiTests.Checkout(customer, CheckoutApiTests.NewKey(), [new CartLineRequest(product.Id, 1)]);

        var update = await admin.PutAsJsonAsync($"/api/admin/products/{product.Id}", new UpdateProductRequest(
            new SaveProductRequest(loaded.Name, loaded.Slug, loaded.Description, loaded.Brand, 99m, loaded.CategoryId, null, true), loaded.Version), Ct);

        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        var saved = await update.ReadAsync<AdminProductDto>();
        Assert.Equal(99m, saved.Price);
        Assert.Equal(2, saved.StockQuantity); // the concurrent stock decrement is preserved, not overwritten
        Assert.Equal(loaded.Version + 1, saved.Version);
    }

    [Fact]
    public async Task Stock_adjustments_are_relative_and_cannot_go_negative()
    {
        var admin = await api.LoginAdminAsync();
        var product = await api.CreateProductAsync(stock: 4);

        var add = await admin.PostAsJsonAsync($"/api/admin/products/{product.Id}/stock-adjustments", new StockAdjustmentRequest(6, "Delivery received"), Ct);
        var tooMuch = await admin.PostAsJsonAsync($"/api/admin/products/{product.Id}/stock-adjustments", new StockAdjustmentRequest(-11, "Shrinkage"), Ct);

        Assert.Equal(10, (await add.ReadAsync<StockAdjustmentResult>()).StockQuantity);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, tooMuch.StatusCode);
        Assert.Equal("stock_would_be_negative", await tooMuch.ReadProblemCodeAsync());
        Assert.Equal(10, await api.GetStockAsync(product.Id));
    }

    [Fact]
    public async Task Order_status_follows_the_state_machine_and_cancellation_restocks()
    {
        var admin = await api.LoginAdminAsync();
        var product = await api.CreateProductAsync(stock: 5);
        var (customer, _) = await api.RegisterCustomerAsync();
        var order = await (await CheckoutApiTests.Checkout(customer, CheckoutApiTests.NewKey(), [new CartLineRequest(product.Id, 2)]))
            .ReadAsync<OrderDetailDto>();

        var skip = await admin.PostAsJsonAsync($"/api/admin/orders/{order.Id}/status", new ChangeOrderStatusRequest(OrderStatus.Delivered), Ct);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, skip.StatusCode);
        Assert.Equal("invalid_status_transition", await skip.ReadProblemCodeAsync());

        var cancelled = await admin.PostAsJsonAsync($"/api/admin/orders/{order.Id}/status", new ChangeOrderStatusRequest(OrderStatus.Cancelled), Ct);
        Assert.Equal(OrderStatus.Cancelled, (await cancelled.ReadAsync<OrderDetailDto>()).Status);
        Assert.Equal(5, await api.GetStockAsync(product.Id));
    }

    [Fact]
    public async Task Admin_ships_and_delivers_then_customer_can_review()
    {
        var admin = await api.LoginAdminAsync();
        var product = await api.CreateProductAsync(stock: 5);
        var (customer, _) = await api.RegisterCustomerAsync();

        var beforePurchase = await customer.PostAsJsonAsync($"/api/catalog/products/{product.Id}/reviews", new CreateReviewRequest(5, "Great"), Ct);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, beforePurchase.StatusCode);
        Assert.Equal("review_requires_purchase", await beforePurchase.ReadProblemCodeAsync());

        var order = await (await CheckoutApiTests.Checkout(customer, CheckoutApiTests.NewKey(), [new CartLineRequest(product.Id, 1)]))
            .ReadAsync<OrderDetailDto>();
        await admin.PostAsJsonAsync($"/api/admin/orders/{order.Id}/status", new ChangeOrderStatusRequest(OrderStatus.Shipped), Ct);
        var delivered = await admin.PostAsJsonAsync($"/api/admin/orders/{order.Id}/status", new ChangeOrderStatusRequest(OrderStatus.Delivered), Ct);
        Assert.Equal(OrderStatus.Delivered, (await delivered.ReadAsync<OrderDetailDto>()).Status);

        var review = await customer.PostAsJsonAsync($"/api/catalog/products/{product.Id}/reviews", new CreateReviewRequest(4, "Solid"), Ct);
        var duplicate = await customer.PostAsJsonAsync($"/api/catalog/products/{product.Id}/reviews", new CreateReviewRequest(5, "Again"), Ct);

        Assert.Equal(HttpStatusCode.Created, review.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        var stats = await api.QueryAsync(db => db.Products.Where(p => p.Id == product.Id).Select(p => new { p.ReviewCount, p.AverageRating }).SingleAsync(Ct));
        Assert.Equal(1, stats.ReviewCount);
        Assert.Equal(4m, stats.AverageRating);
    }

    [Fact]
    public async Task Dashboard_reports_kpis()
    {
        var admin = await api.LoginAdminAsync();

        var dashboard = await (await admin.GetAsync("/api/admin/dashboard", Ct)).ReadAsync<DashboardDto>();

        Assert.True(dashboard.OrderCount > 0);
        Assert.True(dashboard.Revenue > 0);
        Assert.True(dashboard.CustomerCount >= 3);
        Assert.Equal(Enum.GetNames<OrderStatus>().Order(), dashboard.OrdersByStatus.Keys.Order());
    }

    [Fact]
    public async Task Category_with_products_cannot_be_deleted()
    {
        var admin = await api.LoginAdminAsync();
        var categoryId = await api.QueryAsync(db => db.Categories.Where(c => c.Products.Any()).Select(c => c.Id).FirstAsync(Ct));

        var response = await admin.DeleteAsync($"/api/admin/categories/{categoryId}", Ct);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("category_not_empty", await response.ReadProblemCodeAsync());
    }

    [Fact]
    public async Task Wishlist_add_is_idempotent_and_remove_works()
    {
        var product = await api.CreateProductAsync(stock: 1);
        var (customer, _) = await api.RegisterCustomerAsync();

        await customer.PutAsync($"/api/wishlist/{product.Id}", null, Ct);
        await customer.PutAsync($"/api/wishlist/{product.Id}", null, Ct);
        var afterAdd = await (await customer.GetAsync("/api/wishlist", Ct)).ReadAsync<List<ProductSummaryDto>>();
        await customer.DeleteAsync($"/api/wishlist/{product.Id}", Ct);
        var afterRemove = await (await customer.GetAsync("/api/wishlist", Ct)).ReadAsync<List<ProductSummaryDto>>();

        Assert.Single(afterAdd, p => p.Id == product.Id);
        Assert.DoesNotContain(afterRemove, p => p.Id == product.Id);
    }
}
