using Microsoft.EntityFrameworkCore;
using Shop.Api.Domain;
using Shop.Api.Features.Catalog;
using Shop.Api.Features.Shared;
using Shop.Api.Infrastructure.Audit;
using Shop.Api.Infrastructure.Persistence;

namespace Shop.Api.Features.Admin;

public sealed class AdminCatalogService(ShopDbContext db, AuditLogger audit, TimeProvider clock)
{
    public Task<PagedResult<AdminProductDto>> GetProductsAsync(AdminProductQuery query, CancellationToken cancellationToken)
    {
        var products = db.Products.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = $"%{CatalogService.EscapeLikePattern(query.Search.Trim())}%";
            products = products.Where(p => EF.Functions.ILike(p.Name, pattern, @"\") || EF.Functions.ILike(p.Slug, pattern, @"\"));
        }

        if (query.LowStockOnly == true)
        {
            products = products.Where(p => p.StockQuantity <= AdminDefaults.LowStockThreshold);
        }

        return products
            .OrderBy(p => p.Name)
            .ThenBy(p => p.Id)
            .Select(ToDto)
            .ToPagedResultAsync(query.Page, query.PageSize, cancellationToken);
    }

    public async Task<AdminProductDto> GetProductAsync(int id, CancellationToken cancellationToken) =>
        await db.Products.AsNoTracking().Where(p => p.Id == id).Select(ToDto).SingleOrDefaultAsync(cancellationToken)
        ?? throw AppException.NotFound("Product", id);

    public async Task<AdminProductDto> CreateProductAsync(Guid adminId, CreateProductRequest request, CancellationToken cancellationToken)
    {
        var input = request.Product;
        await EnsureCategoryExistsAsync(input.CategoryId, cancellationToken);
        var slug = Slugs.Normalize(string.IsNullOrWhiteSpace(input.Slug) ? input.Name : input.Slug);
        await EnsureSlugAvailableAsync(slug, exceptProductId: null, cancellationToken);

        var product = new Product(
            input.Name, slug, input.Description, input.Brand, input.Price, request.InitialStock, input.CategoryId,
            ValidateImageUrl(input.ImageUrl), clock.GetUtcNow(), input.IsActive);

        // Two saves (the audit entry needs the generated id) inside one transaction keep them atomic.
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.Products.Add(product);
        await SaveUniqueAsync(cancellationToken);
        audit.Record(adminId, "product.created", "Product", product.Id, new { product.Name, product.Price, request.InitialStock });
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return await GetProductAsync(product.Id, cancellationToken);
    }

    public async Task<AdminProductDto> UpdateProductAsync(Guid adminId, int id, UpdateProductRequest request, CancellationToken cancellationToken)
    {
        var input = request.Product;
        var product = await db.Products.SingleOrDefaultAsync(p => p.Id == id, cancellationToken)
            ?? throw AppException.NotFound("Product", id);

        // Optimistic concurrency: EF adds "WHERE version = @version" to the UPDATE. If another admin saved
        // the details since this client loaded them, zero rows match and SaveChanges throws
        // DbUpdateConcurrencyException, which the global handler maps to 409. Stock and rating changes do
        // not touch the version, so checkouts never cause false conflicts here.
        db.Entry(product).Property(p => p.Version).OriginalValue = request.Version;

        await EnsureCategoryExistsAsync(input.CategoryId, cancellationToken);
        var slug = Slugs.Normalize(string.IsNullOrWhiteSpace(input.Slug) ? input.Name : input.Slug);
        await EnsureSlugAvailableAsync(slug, exceptProductId: id, cancellationToken);

        var before = new { product.Name, product.Price, product.IsActive, product.CategoryId };
        product.UpdateDetails(input.Name, slug, input.Description, input.Brand, input.Price, input.CategoryId,
            ValidateImageUrl(input.ImageUrl), input.IsActive, clock.GetUtcNow());

        audit.Record(adminId, "product.updated", "Product", product.Id,
            new { before, after = new { product.Name, product.Price, product.IsActive, product.CategoryId } });
        await SaveUniqueAsync(cancellationToken);
        return await GetProductAsync(product.Id, cancellationToken);
    }

    /// <summary>
    /// Inventory changes are relative and atomic ("stock = stock + delta WHERE stock + delta >= 0"),
    /// so they compose correctly with concurrent checkouts instead of overwriting them.
    /// </summary>
    public async Task<StockAdjustmentResult> AdjustStockAsync(
        Guid adminId, int productId, StockAdjustmentRequest request, CancellationToken cancellationToken)
    {
        if (request.Delta == 0)
        {
            throw AppException.BusinessRule("invalid_adjustment", "Adjustment delta must not be zero.");
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        var updated = await db.Products
            .Where(p => p.Id == productId && p.StockQuantity + request.Delta >= 0)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.StockQuantity, p => p.StockQuantity + request.Delta)
                .SetProperty(p => p.UpdatedAt, clock.GetUtcNow()), cancellationToken);

        if (updated == 0)
        {
            if (!await db.Products.AnyAsync(p => p.Id == productId, cancellationToken))
            {
                throw AppException.NotFound("Product", productId);
            }

            throw AppException.BusinessRule("stock_would_be_negative", "The adjustment would make stock negative.");
        }

        var stock = await db.Products.Where(p => p.Id == productId).Select(p => p.StockQuantity).SingleAsync(cancellationToken);
        audit.Record(adminId, "inventory.adjusted", "Product", productId, new { request.Delta, request.Reason, newStock = stock });
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return new StockAdjustmentResult(productId, stock);
    }

