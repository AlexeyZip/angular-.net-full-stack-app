using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shop.Api.Features.Shared;
using Shop.Api.Infrastructure.Auth;

namespace Shop.Api.Features.Catalog;

[ApiController]
[Route("api/catalog")]
public sealed class CatalogController(CatalogService catalog, ReviewService reviews) : ControllerBase
{
    [HttpGet("categories")]
    public Task<IReadOnlyList<CategoryDto>> GetCategories(CancellationToken cancellationToken) =>
        catalog.GetCategoriesAsync(cancellationToken);

    [HttpGet("brands")]
    public Task<IReadOnlyList<string>> GetBrands([FromQuery, MaxLength(120)] string? category, CancellationToken cancellationToken) =>
        catalog.GetBrandsAsync(category, cancellationToken);

    /// <summary>Search, filter, sort and paginate active products.</summary>
    [HttpGet("products")]
    public Task<PagedResult<ProductSummaryDto>> GetProducts([FromQuery] ProductQuery query, CancellationToken cancellationToken) =>
        catalog.SearchProductsAsync(query, cancellationToken);

    [HttpGet("products/{slug}")]
    public Task<ProductDetailDto> GetProduct(string slug, CancellationToken cancellationToken) =>
        catalog.GetProductAsync(slug, cancellationToken);

    [HttpGet("products/{productId:int}/reviews")]
    public Task<PagedResult<ReviewDto>> GetReviews(
        int productId,
        [FromQuery, Range(1, 10_000)] int page = 1,
        [FromQuery, Range(1, 50)] int pageSize = 10,
        CancellationToken cancellationToken = default) =>
        catalog.GetReviewsAsync(productId, page, pageSize, cancellationToken);

    [Authorize]
    [HttpPost("products/{productId:int}/reviews")]
    [ProducesResponseType<ReviewDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<ReviewDto>> CreateReview(int productId, CreateReviewRequest request, CancellationToken cancellationToken)
    {
        var review = await reviews.CreateAsync(User.GetRequiredUserId(), productId, request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, review);
    }
}
