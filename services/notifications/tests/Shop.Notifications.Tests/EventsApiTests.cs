using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Shop.Notifications.Security;

namespace Shop.Notifications.Tests;

public sealed class EventsApiTests(NotificationsFixture service)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task The_order_placed_contract_sample_becomes_a_simulated_email()
    {
        var sample = NotificationsFixture.LoadSample("order.placed.v1.json");
        var client = service.CreateServiceClient();

        var response = await client.PostAsJsonAsync("/internal/events", sample, Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("processed", await StatusOf(response));
        var notification = Assert.Single(await NotificationsFor(client, sample));
        Assert.Equal("customer@example.test", notification.GetProperty("recipient").GetString());
        Assert.Equal($"Order {OrderNumber(sample)} confirmed", notification.GetProperty("subject").GetString());
        Assert.Contains("total 64.99 USD", notification.GetProperty("body").GetString());
    }

    [Fact]
    public async Task The_status_changed_contract_sample_is_handled()
    {
        var sample = NotificationsFixture.LoadSample("order.status_changed.v1.json");
        var client = service.CreateServiceClient();

        var response = await client.PostAsJsonAsync("/internal/events", sample, Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var notification = Assert.Single(await NotificationsFor(client, sample));
        Assert.Equal($"Order {OrderNumber(sample)} is now Shipped", notification.GetProperty("subject").GetString());
    }

    [Fact]
    public async Task A_redelivered_message_is_acknowledged_without_a_second_notification()
    {
        var sample = NotificationsFixture.LoadSample("order.placed.v1.json");
        var client = service.CreateServiceClient();

        await client.PostAsJsonAsync("/internal/events", sample, Ct);
        var again = await client.PostAsJsonAsync("/internal/events", sample, Ct);

        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        Assert.Equal("duplicate", await StatusOf(again));
        Assert.Single(await NotificationsFor(client, sample));
    }

    [Fact]
    public async Task Concurrent_redeliveries_create_exactly_one_notification()
    {
        var sample = NotificationsFixture.LoadSample("order.placed.v1.json");
        var client = service.CreateServiceClient();

        var responses = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => client.PostAsJsonAsync("/internal/events", sample, Ct)));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        Assert.Single(await NotificationsFor(client, sample));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("wrong-key-0123456789")]
    public async Task Callers_without_the_service_key_are_rejected_before_anything_is_stored(string? key)
    {
        var sample = NotificationsFixture.LoadSample("order.placed.v1.json");

        var response = await service.CreateServiceClient(key).PostAsJsonAsync("/internal/events", sample, Ct);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("invalid_service_key", await CodeOf(response));
        Assert.Empty(await NotificationsFor(service.CreateServiceClient(), sample));
    }

    [Fact]
    public async Task Unknown_event_types_are_rejected_so_the_producer_dead_letters_them()
    {
        var sample = NotificationsFixture.LoadSample("order.placed.v1.json");
        sample["type"] = "order.refunded.v1";

        var response = await service.CreateServiceClient().PostAsJsonAsync("/internal/events", sample, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("unknown_event_type", await CodeOf(response));
    }

    [Fact]
    public async Task A_payload_missing_required_fields_is_rejected()
    {
        var sample = NotificationsFixture.LoadSample("order.placed.v1.json");
        sample["payload"]!.AsObject().Remove("customerEmail");

        var response = await service.CreateServiceClient().PostAsJsonAsync("/internal/events", sample, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("invalid_payload", await CodeOf(response));
    }

    [Fact]
    public async Task Fields_added_by_a_newer_producer_are_ignored()
    {
        var sample = NotificationsFixture.LoadSample("order.placed.v1.json");
        sample["payload"]!["loyaltyPoints"] = 120;

        var response = await service.CreateServiceClient().PostAsJsonAsync("/internal/events", sample, Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Health_endpoints_need_no_service_key()
    {
        var response = await service.Factory.CreateClient().GetAsync("/health/ready", Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData("TEST-ONLY-notifications-service-key", true)]
    [InlineData("TEST-ONLY-notifications-service-kez", false)]
    [InlineData("TEST-ONLY", false)]
    [InlineData("", false)]
    public void Service_keys_are_compared_exactly(string presented, bool matches) =>
        Assert.Equal(matches, ServiceKeyAuthenticationHandler.KeysMatch(presented, NotificationsFixture.ServiceKey));

    private static string OrderNumber(JsonObject sample) => sample["payload"]!["orderNumber"]!.GetValue<string>();

    private static async Task<List<JsonElement>> NotificationsFor(HttpClient client, JsonObject sample) =>
        (await client.GetFromJsonAsync<List<JsonElement>>($"/internal/notifications?reference={Uri.EscapeDataString(OrderNumber(sample))}", Ct))!;

    private static async Task<string?> StatusOf(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("status").GetString();

    private static async Task<string?> CodeOf(HttpResponseMessage response)
    {
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("code").GetString();
    }
}
