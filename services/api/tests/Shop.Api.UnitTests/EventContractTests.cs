using System.Text.Json;
using Shop.Api.Infrastructure.Messaging;

namespace Shop.Api.UnitTests;

/// <summary>
/// Producer side of the contract in services/contracts/events: the serialized C# events must have exactly the
/// payload fields of the samples the notifications service is tested against.
/// </summary>
public sealed class EventContractTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    [Fact]
    public void Order_placed_matches_the_published_contract()
    {
        var sample = LoadSample("order.placed.v1.json");
        var produced = JsonSerializer.SerializeToElement(
            new OrderPlacedV1(Guid.NewGuid(), "SO-1", "a@b.test", "A", 1m, "USD", 1, DateTimeOffset.UtcNow), Json);

        Assert.Equal(IntegrationEventTypes.OrderPlaced, sample.GetProperty("type").GetString());
        AssertSameShape(sample.GetProperty("payload"), produced);
    }

    [Fact]
    public void Order_status_changed_matches_the_published_contract()
    {
        var sample = LoadSample("order.status_changed.v1.json");
        var produced = JsonSerializer.SerializeToElement(
            new OrderStatusChangedV1(Guid.NewGuid(), "SO-1", "a@b.test", "A", "Paid", "Shipped", DateTimeOffset.UtcNow), Json);

        Assert.Equal(IntegrationEventTypes.OrderStatusChanged, sample.GetProperty("type").GetString());
        AssertSameShape(sample.GetProperty("payload"), produced);
    }

    [Fact]
    public void The_envelope_matches_the_published_contract()
    {
        var sample = LoadSample("order.placed.v1.json");
        var produced = JsonSerializer.SerializeToElement(
            new IntegrationEventEnvelope(Guid.NewGuid(), "t", DateTimeOffset.UtcNow, JsonSerializer.SerializeToElement(new { })), Json);

        AssertSameShape(sample, produced);
    }

    private static void AssertSameShape(JsonElement expected, JsonElement actual)
    {
        var expectedFields = expected.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.ValueKind);
        var actualFields = actual.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.ValueKind);
        Assert.Equal(expectedFields.OrderBy(f => f.Key), actualFields.OrderBy(f => f.Key));
    }

    private static JsonElement LoadSample(string fileName)
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            var path = Path.Combine(directory.FullName, "services", "contracts", "events", fileName);
            if (File.Exists(path))
            {
                return JsonDocument.Parse(File.ReadAllText(path)).RootElement.Clone();
            }
        }

        throw new FileNotFoundException($"Contract sample {fileName} not found above {AppContext.BaseDirectory}.");
    }
}
