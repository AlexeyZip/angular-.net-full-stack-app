using Microsoft.EntityFrameworkCore;

namespace Shop.Notifications.Persistence;

/// <summary>This service's own database. No other service reads or writes it.</summary>
public sealed class NotificationsDbContext(DbContextOptions<NotificationsDbContext> options) : DbContext(options)
{
    public DbSet<InboxMessage> Inbox => Set<InboxMessage>();
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<InboxMessage>(inbox =>
        {
            inbox.ToTable("inbox_messages");
            // The producer's message id is the primary key: a redelivered event cannot be inserted twice,
            // even when two deliveries race each other.
            inbox.HasKey(m => m.MessageId);
            inbox.Property(m => m.MessageId).ValueGeneratedNever();
            inbox.Property(m => m.Type).HasMaxLength(100).IsRequired();
        });

        modelBuilder.Entity<Notification>(notification =>
        {
            notification.ToTable("notifications");
            notification.Property(n => n.Id).ValueGeneratedNever();
            notification.Property(n => n.Channel).HasMaxLength(20).IsRequired();
            notification.Property(n => n.Reference).HasMaxLength(50).IsRequired();
            notification.Property(n => n.Recipient).HasMaxLength(256).IsRequired();
            notification.Property(n => n.Subject).HasMaxLength(200).IsRequired();
            notification.Property(n => n.Body).HasMaxLength(2000).IsRequired();
            notification.HasIndex(n => n.Reference);
            notification.HasIndex(n => n.MessageId).IsUnique();
            notification.HasOne<InboxMessage>().WithMany().HasForeignKey(n => n.MessageId).OnDelete(DeleteBehavior.Restrict);
        });
    }
}

public sealed class InboxMessage(Guid messageId, string type, DateTimeOffset occurredAt, DateTimeOffset receivedAt)
{
    public Guid MessageId { get; private set; } = messageId;
    public string Type { get; private set; } = type;
    public DateTimeOffset OccurredAt { get; private set; } = occurredAt;
    public DateTimeOffset ReceivedAt { get; private set; } = receivedAt;
}

/// <summary>A simulated e-mail: rendered and stored, never sent (no mail provider in this reference project).</summary>
public sealed class Notification(
    Guid id, Guid messageId, string channel, string reference, string recipient, string subject, string body, DateTimeOffset createdAt)
{
    public Guid Id { get; private set; } = id;
    public Guid MessageId { get; private set; } = messageId;
    public string Channel { get; private set; } = channel;

    /// <summary>Business reference (the order number), used for lookups instead of the e-mail address.</summary>
    public string Reference { get; private set; } = reference;
    public string Recipient { get; private set; } = recipient;
    public string Subject { get; private set; } = subject;
    public string Body { get; private set; } = body;
    public DateTimeOffset CreatedAt { get; private set; } = createdAt;
}
