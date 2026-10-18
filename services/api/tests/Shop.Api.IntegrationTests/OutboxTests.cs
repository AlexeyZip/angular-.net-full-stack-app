using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Npgsql;
using Shop.Api.Domain;
using Shop.Api.Features.Admin;
using Shop.Api.Features.Orders;
using Shop.Api.Infrastructure.Messaging;
using Shop.Api.Infrastructure.Persistence;

namespace Shop.Api.IntegrationTests;

public sealed class OutboxTests(ApiFixture api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    // Due long ago, so these messages sort ahead of anything other tests leave in the shared database.
    private static readonly DateTimeOffset LongAgo = new(2000, 1, 1, 0, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Checkout_writes_an_order_placed_event_with_the_order()
    {
        var product = await api.CreateProductAsync(stock: 10, price: 30.00m);
        var (client, auth) = await api.RegisterCustomerAsync();

        var order = await (await CheckoutApiTests.Checkout(client, CheckoutApiTests.NewKey(), [new(product.Id, 2)])).ReadAsync<OrderDetailDto>();

        var message = Assert.Single(await EventsForOrderAsync(order.Id));
        Assert.Equal(IntegrationEventTypes.OrderPlaced, message.Type);
        using var payload = JsonDocument.Parse(message.Payload);
        Assert.Equal(order.OrderNumber, payload.RootElement.GetProperty("orderNumber").GetString());
        Assert.Equal(auth.User.Email, payload.RootElement.GetProperty("customerEmail").GetString());
        Assert.Equal(order.Total, payload.RootElement.GetProperty("total").GetDecimal());
        Assert.Equal(2, payload.RootElement.GetProperty("itemCount").GetInt32());
    }

    [Fact]
    public async Task A_declined_payment_writes_no_event()
    {
        var product = await api.CreateProductAsync(stock: 4);
        var (client, auth) = await api.RegisterCustomerAsync();

        var response = await CheckoutApiTests.Checkout(client, CheckoutApiTests.NewKey(), [new(product.Id, 1)], PaymentSimulator.DeclinedToken);

        Assert.Equal(HttpStatusCode.PaymentRequired, response.StatusCode);
        var count = await api.QueryAsync(db => db.OutboxMessages
            .FromSql($"SELECT * FROM outbox_messages WHERE payload->>'customerEmail' = {auth.User.Email}")
            .CountAsync(Ct));
        Assert.Equal(0, count);
    }

    [Fact]
    public async Task An_admin_status_change_writes_a_status_changed_event()
    {
        var admin = await api.LoginAdminAsync();
        var product = await api.CreateProductAsync(stock: 5);
        var (customer, _) = await api.RegisterCustomerAsync();
        var order = await (await CheckoutApiTests.Checkout(customer, CheckoutApiTests.NewKey(), [new(product.Id, 1)])).ReadAsync<OrderDetailDto>();

        (await admin.PostAsJsonAsync($"/api/admin/orders/{order.Id}/status", new ChangeOrderStatusRequest(OrderStatus.Shipped), Ct))
            .EnsureSuccessStatusCode();

        var changed = Assert.Single(await EventsForOrderAsync(order.Id), m => m.Type == IntegrationEventTypes.OrderStatusChanged);
        using var payload = JsonDocument.Parse(changed.Payload);
        Assert.Equal("Paid", payload.RootElement.GetProperty("previousStatus").GetString());
        Assert.Equal("Shipped", payload.RootElement.GetProperty("status").GetString());
    }

    [Fact]
    public async Task The_processor_delivers_due_messages_with_service_key_and_trace_context()
    {
        var id = await InsertDueMessageAsync("00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01");
        var consumer = new FakeConsumer();

        await RunProcessorAsync(consumer);

        var stored = await FindAsync(id);
        Assert.NotNull(stored.ProcessedAt);
        Assert.Equal(1, stored.Attempts);
        var request = consumer.Received[id];
        Assert.Equal("TEST-ONLY-service-key", request.ServiceKey);
        Assert.Equal("00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01", request.TraceParent);
        Assert.Equal(IntegrationEventTypes.OrderPlaced, request.Type);
    }

    [Fact]
    public async Task A_server_error_schedules_a_retry_instead_of_losing_the_message()
    {
        var id = await InsertDueMessageAsync();
        var consumer = new FakeConsumer { [id] = HttpStatusCode.ServiceUnavailable };

        await RunProcessorAsync(consumer);

        var stored = await FindAsync(id);
        Assert.Null(stored.ProcessedAt);
        Assert.Null(stored.DeadLetteredAt);
        Assert.Equal(1, stored.Attempts);
        Assert.True(stored.NextAttemptAt > DateTimeOffset.UtcNow);
        Assert.StartsWith("HTTP 503", stored.LastError);
    }

    [Fact]
    public async Task A_rejected_message_is_dead_lettered_at_once()
    {
        var id = await InsertDueMessageAsync();
        var consumer = new FakeConsumer { [id] = HttpStatusCode.BadRequest };

        await RunProcessorAsync(consumer);

        var stored = await FindAsync(id);
        Assert.NotNull(stored.DeadLetteredAt);
        Assert.Null(stored.ProcessedAt);
    }

    [Fact]
    public async Task Messages_locked_by_another_publisher_are_skipped()
    {
        var id = await InsertDueMessageAsync();
        var connectionString = await api.QueryAsync(db => Task.FromResult(db.Database.GetConnectionString()!));
        await using var otherPublisher = new NpgsqlConnection(connectionString);
        await otherPublisher.OpenAsync(Ct);
        await using var transaction = await otherPublisher.BeginTransactionAsync(Ct);
        await using (var lockRow = new NpgsqlCommand("SELECT id FROM outbox_messages WHERE id = @id FOR UPDATE", otherPublisher, transaction))
        {
            lockRow.Parameters.AddWithValue("id", id);
            await lockRow.ExecuteScalarAsync(Ct);
        }

        var consumer = new FakeConsumer();
        await RunProcessorAsync(consumer);
        await transaction.RollbackAsync(Ct);

        Assert.False(consumer.Received.ContainsKey(id));
        Assert.Null((await FindAsync(id)).ProcessedAt);
    }

    private Task<List<OutboxMessage>> EventsForOrderAsync(Guid orderId) =>
        api.QueryAsync(db => db.OutboxMessages
            .FromSql($"SELECT * FROM outbox_messages WHERE payload->>'orderId' = {orderId.ToString()}")
            .AsNoTracking()
            .ToListAsync(Ct));

    private Task<OutboxMessage> FindAsync(Guid id) =>
        api.QueryAsync(db => db.OutboxMessages.AsNoTracking().SingleAsync(m => m.Id == id, Ct));

    private async Task<Guid> InsertDueMessageAsync(string? traceParent = null)
    {
        var id = Guid.CreateVersion7();
        var payload = JsonSerializer.Serialize(new { orderId = Guid.NewGuid(), orderNumber = "TEST" });
        await api.QueryAsync(async db =>
        {
            db.OutboxMessages.Add(new OutboxMessage(id, IntegrationEventTypes.OrderPlaced, payload, LongAgo, traceParent));
            return await db.SaveChangesAsync(Ct);
        });
        return id;
    }

    private async Task RunProcessorAsync(FakeConsumer consumer)
    {
        await using var scope = api.Factory.Services.CreateAsyncScope();
        var notificationsOptions = Options.Create(new NotificationsOptions
        {
            BaseUrl = new Uri("http://notifications.test/"),
            ServiceKey = "TEST-ONLY-service-key",
        });
        var client = new NotificationsClient(new HttpClient(consumer) { BaseAddress = notificationsOptions.Value.BaseUrl }, notificationsOptions);
        var processor = new OutboxProcessor(
            scope.ServiceProvider.GetRequiredService<ShopDbContext>(),
            client,
            Options.Create(new OutboxOptions { BatchSize = 50 }),
            TimeProvider.System,
            NullLogger<OutboxProcessor>.Instance);
        await processor.ProcessBatchAsync(Ct);
    }

    private sealed record ReceivedEvent(string Type, string? ServiceKey, string? TraceParent);

    /// <summary>Stands in for the notifications service: answers 200 unless a status is configured for a message.</summary>
    private sealed class FakeConsumer : HttpMessageHandler
    {
        private readonly Dictionary<Guid, HttpStatusCode> _responses = [];

        public HttpStatusCode this[Guid messageId]
        {
            set => _responses[messageId] = value;
        }

        public ConcurrentDictionary<Guid, ReceivedEvent> Received { get; } = new();

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var envelope = (await request.Content!.ReadFromJsonAsync<IntegrationEventEnvelope>(ApiFixture.Json, cancellationToken))!;
            Received[envelope.MessageId] = new ReceivedEvent(
                envelope.Type,
                request.Headers.TryGetValues(NotificationsClient.ServiceKeyHeader, out var key) ? key.Single() : null,
                request.Headers.TryGetValues("traceparent", out var trace) ? trace.Single() : null);
            return new HttpResponseMessage(_responses.GetValueOrDefault(envelope.MessageId, HttpStatusCode.OK));
        }
    }
}
