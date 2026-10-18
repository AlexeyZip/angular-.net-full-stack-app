namespace Shop.Api.Infrastructure.Messaging;

/// <summary>
/// Published message contracts. The type name carries the version: a breaking change gets a new type
/// (".v2") published alongside the old one until every consumer has moved. The JSON shape is pinned by the samples
/// in services/contracts/events, which the consumer's tests read too.
/// </summary>
public static class IntegrationEventTypes
{
    public const string OrderPlaced = "order.placed.v1";
    public const string OrderStatusChanged = "order.status_changed.v1";
}

/// <summary>Carries the customer's e-mail so the consumer does not need to call back into this service.</summary>
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

/// <summary>What goes over the wire: the envelope identifies the message, the payload is the event itself.</summary>
public sealed record IntegrationEventEnvelope(Guid MessageId, string Type, DateTimeOffset OccurredAt, System.Text.Json.JsonElement Payload);
