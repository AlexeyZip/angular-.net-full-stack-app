using Microsoft.EntityFrameworkCore;

namespace Shop.Api.Infrastructure.Persistence;

public sealed class DatabaseOptions
{
    public const string SectionName = "Database";

    /// <summary>Convenient locally; production applies migrations as a separate, reviewed deployment step.</summary>
    public bool ApplyMigrationsOnStartup { get; init; }

    public bool SeedDevelopmentData { get; init; }
}

public static class DatabaseStartup
{
    public static async Task InitializeDatabaseAsync(this WebApplication app)
    {
        var options = app.Configuration.GetSection(DatabaseOptions.SectionName).Get<DatabaseOptions>() ?? new DatabaseOptions();
        if (!options.ApplyMigrationsOnStartup && !options.SeedDevelopmentData)
        {
            return;
        }

        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ShopDbContext>();

        if (options.ApplyMigrationsOnStartup)
        {
            await db.Database.MigrateAsync();
        }

        if (options.SeedDevelopmentData)
        {
            if (app.Environment.IsProduction())
            {
                throw new InvalidOperationException("Development seed data must never be applied in Production.");
            }

            await scope.ServiceProvider.GetRequiredService<DevelopmentSeeder>().SeedAsync();
        }
    }
}
