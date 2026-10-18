using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Shop.Api.Domain;
using Shop.Api.Features.Auth;
using Shop.Api.Infrastructure.Persistence;
using Testcontainers.PostgreSql;

[assembly: AssemblyFixture(typeof(Shop.Api.IntegrationTests.ApiFixture))]

namespace Shop.Api.IntegrationTests;

/// <summary>
/// One real PostgreSQL database and one in-memory API host for the whole test run.
/// By default the database is a throw-away Testcontainers container (Docker required). Setting
/// SHOP_TEST_CONNECTION_STRING uses an existing server instead (e.g. a CI service container).
/// Migrations and seed data are applied exactly as in development. Tests isolate themselves by creating
/// their own users and products with unique names instead of truncating shared tables.
/// </summary>
public sealed class ApiFixture : IAsyncLifetime
{
    public const string ExternalDatabaseVariable = "SHOP_TEST_CONNECTION_STRING";
    public static readonly JsonSerializerOptions Json = CreateJsonOptions();

    private PostgreSqlContainer? _postgres;

    public WebApplicationFactory<Program> Factory { get; private set; } = null!;

    public async ValueTask InitializeAsync()
    {
        var connectionString = await ResolveDatabaseAsync();

        Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:Shop", connectionString);
            builder.UseSetting("Auth:SigningKey", "TEST-ONLY-signing-key-0123456789-abcdefghijklmnop");
            builder.UseSetting("Auth:RefreshCookieSecure", "false");
            builder.UseSetting("Database:ApplyMigrationsOnStartup", "true");
            builder.UseSetting("Database:SeedDevelopmentData", "true");
            builder.UseSetting("RateLimiting:AuthPermitLimit", "100000");
            builder.UseSetting("RateLimiting:CheckoutPermitLimit", "100000");
            builder.UseSetting("RateLimiting:AssistantPermitLimit", "100000");
            builder.UseSetting("Logging:LogLevel:Default", "Warning");
        });

        // Force host start-up (migrations + seed) once, before any test runs.
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

    private async Task<string> ResolveDatabaseAsync()
    {
        var external = Environment.GetEnvironmentVariable(ExternalDatabaseVariable);
        if (!string.IsNullOrWhiteSpace(external))
        {
            // The tests write data and never clean up, so refuse anything that looks like a real database.
            var database = new NpgsqlConnectionStringBuilder(external).Database;
            if (database is null || !database.Contains("test", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    $"{ExternalDatabaseVariable} must point to a dedicated database whose name contains 'test'.");
            }

            return external;
        }

        _postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
        await _postgres.StartAsync();
        return _postgres.GetConnectionString();
    }

    public HttpClient CreateClient() => Factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true });

    public async Task<(HttpClient Client, AuthResponse Auth)> RegisterCustomerAsync()
    {
        var client = CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(
            $"customer-{Guid.NewGuid():N}@test.local", "Password-123", "Test Customer"));
        response.EnsureSuccessStatusCode();
        var auth = (await response.Content.ReadFromJsonAsync<AuthResponse>(Json))!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return (client, auth);
    }

    public async Task<HttpClient> LoginAdminAsync()
    {
        var client = CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest(DevelopmentSeeder.AdminEmail, DevelopmentSeeder.AdminPassword));
        response.EnsureSuccessStatusCode();
        var auth = (await response.Content.ReadFromJsonAsync<AuthResponse>(Json))!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return client;
    }

    /// <summary>Creates an isolated product directly in the database so a test fully controls its stock.</summary>
    public async Task<Product> CreateProductAsync(int stock, decimal price = 25.00m, string? name = null)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ShopDbContext>();
        var categoryId = await db.Categories.OrderBy(c => c.Id).Select(c => c.Id).FirstAsync();
        name ??= $"Test Product {Guid.NewGuid():N}";
        var product = new Product(name, name, "Integration test product", "TestBrand", price, stock, categoryId, null, DateTimeOffset.UtcNow);
        db.Products.Add(product);
        await db.SaveChangesAsync();
        return product;
    }

    public async Task<int> GetStockAsync(int productId)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ShopDbContext>();
        return await db.Products.Where(p => p.Id == productId).Select(p => p.StockQuantity).SingleAsync();
    }

    public async Task<T> QueryAsync<T>(Func<ShopDbContext, Task<T>> query)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        return await query(scope.ServiceProvider.GetRequiredService<ShopDbContext>());
    }

    private static JsonSerializerOptions CreateJsonOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        options.Converters.Add(new JsonStringEnumConverter());
        return options;
    }
}

public static class HttpTestExtensions
{
    public static async Task<T> ReadAsync<T>(this HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<T>(ApiFixture.Json))!;

    public static async Task<string> ReadProblemCodeAsync(this HttpResponseMessage response)
    {
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.GetProperty("code").GetString()!;
    }
}
