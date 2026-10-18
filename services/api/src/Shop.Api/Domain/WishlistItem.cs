namespace Shop.Api.Domain;

/// <summary>Join entity between a user and a product (composite primary key).</summary>
public sealed class WishlistItem
{
    private WishlistItem()
    {
    }

    public WishlistItem(Guid userId, int productId, DateTimeOffset now)
    {
        UserId = userId;
        ProductId = productId;
        AddedAt = now;
    }

    public Guid UserId { get; private set; }
    public int ProductId { get; private set; }
    public Product Product { get; private set; } = null!;
    public DateTimeOffset AddedAt { get; private set; }
}
