using System.Text.Json;

namespace Shop.Notifications.Events;

// The consumer's own copy of the producer's contract (no shared assembly: the services deploy independently).
// Both sides are tested against the JSON samples in services/contracts/events. Unknown fields are ignored, so
// the producer may add fields; removing or renaming one is a breaking change that needs a new ".v2" type.

public static class EventTypes
{
    public const string OrderPlaced = "order.placed.v1";
    public const string OrderStatusChanged = "order.status_changed.v1";
}

public sealed record IntegrationEventEnvelope(Guid MessageId, string Type, DateTimeOffset OccurredAt, JsonElement Payload);

public sealed record OrderPlacedV1(
    Guid OrderId,
    string OrderNumber,
    string CustomerEmail,
    string CustomerName,
    decimal Total,
    string Currency,
    int ItemCount,
    DateTimeOffset PlacedAt);

public sealed record OrderStatusChangedV1(
    Guid OrderId,
    string OrderNumber,
    string CustomerEmail,
    string CustomerName,
    string PreviousStatus,
    string Status,
    DateTimeOffset ChangedAt);
