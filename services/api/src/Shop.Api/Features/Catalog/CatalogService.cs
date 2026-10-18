using Microsoft.EntityFrameworkCore;
using Shop.Api.Domain;
using Shop.Api.Features.Shared;
using Shop.Api.Infrastructure.Persistence;

namespace Shop.Api.Features.Catalog;

/// <summary>
/// Read side of the storefront. Every query is AsNoTracking and projects straight into DTOs,
/// so EF Core generates a single SELECT with only the needed columns (no N+1, no entity tracking cost).
/// </summary>
public sealed class CatalogService(ShopDbContext db)
{
    public async Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(CancellationToken cancellationToken) =>
        await db.Categories
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .Select(c => new CategoryDto(c.Id, c.Name, c.Slug, c.Description, c.Products.Count(p => p.IsActive)))
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<string>> GetBrandsAsync(string? categorySlug, CancellationToken cancellationToken)
    {
        var products = db.Products.AsNoTracking().Where(p => p.IsActive);
        if (!string.IsNullOrWhiteSpace(categorySlug))
        {
            products = products.Where(p => p.Category.Slug == categorySlug);
        }

        return await products.Select(p => p.Brand).Distinct().OrderBy(b => b).ToListAsync(cancellationToken);
    }

    public Task<PagedResult<ProductSummaryDto>> SearchProductsAsync(ProductQuery query, CancellationToken cancellationToken)
    {
        var products = db.Products.AsNoTracking().Where(p => p.IsActive);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = $"%{EscapeLikePattern(query.Search.Trim())}%";
            products = products.Where(p =>
                EF.Functions.ILike(p.Name, pattern, @"\") || EF.Functions.ILike(p.Brand, pattern, @"\"));
        }

        if (!string.IsNullOrWhiteSpace(query.Category))
        {
            products = products.Where(p => p.Category.Slug == query.Category);
        }

        if (!string.IsNullOrWhiteSpace(query.Brand))
        {
            products = products.Where(p => p.Brand == query.Brand);
        }

        if (query.MinPrice is { } min)
        {
            products = products.Where(p => p.Price >= min);
        }

        if (query.MaxPrice is { } max)
        {
            products = products.Where(p => p.Price <= max);
        }

        if (query.InStock == true)
        {
            products = products.Where(p => p.StockQuantity > 0);
        }

        // Always end with a unique key so that pages are deterministic when sort values tie.
        products = query.Sort switch
        {
            ProductSort.PriceAsc => products.OrderBy(p => p.Price).ThenBy(p => p.Id),
            ProductSort.PriceDesc => products.OrderByDescending(p => p.Price).ThenBy(p => p.Id),
            ProductSort.Name => products.OrderBy(p => p.Name).ThenBy(p => p.Id),
            ProductSort.Rating => products.OrderByDescending(p => p.AverageRating).ThenByDescending(p => p.ReviewCount).ThenBy(p => p.Id),
            _ => products.OrderByDescending(p => p.CreatedAt).ThenByDescending(p => p.Id),
        };

        return products
            .Select(p => new ProductSummaryDto(
                p.Id,
                p.Name,
                p.Slug,
                p.Brand,
                p.Price,
                p.ImageUrl,
                p.Category.Slug,
                p.Category.Name,
                p.StockQuantity,
                p.AverageRating,
                p.ReviewCount))
            .ToPagedResultAsync(query.Page, query.PageSize, cancellationToken);
    }

    public async Task<ProductDetailDto> GetProductAsync(string slug, CancellationToken cancellationToken) =>
        await db.Products
            .AsNoTracking()
            .Where(p => p.Slug == slug && p.IsActive)
            .Select(p => new ProductDetailDto(
                p.Id,
                p.Name,
                p.Slug,
                p.Description,
                p.Brand,
                p.Price,
                p.ImageUrl,
                p.CategoryId,
                p.Category.Slug,
                p.Category.Name,
                p.StockQuantity,
                p.AverageRating,
                p.ReviewCount))
            .SingleOrDefaultAsync(cancellationToken)
        ?? throw AppException.NotFound("Product", slug);

    public Task<PagedResult<ReviewDto>> GetReviewsAsync(int productId, int page, int pageSize, CancellationToken cancellationToken) =>
        db.Reviews
            .AsNoTracking()
            .Where(r => r.ProductId == productId)
            .OrderByDescending(r => r.CreatedAt)
            .ThenByDescending(r => r.Id)
            .Select(r => new ReviewDto(r.Id, r.Rating, r.Comment, r.User.FullName, r.CreatedAt))
            .ToPagedResultAsync(page, pageSize, cancellationToken);

    /// <summary>User input must never be interpreted as LIKE wildcards.</summary>
    internal static string EscapeLikePattern(string value) =>
        value.Replace(@"\", @"\\").Replace("%", @"\%").Replace("_", @"\_");
}
