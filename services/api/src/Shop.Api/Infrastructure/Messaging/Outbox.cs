using System.Diagnostics;
using System.Text.Json;
using Shop.Api.Infrastructure.Persistence;

namespace Shop.Api.Infrastructure.Messaging;

/// <summary>
/// Adds events to the outbox. It only stages them in the DbContext: they are written by the caller's own
/// SaveChanges, inside the caller's transaction. Never call SaveChanges here.
/// </summary>
public sealed class Outbox(ShopDbContext db, TimeProvider clock)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public void Enqueue<TEvent>(string type, TEvent payload)
        where TEvent : notnull =>
        db.OutboxMessages.Add(new OutboxMessage(
            Guid.CreateVersion7(),
            type,
            JsonSerializer.Serialize(payload, Json),
            clock.GetUtcNow(),
            Activity.Current?.Id));
}
