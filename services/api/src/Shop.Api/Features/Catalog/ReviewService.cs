using Microsoft.EntityFrameworkCore;
using Shop.Api.Domain;
using Shop.Api.Infrastructure.Persistence;

namespace Shop.Api.Features.Catalog;

public sealed class ReviewService(ShopDbContext db, TimeProvider clock)
{
    public async Task<ReviewDto> CreateAsync(Guid userId, int productId, CreateReviewRequest request, CancellationToken cancellationToken)
    {
        if (!await db.Products.AnyAsync(p => p.Id == productId && p.IsActive, cancellationToken))
        {
            throw AppException.NotFound("Product", productId);
        }

        var hasPurchased = await db.Orders.AnyAsync(
            o => o.UserId == userId && o.Status != OrderStatus.Cancelled && o.Items.Any(i => i.ProductId == productId),
            cancellationToken);
        if (!hasPurchased)
        {
            throw AppException.BusinessRule("review_requires_purchase", "Only customers who bought this product can review it.");
        }

        if (await db.Reviews.AnyAsync(r => r.ProductId == productId && r.UserId == userId, cancellationToken))
        {
            throw AppException.Conflict("review_exists", "You have already reviewed this product.");
        }

        var review = new Review(productId, userId, request.Rating, request.Comment, clock.GetUtcNow());
        db.Reviews.Add(review);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.IsUniqueViolation())
        {
            throw AppException.Conflict("review_exists", "You have already reviewed this product.");
        }

        // Relative atomic update of the denormalized rating: concurrent reviews of the same product
        // serialize on the row lock and both count - no lost update, no 409 for the customer.
        // All SET expressions read the pre-update row values.
        var rating = review.Rating;
        await db.Products
            .Where(p => p.Id == productId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.RatingTotal, p => p.RatingTotal + rating)
                .SetProperty(p => p.ReviewCount, p => p.ReviewCount + 1)
                .SetProperty(p => p.AverageRating, p => Math.Round((decimal)(p.RatingTotal + rating) / (p.ReviewCount + 1), 2)),
                cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var authorName = await db.Users.Where(u => u.Id == userId).Select(u => u.FullName).SingleAsync(cancellationToken);
        return new ReviewDto(review.Id, review.Rating, review.Comment, authorName, review.CreatedAt);
    }
}
