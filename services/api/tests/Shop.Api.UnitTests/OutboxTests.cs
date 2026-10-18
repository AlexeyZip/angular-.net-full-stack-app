using System.Net;
using Shop.Api.Infrastructure.Messaging;

namespace Shop.Api.UnitTests;

public sealed class OutboxMessageTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 18, 12, 0, 0, TimeSpan.Zero);

    private static OutboxMessage NewMessage() => new(Guid.CreateVersion7(), "test.v1", "{}", Now, null);

    [Theory]
    [InlineData(1, 5)]
    [InlineData(2, 10)]
    [InlineData(3, 20)]
    [InlineData(8, 640)]
    [InlineData(9, 900)]
    [InlineData(40, 900)]
    public void Backoff_doubles_from_five_seconds_and_is_capped_at_fifteen_minutes(int attempt, int expectedSeconds) =>
        Assert.Equal(TimeSpan.FromSeconds(expectedSeconds), OutboxBackoff.Delay(attempt));

    [Fact]
    public void A_transient_failure_schedules_a_retry_with_backoff()
    {
        var message = NewMessage();

        message.RecordTransientFailure("HTTP 503", Now, maxAttempts: 3);

        Assert.Equal(1, message.Attempts);
        Assert.Equal(Now.AddSeconds(5), message.NextAttemptAt);
        Assert.Null(message.DeadLetteredAt);
        Assert.Equal("HTTP 503", message.LastError);
    }

    [Fact]
    public void A_message_is_dead_lettered_when_it_runs_out_of_attempts()
    {
        var message = NewMessage();

        message.RecordTransientFailure("timeout", Now, maxAttempts: 2);
        message.RecordTransientFailure("timeout", Now.AddSeconds(5), maxAttempts: 2);

        Assert.Equal(2, message.Attempts);
        Assert.Equal(Now.AddSeconds(5), message.DeadLetteredAt);
        Assert.Null(message.ProcessedAt);
    }

    [Fact]
    public void A_permanent_failure_dead_letters_immediately()
    {
        var message = NewMessage();

        message.RecordPermanentFailure("HTTP 400", Now);

        Assert.Equal(1, message.Attempts);
        Assert.Equal(Now, message.DeadLetteredAt);
    }

    [Fact]
    public void Delivery_after_failures_marks_the_message_processed_and_clears_the_error()
    {
        var message = NewMessage();
        message.RecordTransientFailure("HTTP 503", Now, maxAttempts: 5);

        message.MarkProcessed(Now.AddSeconds(5));

        Assert.Equal(2, message.Attempts);
        Assert.Equal(Now.AddSeconds(5), message.ProcessedAt);
        Assert.Null(message.LastError);
    }

    [Fact]
    public void Long_errors_are_truncated_to_fit_the_column()
    {
        var message = NewMessage();

        message.RecordTransientFailure(new string('x', 5_000), Now, maxAttempts: 5);

        Assert.Equal(OutboxMessage.MaxErrorLength, message.LastError!.Length);
    }

    [Theory]
    [InlineData(HttpStatusCode.BadRequest, true)]
    [InlineData(HttpStatusCode.UnprocessableEntity, true)]
    [InlineData(HttpStatusCode.Unauthorized, false)]
    [InlineData(HttpStatusCode.RequestTimeout, false)]
    [InlineData(HttpStatusCode.TooManyRequests, false)]
    [InlineData(HttpStatusCode.InternalServerError, false)]
    [InlineData(HttpStatusCode.ServiceUnavailable, false)]
    public void Only_client_errors_that_retrying_cannot_fix_are_permanent(HttpStatusCode status, bool permanent) =>
        Assert.Equal(permanent, NotificationsClient.IsPermanent(status));
}
