using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shop.Api.Domain;
using Shop.Api.Features.Catalog;
using Shop.Api.Infrastructure.Auth;
using Shop.Api.Infrastructure.Persistence;

namespace Shop.Api.Features.Wishlist;

/// <summary>
/// Small enough that a separate service class would only forward calls, so the controller talks to the
/// DbContext directly. Larger workflows (checkout, admin) use dedicated services.
/// </summary>
[ApiController]
[Authorize]
[Route("api/wishlist")]
public sealed class WishlistController(ShopDbContext db, TimeProvider clock) : ControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<ProductSummaryDto>> Get(CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        return await db.WishlistItems
            .AsNoTracking()
            .Where(w => w.UserId == userId && w.Product.IsActive)
            .OrderByDescending(w => w.AddedAt)
            .Select(w => new ProductSummaryDto(
                w.Product.Id,
                w.Product.Name,
                w.Product.Slug,
                w.Product.Brand,
                w.Product.Price,
                w.Product.ImageUrl,
                w.Product.Category.Slug,
                w.Product.Category.Name,
                w.Product.StockQuantity,
                w.Product.AverageRating,
                w.Product.ReviewCount))
            .ToListAsync(cancellationToken);
    }

    /// <summary>Idempotent: adding an item that is already in the wishlist is a no-op.</summary>
    [HttpPut("{productId:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Add(int productId, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        if (!await db.Products.AnyAsync(p => p.Id == productId && p.IsActive, cancellationToken))
        {
            throw AppException.NotFound("Product", productId);
        }

        if (!await db.WishlistItems.AnyAsync(w => w.UserId == userId && w.ProductId == productId, cancellationToken))
        {
            db.WishlistItems.Add(new WishlistItem(userId, productId, clock.GetUtcNow()));
            try
            {
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException ex) when (ex.IsUniqueViolation())
            {
                // A concurrent request added it first: the desired end state already holds.
            }
        }

        return NoContent();
    }

    [HttpDelete("{productId:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Remove(int productId, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        await db.WishlistItems.Where(w => w.UserId == userId && w.ProductId == productId).ExecuteDeleteAsync(cancellationToken);
        return NoContent();
    }
}
