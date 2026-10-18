namespace Shop.Api.Domain;

/// <summary>Append-only record of a sensitive administrative operation.</summary>
public sealed class AuditLogEntry
{
    private AuditLogEntry()
    {
    }

    public AuditLogEntry(Guid actorUserId, string action, string entityType, string entityId, string details, DateTimeOffset now)
    {
        Id = Guid.CreateVersion7(now);
        ActorUserId = actorUserId;
        Action = action;
        EntityType = entityType;
        EntityId = entityId;
        Details = details;
        CreatedAt = now;
    }

    public Guid Id { get; private set; }
    public Guid ActorUserId { get; private set; }
    public string Action { get; private set; } = string.Empty;
    public string EntityType { get; private set; } = string.Empty;
    public string EntityId { get; private set; } = string.Empty;

    /// <summary>JSON document (jsonb) describing the change.</summary>
    public string Details { get; private set; } = "{}";

    public DateTimeOffset CreatedAt { get; private set; }
}
