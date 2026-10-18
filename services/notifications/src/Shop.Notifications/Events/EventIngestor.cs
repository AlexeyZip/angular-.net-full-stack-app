using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Shop.Notifications.Persistence;

namespace Shop.Notifications.Events;

public enum IngestOutcome
{
    Processed,
    Duplicate,
    Rejected,
}

public sealed record IngestResult(IngestOutcome Outcome, string? ErrorCode = null, string? Error = null)
{
    public static IngestResult Reject(string code, string error) => new(IngestOutcome.Rejected, code, error);
}

/// <summary>
/// Idempotent consumer: the inbox row and the notification are written by one SaveChanges (one transaction),
/// so an event is either fully handled or not at all, and a redelivery is recognised by its message id.
/// </summary>
public sealed class EventIngestor(NotificationsDbContext db, TimeProvider clock, ILogger<EventIngestor> logger)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        RespectRequiredConstructorParameters = true,
        RespectNullableAnnotations = true,
    };

    public async Task<IngestResult> IngestAsync(IntegrationEventEnvelope envelope, CancellationToken cancellationToken)
    {
        if (envelope.MessageId == Guid.Empty || string.IsNullOrWhiteSpace(envelope.Type))
        {
            return IngestResult.Reject("invalid_envelope", "messageId and type are required.");
        }

        if (await db.Inbox.AnyAsync(m => m.MessageId == envelope.MessageId, cancellationToken))
        {
            return new IngestResult(IngestOutcome.Duplicate);
        }

        Rendered rendered;
        try
        {
            switch (envelope.Type)
            {
                case EventTypes.OrderPlaced:
                    rendered = Render(envelope.Payload.Deserialize<OrderPlacedV1>(Json)!);
                    break;
                case EventTypes.OrderStatusChanged:
                    rendered = Render(envelope.Payload.Deserialize<OrderStatusChangedV1>(Json)!);
                    break;
                default:
                    return IngestResult.Reject("unknown_event_type", $"Event type '{envelope.Type}' is not handled.");
            }
        }
        catch (JsonException ex)
        {
            return IngestResult.Reject("invalid_payload", ex.Message);
        }

        if (string.IsNullOrWhiteSpace(rendered.Recipient) || string.IsNullOrWhiteSpace(rendered.Reference))
        {
            return IngestResult.Reject("invalid_payload", "customerEmail and orderNumber are required.");
        }

        var now = clock.GetUtcNow();
        var notification = new Notification(
            Guid.CreateVersion7(), envelope.MessageId, "email", rendered.Reference, rendered.Recipient, rendered.Subject, rendered.Body, now);
        db.Inbox.Add(new InboxMessage(envelope.MessageId, envelope.Type, envelope.OccurredAt, now));
        db.Notifications.Add(notification);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // A concurrent delivery of the same message won the race.
            return new IngestResult(IngestOutcome.Duplicate);
        }

        // No recipient or content in the log: they are personal data.
        logger.LogInformation("Simulated {Channel} notification {NotificationId} for message {MessageId} ({Type})",
            notification.Channel, notification.Id, envelope.MessageId, envelope.Type);
        return new IngestResult(IngestOutcome.Processed);
    }

    private sealed record Rendered(string Reference, string Recipient, string Subject, string Body);

    private static Rendered Render(OrderPlacedV1 e) => new(
        e.OrderNumber,
        e.CustomerEmail,
        $"Order {e.OrderNumber} confirmed",
        string.Create(CultureInfo.InvariantCulture,
            $"Hi {e.CustomerName}, thank you for your order {e.OrderNumber}: {e.ItemCount} item(s), total {e.Total:0.00} {e.Currency}."));

    private static Rendered Render(OrderStatusChangedV1 e) => new(
        e.OrderNumber,
        e.CustomerEmail,
        $"Order {e.OrderNumber} is now {e.Status}",
        $"Hi {e.CustomerName}, the status of your order {e.OrderNumber} changed from {e.PreviousStatus} to {e.Status}.");
}
