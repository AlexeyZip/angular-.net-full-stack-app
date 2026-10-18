namespace Shop.Api.Domain;

public sealed class Review
{
    public const int MinRating = 1;
    public const int MaxRating = 5;

    private Review()
    {
    }

    public Review(int productId, Guid userId, int rating, string comment, DateTimeOffset now)
    {
        if (rating is < MinRating or > MaxRating)
        {
            throw AppException.BusinessRule("invalid_rating", $"Rating must be between {MinRating} and {MaxRating}.");
        }

        ProductId = productId;
        UserId = userId;
        Rating = rating;
        Comment = comment.Trim();
        CreatedAt = now;
    }

    public int Id { get; private set; }
    public int ProductId { get; private set; }
    public Product Product { get; private set; } = null!;
    public Guid UserId { get; private set; }
    public User User { get; private set; } = null!;
    public int Rating { get; private set; }
    public string Comment { get; private set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; private set; }
}
