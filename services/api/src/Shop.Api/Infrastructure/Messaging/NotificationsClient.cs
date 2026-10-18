using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Shop.Api.Infrastructure.Messaging;

public sealed class NotificationsOptions
{
    public const string SectionName = "Notifications";

    /// <summary>The notifications service. When empty, events stay in the outbox and nothing is published.</summary>
    public Uri? BaseUrl { get; init; }

    /// <summary>Shared secret identifying this service to the consumer. Development placeholder only in the repo.</summary>
    public string ServiceKey { get; init; } = string.Empty;
}

public sealed class OutboxOptions
{
    public const string SectionName = "Outbox";

    public bool PublisherEnabled { get; init; } = true;
    public TimeSpan PollInterval { get; init; } = TimeSpan.FromSeconds(2);

    [Range(1, 500)]
    public int BatchSize { get; init; } = 20;

    [Range(1, 50)]
    public int MaxAttempts { get; init; } = 8;

    /// <summary>How long a claimed message is hidden from other publishers while it is being delivered.</summary>
    public TimeSpan ClaimDuration { get; init; } = TimeSpan.FromMinutes(5);
}

public enum DeliveryOutcome
{
    Delivered,
    TransientFailure,
    PermanentFailure,
}

public sealed record DeliveryResult(DeliveryOutcome Outcome, string? Error = null);

/// <summary>
/// Service-to-service HTTP call to the notifications service. Timeouts, retries with backoff and the circuit
/// breaker come from the resilience handler (see <see cref="MessagingRegistration"/>); retrying a POST is safe
/// because the consumer deduplicates by message id.
/// </summary>
public sealed class NotificationsClient(HttpClient http, IOptions<NotificationsOptions> options)
{
    public const string ServiceKeyHeader = "X-Service-Key";

    public async Task<DeliveryResult> DeliverAsync(OutboxMessage message, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "internal/events")
        {
            Content = JsonContent.Create(new IntegrationEventEnvelope(
                message.Id, message.Type, message.OccurredAt, JsonSerializer.Deserialize<JsonElement>(message.Payload))),
        };
        request.Headers.Add(ServiceKeyHeader, options.Value.ServiceKey);
        if (message.TraceParent is { } traceParent)
        {
            // Continue the trace of the request that produced the event, not of this background loop.
            request.Headers.TryAddWithoutValidation("traceparent", traceParent);
        }

        try
        {
            using var response = await http.SendAsync(request, cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                return new DeliveryResult(DeliveryOutcome.Delivered);
            }

            var error = $"HTTP {(int)response.StatusCode}: {await ReadSnippetAsync(response, cancellationToken)}";
            return IsPermanent(response.StatusCode)
                ? new DeliveryResult(DeliveryOutcome.PermanentFailure, error)
                : new DeliveryResult(DeliveryOutcome.TransientFailure, error);
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
        {
            // Network errors, timeouts and an open circuit: the service may recover, so try again later.
            return new DeliveryResult(DeliveryOutcome.TransientFailure, $"{ex.GetType().Name}: {ex.Message}");
        }
    }

    /// <summary>
    /// The consumer understood the request and refused it; sending it again cannot succeed. 401 is excluded: a
    /// rotated or misconfigured service key is fixed by configuration, and the message itself is fine.
    /// </summary>
    internal static bool IsPermanent(HttpStatusCode status) =>
        (int)status is >= 400 and < 500 && status is not (HttpStatusCode.RequestTimeout or HttpStatusCode.TooManyRequests or HttpStatusCode.Unauthorized);

    private static async Task<string> ReadSnippetAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        return body.Length <= 300 ? body : body[..300];
    }
}