    public async Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(CancellationToken cancellationToken) =>
        await db.Categories
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .Select(c => new CategoryDto(c.Id, c.Name, c.Slug, c.Description, c.Products.Count))
            .ToListAsync(cancellationToken);

    public async Task<CategoryDto> CreateCategoryAsync(Guid adminId, SaveCategoryRequest request, CancellationToken cancellationToken)
    {
        var category = new Category(request.Name, string.IsNullOrWhiteSpace(request.Slug) ? request.Name : request.Slug, request.Description);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.Categories.Add(category);
        await SaveUniqueAsync(cancellationToken);
        audit.Record(adminId, "category.created", "Category", category.Id, new { category.Name, category.Slug });
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new CategoryDto(category.Id, category.Name, category.Slug, category.Description, 0);
    }

    public async Task<CategoryDto> UpdateCategoryAsync(Guid adminId, int id, SaveCategoryRequest request, CancellationToken cancellationToken)
    {
        var category = await db.Categories.SingleOrDefaultAsync(c => c.Id == id, cancellationToken)
            ?? throw AppException.NotFound("Category", id);
        category.Rename(request.Name, string.IsNullOrWhiteSpace(request.Slug) ? request.Name : request.Slug, request.Description);
        audit.Record(adminId, "category.updated", "Category", category.Id, new { category.Name, category.Slug });
        await SaveUniqueAsync(cancellationToken);
        var count = await db.Products.CountAsync(p => p.CategoryId == id, cancellationToken);
        return new CategoryDto(category.Id, category.Name, category.Slug, category.Description, count);
    }

    public async Task DeleteCategoryAsync(Guid adminId, int id, CancellationToken cancellationToken)
    {
        var category = await db.Categories.SingleOrDefaultAsync(c => c.Id == id, cancellationToken)
            ?? throw AppException.NotFound("Category", id);
        if (await db.Products.AnyAsync(p => p.CategoryId == id, cancellationToken))
        {
            throw AppException.Conflict("category_not_empty", "Move or archive the products of this category first.");
        }

        db.Categories.Remove(category);
        audit.Record(adminId, "category.deleted", "Category", id, new { category.Name });
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureCategoryExistsAsync(int categoryId, CancellationToken cancellationToken)
    {
        if (!await db.Categories.AnyAsync(c => c.Id == categoryId, cancellationToken))
        {
            throw AppException.BusinessRule("category_not_found", $"Category {categoryId} does not exist.");
        }
    }

    private async Task EnsureSlugAvailableAsync(string slug, int? exceptProductId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(slug))
        {
            throw AppException.BusinessRule("invalid_slug", "The slug must contain letters or digits.");
        }

        if (await db.Products.AnyAsync(p => p.Slug == slug && p.Id != exceptProductId, cancellationToken))
        {
            throw AppException.Conflict("slug_taken", $"Another product already uses the slug '{slug}'.");
        }
    }

    /// <summary>Only https URLs or site-relative paths: blocks javascript:, data: and plain-http mixed content.</summary>
    internal static string? ValidateImageUrl(string? imageUrl)
    {
        if (string.IsNullOrWhiteSpace(imageUrl))
        {
            return null;
        }

        var value = imageUrl.Trim();
        var isRelative = value.StartsWith('/') && !value.StartsWith("//", StringComparison.Ordinal);
        var isHttps = Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps;
        if (!isRelative && !isHttps)
        {
            throw AppException.BusinessRule("invalid_image_url", "Image URL must be an https URL or a site-relative path.");
        }

        return value;
    }

    private async Task SaveUniqueAsync(CancellationToken cancellationToken)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.IsUniqueViolation())
        {
            throw AppException.Conflict("duplicate_value", "A record with the same name or slug already exists.");
        }
    }

    private static readonly System.Linq.Expressions.Expression<Func<Product, AdminProductDto>> ToDto = p => new AdminProductDto(
        p.Id, p.Name, p.Slug, p.Description, p.Brand, p.Price, p.StockQuantity, p.ImageUrl, p.IsActive,
        p.CategoryId, p.Category.Name, p.Version, p.UpdatedAt);
}
