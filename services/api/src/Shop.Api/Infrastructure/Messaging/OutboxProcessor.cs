using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Shop.Api.Infrastructure.Persistence;

namespace Shop.Api.Infrastructure.Messaging;

/// <summary>
/// Publishes one batch of outbox messages in two steps, so no transaction or row lock is held during HTTP calls:
/// 1. claim: a short transaction selects due messages with FOR UPDATE SKIP LOCKED (several API instances never
///    pick the same rows) and pushes their next attempt time into the future;
/// 2. deliver each message and record the outcome.
/// A crash between the steps only delays delivery until the claim expires: at-least-once, never lost.
/// </summary>
public sealed class OutboxProcessor(
    ShopDbContext db,
    NotificationsClient notifications,
    IOptions<OutboxOptions> options,
    TimeProvider clock,
    ILogger<OutboxProcessor> logger)
{
    public async Task<int> ProcessBatchAsync(CancellationToken cancellationToken)
    {
        var settings = options.Value;
        var batch = await ClaimAsync(settings, cancellationToken);

        foreach (var message in batch)
        {
            var result = await notifications.DeliverAsync(message, cancellationToken);
            var now = clock.GetUtcNow();
            switch (result.Outcome)
            {
                case DeliveryOutcome.Delivered:
                    message.MarkProcessed(now);
                    break;
                case DeliveryOutcome.PermanentFailure:
                    message.RecordPermanentFailure(result.Error ?? "rejected", now);
                    break;
                default:
                    message.RecordTransientFailure(result.Error ?? "failed", now, settings.MaxAttempts);
                    break;
            }

            await db.SaveChangesAsync(cancellationToken);
            Log(message, result);
        }

        return batch.Count;
    }

    private async Task<List<OutboxMessage>> ClaimAsync(OutboxOptions settings, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var now = clock.GetUtcNow();
        var batch = await db.OutboxMessages
            .FromSql($"""
                SELECT * FROM outbox_messages
                WHERE processed_at IS NULL AND dead_lettered_at IS NULL AND next_attempt_at <= {now}
                ORDER BY next_attempt_at
                LIMIT {settings.BatchSize}
                FOR UPDATE SKIP LOCKED
                """)
            .ToListAsync(cancellationToken);

        foreach (var message in batch)
        {
            message.Claim(now + settings.ClaimDuration);
        }

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return batch;
    }

    private void Log(OutboxMessage message, DeliveryResult result)
    {
        if (message.DeadLetteredAt is not null)
        {
            logger.LogError("Outbox message {MessageId} ({Type}) dead-lettered after {Attempts} attempts: {Error}",
                message.Id, message.Type, message.Attempts, result.Error);
        }
        else if (result.Outcome == DeliveryOutcome.Delivered)
        {
            logger.LogInformation("Outbox message {MessageId} ({Type}) delivered on attempt {Attempts}", message.Id, message.Type, message.Attempts);
        }
        else
        {
            logger.LogWarning("Outbox message {MessageId} ({Type}) failed on attempt {Attempts}, next attempt at {NextAttemptAt}: {Error}",
                message.Id, message.Type, message.Attempts, message.NextAttemptAt, result.Error);
        }
    }
}
