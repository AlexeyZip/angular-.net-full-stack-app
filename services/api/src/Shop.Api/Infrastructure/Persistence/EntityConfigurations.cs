using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Shop.Api.Domain;
using Shop.Api.Infrastructure.Messaging;

namespace Shop.Api.Infrastructure.Persistence;

// Database invariants live here (CHECK, UNIQUE, FK) so they hold even if application code has a bug
// or someone writes SQL by hand. Application validation gives friendly errors; constraints give guarantees.

internal sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.Property(c => c.Name).HasMaxLength(100).IsRequired();
        builder.Property(c => c.Slug).HasMaxLength(120).IsRequired();
        builder.Property(c => c.Description).HasMaxLength(1000);
        builder.HasIndex(c => c.Slug).IsUnique();
        builder.HasIndex(c => c.Name).IsUnique();
    }
}

internal sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable(table =>
        {
            table.HasCheckConstraint("ck_products_stock_non_negative", "stock_quantity >= 0");
            table.HasCheckConstraint("ck_products_price_positive", "price > 0");
        });

        builder.Property(p => p.Name).HasMaxLength(200).IsRequired();
        builder.Property(p => p.Slug).HasMaxLength(220).IsRequired();
        builder.Property(p => p.Description).HasMaxLength(4000);
        builder.Property(p => p.Brand).HasMaxLength(100).IsRequired();
        builder.Property(p => p.Price).HasPrecision(12, 2);
        builder.Property(p => p.AverageRating).HasPrecision(3, 2);
        builder.Property(p => p.ImageUrl).HasMaxLength(500);
        builder.Property(p => p.Version).IsConcurrencyToken();

        builder.HasIndex(p => p.Slug).IsUnique();
        builder.HasIndex(p => new { p.CategoryId, p.Price });
        builder.HasIndex(p => p.Brand);
        builder.HasIndex(p => p.Name).HasMethod("gin").HasOperators("gin_trgm_ops");

        builder.HasOne(p => p.Category)
            .WithMany(c => c.Products)
            .HasForeignKey(p => p.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ReviewConfiguration : IEntityTypeConfiguration<Review>
{
    public void Configure(EntityTypeBuilder<Review> builder)
    {
        builder.ToTable(table => table.HasCheckConstraint("ck_reviews_rating_range", "rating BETWEEN 1 AND 5"));
        builder.Property(r => r.Comment).HasMaxLength(2000);

        // One review per customer per product, enforced by the database even under concurrent requests.
        builder.HasIndex(r => new { r.ProductId, r.UserId }).IsUnique();

        builder.HasOne(r => r.Product).WithMany(p => p.Reviews).HasForeignKey(r => r.ProductId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(r => r.User).WithMany().HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.Property(u => u.Email).HasMaxLength(254).IsRequired();
        builder.Property(u => u.FullName).HasMaxLength(150).IsRequired();
        builder.Property(u => u.PasswordHash).HasMaxLength(500).IsRequired();
        builder.Property(u => u.Role).HasConversion<string>().HasMaxLength(20);
        builder.HasIndex(u => u.Email).IsUnique();
    }
}

internal sealed class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.Property(t => t.TokenHash).HasMaxLength(64).IsRequired();
        builder.HasIndex(t => t.TokenHash).IsUnique();
        builder.HasIndex(t => t.UserId);
        builder.HasOne(t => t.User).WithMany().HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class WishlistItemConfiguration : IEntityTypeConfiguration<WishlistItem>
{
    public void Configure(EntityTypeBuilder<WishlistItem> builder)
    {
        builder.HasKey(w => new { w.UserId, w.ProductId });
        builder.HasOne<User>().WithMany().HasForeignKey(w => w.UserId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(w => w.Product).WithMany().HasForeignKey(w => w.ProductId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable(table =>
        {
            table.HasCheckConstraint("ck_orders_amounts_non_negative", "subtotal >= 0 AND shipping_cost >= 0 AND total >= 0");
            table.HasCheckConstraint("ck_orders_total_consistent", "total = subtotal + shipping_cost");
        });

        builder.Property(o => o.OrderNumber).HasMaxLength(32).IsRequired();
        builder.Property(o => o.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(o => o.Subtotal).HasPrecision(12, 2);
        builder.Property(o => o.ShippingCost).HasPrecision(12, 2);
        builder.Property(o => o.Total).HasPrecision(12, 2);
        builder.Property(o => o.PaymentReference).HasMaxLength(64);
        builder.Property(o => o.IdempotencyKey).HasMaxLength(64).IsRequired();
        builder.Property(o => o.RequestFingerprint).HasMaxLength(64).IsRequired();
        builder.Property(o => o.Version).IsRowVersion();

        builder.ComplexProperty(o => o.ShippingAddress, address =>
        {
            address.Property(a => a.Recipient).HasMaxLength(150).HasColumnName("shipping_recipient");
            address.Property(a => a.Line1).HasMaxLength(200).HasColumnName("shipping_line1");
            address.Property(a => a.City).HasMaxLength(100).HasColumnName("shipping_city");
            address.Property(a => a.PostalCode).HasMaxLength(20).HasColumnName("shipping_postal_code");
            address.Property(a => a.Country).HasMaxLength(2).HasColumnName("shipping_country");
        });

        builder.HasIndex(o => o.OrderNumber).IsUnique();

        // The idempotency guarantee: a second insert with the same (user, key) fails at the database,
        // even if two duplicate requests race past the application-level "already exists?" check.
        builder.HasIndex(o => new { o.UserId, o.IdempotencyKey }).IsUnique();
        builder.HasIndex(o => new { o.UserId, o.CreatedAt });
        builder.HasIndex(o => new { o.Status, o.CreatedAt });

        builder.HasOne(o => o.User).WithMany().HasForeignKey(o => o.UserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(o => o.Items).WithOne().HasForeignKey(i => i.OrderId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> builder)
    {
        builder.ToTable(table => table.HasCheckConstraint("ck_order_items_quantity_positive", "quantity > 0"));
        builder.Property(i => i.ProductName).HasMaxLength(200).IsRequired();
        builder.Property(i => i.UnitPrice).HasPrecision(12, 2);
        builder.Property(i => i.LineTotal).HasPrecision(12, 2);
        builder.HasIndex(i => i.ProductId);

        // Restrict: a product that was ever ordered cannot be hard-deleted (admins archive instead).
        builder.HasOne<Product>().WithMany().HasForeignKey(i => i.ProductId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class AuditLogEntryConfiguration : IEntityTypeConfiguration<AuditLogEntry>
{
    public void Configure(EntityTypeBuilder<AuditLogEntry> builder)
    {
        builder.ToTable("audit_log");
        builder.Property(a => a.Action).HasMaxLength(100).IsRequired();
        builder.Property(a => a.EntityType).HasMaxLength(100).IsRequired();
        builder.Property(a => a.EntityId).HasMaxLength(100).IsRequired();
        builder.Property(a => a.Details).HasColumnType("jsonb");
        builder.HasIndex(a => a.CreatedAt);
        builder.HasOne<User>().WithMany().HasForeignKey(a => a.ActorUserId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class OutboxMessageConfiguration : IEntityTypeConfiguration<OutboxMessage>
{
    public void Configure(EntityTypeBuilder<OutboxMessage> builder)
    {
        builder.ToTable("outbox_messages", table =>
            table.HasCheckConstraint("ck_outbox_messages_attempts_non_negative", "attempts >= 0"));
        builder.Property(m => m.Id).ValueGeneratedNever();
        builder.Property(m => m.Type).HasMaxLength(100).IsRequired();
        builder.Property(m => m.Payload).HasColumnType("jsonb").IsRequired();
        builder.Property(m => m.TraceParent).HasMaxLength(100);
        builder.Property(m => m.LastError).HasMaxLength(OutboxMessage.MaxErrorLength);
        // Partial index: the publisher's query only ever looks at pending messages, which stay few even when
        // millions of processed ones accumulate.
        builder.HasIndex(m => m.NextAttemptAt)
            .HasDatabaseName("ix_outbox_messages_pending")
            .HasFilter("processed_at IS NULL AND dead_lettered_at IS NULL");
    }
}
