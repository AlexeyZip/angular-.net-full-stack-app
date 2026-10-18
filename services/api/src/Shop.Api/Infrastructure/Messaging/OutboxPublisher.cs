using Microsoft.Extensions.Options;

namespace Shop.Api.Infrastructure.Messaging;

/// <summary>
/// Polls the outbox. A full batch is followed immediately by the next one (drain a backlog); otherwise it waits
/// for the poll interval. Each batch gets its own DI scope, i.e. its own DbContext.
/// </summary>
public sealed class OutboxPublisher(
    IServiceScopeFactory scopes,
    IOptions<OutboxOptions> options,
    TimeProvider clock,
    ILogger<OutboxPublisher> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(options.Value.PollInterval, clock);
        do
        {
            try
            {
                int processed;
                do
                {
                    await using var scope = scopes.CreateAsyncScope();
                    processed = await scope.ServiceProvider.GetRequiredService<OutboxProcessor>().ProcessBatchAsync(stoppingToken);
                }
                while (processed == options.Value.BatchSize && !stoppingToken.IsCancellationRequested);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                // E.g. the database is briefly unavailable. Nothing is lost: the messages are still in the table.
                logger.LogError(ex, "Outbox publishing failed; retrying on the next tick");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
