using System.ComponentModel.DataAnnotations;

namespace Shop.Api.Features.Catalog;

public enum ProductSort
{
    Newest,
    PriceAsc,
    PriceDesc,
    Name,
    Rating,
}

/// <summary>Query-string parameters for the product listing. Validated by [ApiController] before the action runs.</summary>
public sealed class ProductQuery : IValidatableObject
{
    [MaxLength(100)]
    public string? Search { get; init; }

    [MaxLength(120)]
    public string? Category { get; init; }

    [MaxLength(100)]
    public string? Brand { get; init; }

    [Range(0, 1_000_000)]
    public decimal? MinPrice { get; init; }

    [Range(0, 1_000_000)]
    public decimal? MaxPrice { get; init; }

    public bool? InStock { get; init; }

    public ProductSort Sort { get; init; } = ProductSort.Newest;

    [Range(1, 10_000)]
    public int Page { get; init; } = 1;

    [Range(1, 48)]
    public int PageSize { get; init; } = 12;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (MinPrice is not null && MaxPrice is not null && MinPrice > MaxPrice)
        {
            yield return new ValidationResult("MinPrice cannot be greater than MaxPrice.", [nameof(MinPrice), nameof(MaxPrice)]);
        }
    }
}

public sealed record CategoryDto(int Id, string Name, string Slug, string Description, int ProductCount);

public sealed record ProductSummaryDto(
    int Id,
    string Name,
    string Slug,
    string Brand,
    decimal Price,
    string? ImageUrl,
    string CategorySlug,
    string CategoryName,
    int AvailableQuantity,
    decimal AverageRating,
    int ReviewCount);

public sealed record ProductDetailDto(
    int Id,
    string Name,
    string Slug,
    string Description,
    string Brand,
    decimal Price,
    string? ImageUrl,
    int CategoryId,
    string CategorySlug,
    string CategoryName,
    int AvailableQuantity,
    decimal AverageRating,
    int ReviewCount);

public sealed record ReviewDto(int Id, int Rating, string Comment, string AuthorName, DateTimeOffset CreatedAt);

public sealed record CreateReviewRequest(
    [Range(1, 5)] int Rating,
    [Required, MaxLength(2000)] string Comment);
