using System.Text.Json;
using Shop.Api.Domain;
using Shop.Api.Infrastructure.Persistence;

namespace Shop.Api.Infrastructure.Audit;

/// <summary>
/// Adds audit entries to the current DbContext without saving. The caller's SaveChanges persists the
/// business change and its audit record atomically: either both are written or neither is.
/// </summary>
public sealed class AuditLogger(ShopDbContext db, TimeProvider clock)
{
    public void Record(Guid actorUserId, string action, string entityType, object entityId, object details)
    {
        db.AuditLog.Add(new AuditLogEntry(
            actorUserId,
            action,
            entityType,
            entityId.ToString() ?? string.Empty,
            JsonSerializer.Serialize(details, JsonSerializerOptions.Web),
            clock.GetUtcNow()));
    }
}
