namespace Shop.Api.Domain;

public sealed class Product
{
    private Product()
    {
    }

    public Product(
        string name,
        string slug,
        string description,
        string brand,
        decimal price,
        int stockQuantity,
        int categoryId,
        string? imageUrl,
        DateTimeOffset now,
        bool isActive = true)
    {
        if (stockQuantity < 0)
        {
            throw AppException.BusinessRule("invalid_stock", "Stock quantity cannot be negative.");
        }

        UpdateDetails(name, slug, description, brand, price, categoryId, imageUrl, isActive, now);
        StockQuantity = stockQuantity;
        CreatedAt = now;
    }

    public int Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Slug { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string Brand { get; private set; } = string.Empty;

    /// <summary>Unit price in the store currency. Stored as numeric(12,2).</summary>
    public decimal Price { get; private set; }

    /// <summary>
    /// Units available for sale. Checkout decrements it with a conditional atomic UPDATE,
    /// and a CHECK constraint guarantees it never becomes negative.
    /// </summary>
    public int StockQuantity { get; private set; }

    public string? ImageUrl { get; private set; }

    /// <summary>Inactive products are hidden from the storefront but kept for order history.</summary>
    public bool IsActive { get; private set; }

    public int CategoryId { get; private set; }
    public Category Category { get; private set; } = null!;

    /// <summary>
    /// Denormalized for cheap sorting/filtering by rating. The exact integer total is kept so the
    /// average never accumulates rounding drift. Maintained by <see cref="ApplyReview"/> (new entities)
    /// and by an atomic SQL update in ReviewService (existing rows).
    /// </summary>
    public decimal AverageRating { get; private set; }
    public int ReviewCount { get; private set; }
    public int RatingTotal { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    /// <summary>
    /// Optimistic concurrency token for the editable DETAILS only, incremented by <see cref="UpdateDetails"/>.
    /// Deliberately not xmin: stock and rating change on every checkout and review through atomic
    /// relative updates, and an admin editing a description must not get a conflict for those.
    /// </summary>
    public int Version { get; private set; }

    public List<Review> Reviews { get; private set; } = [];

    public void UpdateDetails(
        string name,
        string slug,
        string description,
        string brand,
        decimal price,
        int categoryId,
        string? imageUrl,
        bool isActive,
        DateTimeOffset now)
    {
        if (price <= 0)
        {
            throw AppException.BusinessRule("invalid_price", "Price must be greater than zero.");
        }

        if (decimal.Round(price, 2) != price)
        {
            throw AppException.BusinessRule("invalid_price", "Price cannot have more than two decimal places.");
        }

        Name = name.Trim();
        Slug = Slugs.Normalize(slug);
        Description = description.Trim();
        Brand = brand.Trim();
        Price = price;
        CategoryId = categoryId;
        ImageUrl = string.IsNullOrWhiteSpace(imageUrl) ? null : imageUrl.Trim();
        IsActive = isActive;
        UpdatedAt = now;
        Version++;
    }

    public void ApplyReview(int rating)
    {
        RatingTotal += rating;
        ReviewCount++;
        AverageRating = AverageOf(RatingTotal, ReviewCount);
    }

    public static decimal AverageOf(int ratingTotal, int reviewCount) =>
        reviewCount == 0 ? 0 : decimal.Round((decimal)ratingTotal / reviewCount, 2);
}
