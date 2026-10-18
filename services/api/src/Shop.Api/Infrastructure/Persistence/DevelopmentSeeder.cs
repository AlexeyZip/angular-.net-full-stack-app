using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Shop.Api.Domain;

namespace Shop.Api.Infrastructure.Persistence;

/// <summary>
/// Creates demo data for local development and tests. Additive and idempotent: each section only runs
/// when its data is missing, so re-running never duplicates or deletes anything.
/// The credentials below are public, for local use only, and use the reserved ".local" domain.
/// </summary>
public sealed class DevelopmentSeeder(ShopDbContext db, IPasswordHasher<User> passwordHasher, TimeProvider clock, ILogger<DevelopmentSeeder> logger)
{
    public const string AdminEmail = "admin@shop.local";
    public const string AdminPassword = "DevOnly-Admin-2026";
    public const string CustomerPassword = "DevOnly-Customer-2026";
    public static readonly string[] CustomerEmails = ["alice@shop.local", "bob@shop.local", "carol@shop.local"];

    private static readonly (string Name, string Description, string[] Brands, string[] Models, decimal MinPrice, decimal MaxPrice)[] Catalog =
    [
        ("Laptops", "Ultrabooks, workstations and everyday notebooks.", ["Northwind", "Contoso", "Fabrikam"], ["Air 13", "Pro 14", "Studio 16", "Flex 15", "Book 14", "Creator 16", "Edge 13", "Max 17"], 549m, 2899m),
        ("Smartphones", "Unlocked phones with the latest chipsets.", ["Lumen", "Contoso", "Pixelworks"], ["One", "Lite", "Pro", "Ultra", "Mini", "Fold", "Neo", "Plus"], 199m, 1499m),
        ("Audio", "Headphones, earbuds and speakers.", ["Sonora", "Northwind", "Bassline"], ["Studio Over-Ear", "Buds 3", "Pulse Speaker", "Commute ANC", "Arc Soundbar", "Mini Speaker", "Sport Buds", "Reference Monitors"], 29m, 799m),
        ("Cameras", "Mirrorless bodies, lenses and action cameras.", ["Optika", "Fabrikam"], ["M50 Body", "Z9 Mark II", "Action 4K", "35mm f/1.8 Lens", "Vlog Kit", "Instant Classic", "Drone Lite", "Compact Zoom"], 89m, 3499m),
        ("Wearables", "Smartwatches and fitness trackers.", ["Pulse", "Lumen"], ["Watch 5", "Fit Band", "Ring", "Watch Ultra", "Kids Tracker", "Trail GPS", "Sleep Band", "Watch SE"], 39m, 899m),
        ("Gaming", "Consoles, controllers and accessories.", ["Arcadia", "Contoso"], ["Console X", "Pro Controller", "Racing Wheel", "Headset 7.1", "Handheld", "Arcade Stick", "VR Headset", "Charging Dock"], 24m, 699m),
        ("Home Office", "Monitors, desks and productivity gear.", ["Ergonomia", "Northwind", "Fabrikam"], ["27\" 4K Monitor", "Standing Desk", "Ergo Chair", "Webcam HD", "Desk Lamp", "Ultrawide 34\"", "Docking Station", "Mic Arm"], 34m, 1199m),
        ("Accessories", "Cables, chargers, cases and storage.", ["Voltix", "Contoso"], ["65W Charger", "USB-C Hub", "Power Bank 20k", "SSD 1TB", "Laptop Sleeve", "Wireless Mouse", "Mechanical Keyboard", "HDMI 2.1 Cable"], 12m, 249m),
    ];

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        await SeedUsersAsync(cancellationToken);
        await SeedCatalogAsync(cancellationToken);
        await SeedOrdersAndReviewsAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);
    }

    private async Task SeedUsersAsync(CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var wanted = new List<(string Email, string Name, UserRole Role, string Password)>
        {
            (AdminEmail, "Store Admin", UserRole.Admin, AdminPassword),
            (CustomerEmails[0], "Alice Johnson", UserRole.Customer, CustomerPassword),
            (CustomerEmails[1], "Bob Smith", UserRole.Customer, CustomerPassword),
            (CustomerEmails[2], "Carol Martinez", UserRole.Customer, CustomerPassword),
        };

        var existing = await db.Users.Select(u => u.Email).ToListAsync(cancellationToken);
        foreach (var (email, name, role, password) in wanted.Where(w => !existing.Contains(w.Email)))
        {
            var user = new User(email, name, role, now);
            user.SetPasswordHash(passwordHasher.HashPassword(user, password));
            db.Users.Add(user);
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task SeedCatalogAsync(CancellationToken cancellationToken)
    {
        if (await db.Categories.AnyAsync(cancellationToken))
        {
            return;
        }

        var random = new Random(20261018); // deterministic: the same catalog on every machine
        var now = clock.GetUtcNow();
        var productIndex = 0;

        foreach (var (name, description, brands, models, minPrice, maxPrice) in Catalog)
        {
            var category = new Category(name, name, description);
            db.Categories.Add(category);
            await db.SaveChangesAsync(cancellationToken);

            foreach (var model in models)
            {
                var brand = brands[productIndex % brands.Length];
                var price = decimal.Round(minPrice + (decimal)random.NextDouble() * (maxPrice - minPrice), 0) - 0.01m;
                // A few products are sold out or nearly sold out to demonstrate stock rules in the UI.
                var stock = productIndex % 11 == 0 ? 0 : productIndex % 7 == 0 ? random.Next(1, 4) : random.Next(5, 120);
                var productName = $"{brand} {model}";

                db.Products.Add(new Product(
                    productName,
                    productName,
                    $"{productName} - {description} Designed by {brand}, backed by a two-year warranty.",
                    brand,
                    price,
                    stock,
                    category.Id,
                    imageUrl: null,
                    now.AddDays(-productIndex)));
                productIndex++;
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Seeded {Categories} categories and {Products} products", Catalog.Length, productIndex);
    }

    private async Task SeedOrdersAndReviewsAsync(CancellationToken cancellationToken)
    {
        if (await db.Orders.AnyAsync(cancellationToken))
        {
            return;
        }

        var customers = await db.Users.Where(u => CustomerEmails.Contains(u.Email)).OrderBy(u => u.Email).ToListAsync(cancellationToken);
        var products = await db.Products.Where(p => p.StockQuantity > 10).OrderBy(p => p.Id).Take(12).ToListAsync(cancellationToken);
        if (customers.Count == 0 || products.Count < 6)
        {
            return;
        }

        var now = clock.GetUtcNow();
        OrderStatus[] statuses = [OrderStatus.Delivered, OrderStatus.Shipped, OrderStatus.Paid, OrderStatus.Cancelled];
        var orderNumber = 0;

        foreach (var customer in customers)
        {
            for (var i = 0; i < 3; i++, orderNumber++)
            {
                var picked = products.Skip((orderNumber * 2) % (products.Count - 1)).Take(2).ToList();
                var items = picked.Select((p, index) => new OrderItem(p.Id, p.Name, p.Price, index + 1)).ToList();
                var price = Pricing.Calculate(items.Select(it => (it.UnitPrice, it.Quantity)));
                var createdAt = now.AddDays(-(40 - orderNumber * 3));

                var order = new Order(
                    customer.Id,
                    $"seed-{orderNumber:D4}-idempotency",
                    "seed",
                    new ShippingAddress(customer.FullName, $"{100 + orderNumber} Market Street", "Springfield", "12345", "US"),
                    items,
                    price,
                    $"sim_seed_{orderNumber:D4}",
                    createdAt);

                var target = statuses[orderNumber % statuses.Length];
                if (target is OrderStatus.Shipped or OrderStatus.Delivered)
                {
                    order.TransitionTo(OrderStatus.Shipped, createdAt.AddDays(1));
                }

                if (target is OrderStatus.Delivered)
                {
                    order.TransitionTo(OrderStatus.Delivered, createdAt.AddDays(3));
                }

                if (target is OrderStatus.Cancelled)
                {
                    order.TransitionTo(OrderStatus.Cancelled, createdAt.AddHours(2));
                }

                db.Orders.Add(order);

                if (target is OrderStatus.Delivered)
                {
                    var reviewed = picked[0];
                    var rating = 3 + orderNumber % 3;
                    db.Reviews.Add(new Review(reviewed.Id, customer.Id, rating, ReviewText(rating), createdAt.AddDays(5)));
                    reviewed.ApplyReview(rating);
                }
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Seeded {Orders} demo orders", orderNumber);
    }

    private static string ReviewText(int rating) => rating switch
    {
        5 => "Excellent quality, arrived quickly. Would buy again.",
        4 => "Very good overall; packaging could be better.",
        _ => "Does the job, but I expected a bit more for the price.",
    };
}
