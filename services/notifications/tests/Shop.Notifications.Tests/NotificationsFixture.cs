using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Npgsql;
using Testcontainers.PostgreSql;

[assembly: AssemblyFixture(typeof(Shop.Notifications.Tests.NotificationsFixture))]

namespace Shop.Notifications.Tests;

/// <summary>
/// One real PostgreSQL database and one in-memory service host for the whole run. Testcontainers by default;
/// NOTIFICATIONS_TEST_CONNECTION_STRING uses an existing server (database name must contain "test").
/// </summary>
public sealed class NotificationsFixture : IAsyncLifetime
{
    public const string ServiceKey = "TEST-ONLY-notifications-service-key";
    private const string ExternalDatabaseVariable = "NOTIFICATIONS_TEST_CONNECTION_STRING";

    private PostgreSqlContainer? _postgres;

    public WebApplicationFactory<Program> Factory { get; private set; } = null!;

    public async ValueTask InitializeAsync()
    {
        var connectionString = await ResolveDatabaseAsync();
        Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:Notifications", connectionString);
            builder.UseSetting("ServiceAuth:ServiceKey", ServiceKey);
            builder.UseSetting("Database:ApplyMigrationsOnStartup", "true");
            builder.UseSetting("Logging:LogLevel:Default", "Warning");
        });

        using var client = Factory.CreateClient();
        (await client.GetAsync("/health/ready")).EnsureSuccessStatusCode();
    }

    public async ValueTask DisposeAsync()
    {
        await Factory.DisposeAsync();
        if (_postgres is not null)
        {
            await _postgres.DisposeAsync();
        }
    }

    /// <summary>A client authenticated as the shop API.</summary>
    public HttpClient CreateServiceClient(string? key = ServiceKey)
    {
        var client = Factory.CreateClient();
        if (key is not null)
        {
            client.DefaultRequestHeaders.Add("X-Service-Key", key);
        }

        return client;
    }

    /// <summary>A contract sample from services/contracts/events with a fresh message id and order number.</summary>
    public static JsonObject LoadSample(string fileName)
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            var path = Path.Combine(directory.FullName, "services", "contracts", "events", fileName);
            if (File.Exists(path))
            {
                var sample = JsonNode.Parse(File.ReadAllText(path))!.AsObject();
                sample["messageId"] = Guid.CreateVersion7().ToString();
                sample["payload"]!["orderNumber"] = $"SO-TEST-{Guid.NewGuid():N}"[..20];
                return sample;
            }
        }

        throw new FileNotFoundException($"Contract sample {fileName} not found above {AppContext.BaseDirectory}.");
    }

    private async Task<string> ResolveDatabaseAsync()
    {
        var external = Environment.GetEnvironmentVariable(ExternalDatabaseVariable);
        if (!string.IsNullOrWhiteSpace(external))
        {
            var database = new NpgsqlConnectionStringBuilder(external).Database;
            if (database is null || !database.Contains("test", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException($"{ExternalDatabaseVariable} must point to a database whose name contains 'test'.");
            }

            return external;
        }

        _postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await _postgres.StartAsync();
        return _postgres.GetConnectionString();
    }
}
