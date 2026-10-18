namespace Shop.Api.Infrastructure.Messaging;

/// <summary>
/// An integration event waiting to be delivered. It is inserted by the same SaveChanges as the business change
/// (transactional outbox), so an event exists if and only if the change was committed.
/// Delivery is at-least-once: consumers deduplicate by <see cref="Id"/>.
/// </summary>
public sealed class OutboxMessage
{
    public const int MaxErrorLength = 1_000;

    private OutboxMessage()
    {
    }

    public OutboxMessage(Guid id, string type, string payload, DateTimeOffset occurredAt, string? traceParent)
    {
        Id = id;
        Type = type;
        Payload = payload;
        OccurredAt = occurredAt;
        NextAttemptAt = occurredAt;
        TraceParent = traceParent;
    }

    public Guid Id { get; private set; }
    public string Type { get; private set; } = string.Empty;

    /// <summary>JSON (jsonb). Serialized once at write time, so later code changes cannot alter a stored event.</summary>
    public string Payload { get; private set; } = string.Empty;

    public DateTimeOffset OccurredAt { get; private set; }

    /// <summary>W3C trace context of the request that caused the event, so the consumer's logs join the same trace.</summary>
    public string? TraceParent { get; private set; }

    public int Attempts { get; private set; }
    public DateTimeOffset NextAttemptAt { get; private set; }
    public DateTimeOffset? ProcessedAt { get; private set; }

    /// <summary>Set when the message will never be retried again; it stays in the table for inspection and replay.</summary>
    public DateTimeOffset? DeadLetteredAt { get; private set; }

    public string? LastError { get; private set; }

    /// <summary>Hides the message from other publishers until <paramref name="until"/> while it is being delivered.</summary>
    public void Claim(DateTimeOffset until) => NextAttemptAt = until;

    public void MarkProcessed(DateTimeOffset now)
    {
        Attempts++;
        ProcessedAt = now;
        LastError = null;
    }

    /// <summary>Transient failure: retry later with exponential backoff, until <paramref name="maxAttempts"/>.</summary>
    public void RecordTransientFailure(string error, DateTimeOffset now, int maxAttempts)
    {
        Attempts++;
        LastError = Truncate(error);
        if (Attempts >= maxAttempts)
        {
            DeadLetteredAt = now;
        }
        else
        {
            NextAttemptAt = now + OutboxBackoff.Delay(Attempts);
        }
    }

    /// <summary>Permanent failure (the consumer rejected the message): retrying cannot help, dead-letter at once.</summary>
    public void RecordPermanentFailure(string error, DateTimeOffset now)
    {
        Attempts++;
        LastError = Truncate(error);
        DeadLetteredAt = now;
    }

    private static string Truncate(string value) => value.Length <= MaxErrorLength ? value : value[..MaxErrorLength];
}

public static class OutboxBackoff
{
    private static readonly TimeSpan Base = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan Max = TimeSpan.FromMinutes(15);

    /// <summary>5 s, 10 s, 20 s, … capped at 15 minutes.</summary>
    public static TimeSpan Delay(int attempt)
    {
        var factor = Math.Pow(2, Math.Clamp(attempt - 1, 0, 20));
        return TimeSpan.FromTicks((long)Math.Min(Base.Ticks * factor, Max.Ticks));
    }
}
