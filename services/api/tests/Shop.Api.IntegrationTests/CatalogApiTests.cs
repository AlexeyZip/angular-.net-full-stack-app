using System.Net;
using Shop.Api.Features.Catalog;
using Shop.Api.Features.Shared;

namespace Shop.Api.IntegrationTests;

public sealed class CatalogApiTests(ApiFixture api)
{
    private readonly HttpClient _client = api.CreateClient();

    [Fact]
    public async Task Seeded_categories_are_listed_with_product_counts()
    {
        var categories = await (await _client.GetAsync("/api/catalog/categories", TestContext.Current.CancellationToken))
            .ReadAsync<List<CategoryDto>>();

        Assert.True(categories.Count >= 8);
        Assert.Contains(categories, c => c.Slug == "laptops" && c.ProductCount >= 8);
    }

    [Fact]
    public async Task Products_are_paginated_on_the_server()
    {
        var page1 = await GetProducts("?pageSize=5&page=1&sort=name");
        var page2 = await GetProducts("?pageSize=5&page=2&sort=name");

        Assert.Equal(5, page1.Items.Count);
        Assert.Equal(5, page2.Items.Count);
        Assert.True(page1.TotalCount >= 64);
        Assert.Equal((int)Math.Ceiling(page1.TotalCount / 5.0), page1.TotalPages);
        Assert.Empty(page1.Items.Select(p => p.Id).Intersect(page2.Items.Select(p => p.Id)));
    }

    [Fact]
    public async Task Filters_and_sorting_are_applied_together()
    {
        var result = await GetProducts("?category=audio&minPrice=50&maxPrice=500&sort=priceAsc&pageSize=48");

        Assert.NotEmpty(result.Items);
        Assert.All(result.Items, p =>
        {
            Assert.Equal("audio", p.CategorySlug);
            Assert.InRange(p.Price, 50m, 500m);
        });
        Assert.Equal(result.Items.Select(p => p.Price).Order(), result.Items.Select(p => p.Price));
    }

    [Fact]
    public async Task Search_is_case_insensitive_and_treats_wildcards_literally()
    {
        var matches = await GetProducts("?search=NORTHWIND&pageSize=48");
        var wildcard = await GetProducts("?search=%25&pageSize=48");

        Assert.NotEmpty(matches.Items);
        Assert.All(matches.Items, p => Assert.Contains("northwind", (p.Name + p.Brand).ToLowerInvariant()));
        Assert.Empty(wildcard.Items);
    }

    [Fact]
    public async Task In_stock_filter_excludes_sold_out_products()
    {
        var result = await GetProducts("?inStock=true&pageSize=48");

        Assert.All(result.Items, p => Assert.True(p.AvailableQuantity > 0));
    }

    [Fact]
    public async Task Invalid_query_returns_validation_problem()
    {
        var response = await _client.GetAsync("/api/catalog/products?pageSize=1000&minPrice=10&maxPrice=5", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("validation_failed", await response.ReadProblemCodeAsync());
    }

    [Fact]
    public async Task Unknown_product_returns_not_found_problem()
    {
        var response = await _client.GetAsync("/api/catalog/products/does-not-exist", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("not_found", await response.ReadProblemCodeAsync());
    }

    [Fact]
    public async Task Product_detail_is_found_by_slug()
    {
        var first = (await GetProducts("?pageSize=1")).Items.Single();

        var detail = await (await _client.GetAsync($"/api/catalog/products/{first.Slug}", TestContext.Current.CancellationToken))
            .ReadAsync<ProductDetailDto>();

        Assert.Equal(first.Id, detail.Id);
        Assert.False(string.IsNullOrWhiteSpace(detail.Description));
    }

    private async Task<PagedResult<ProductSummaryDto>> GetProducts(string query)
    {
        var response = await _client.GetAsync($"/api/catalog/products{query}", TestContext.Current.CancellationToken);
        response.EnsureSuccessStatusCode();
        return await response.ReadAsync<PagedResult<ProductSummaryDto>>();
    }
}
