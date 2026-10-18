using System.Diagnostics;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Shop.Notifications.Events;
using Shop.Notifications.Persistence;
using Shop.Notifications.Security;

// Notifications microservice: receives integration events from Shop.Api (transactional outbox) and turns
// them into simulated e-mails. A deliberately small, separately deployable service with its own database.
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
    context.ProblemDetails.Extensions.TryAdd("traceId", Activity.Current?.Id ?? context.HttpContext.TraceIdentifier));

builder.Services.AddDbContext<NotificationsDbContext>((services, options) => options
    .UseNpgsql(services.GetRequiredService<IConfiguration>().GetConnectionString("Notifications")
        ?? throw new InvalidOperationException("Connection string 'ConnectionStrings:Notifications' is not configured."))
    .UseSnakeCaseNamingConvention());

builder.Services.AddOptions<ServiceAuthOptions>().BindConfiguration(ServiceAuthOptions.SectionName).ValidateDataAnnotations().ValidateOnStart();
builder.Services.AddAuthentication(ServiceKeyAuthenticationHandler.SchemeName)
    .AddScheme<AuthenticationSchemeOptions, ServiceKeyAuthenticationHandler>(ServiceKeyAuthenticationHandler.SchemeName, null);
builder.Services.AddAuthorization();

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<EventIngestor>();
builder.Services.AddHealthChecks().AddDbContextCheck<NotificationsDbContext>("database", tags: ["ready"]);

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseAuthentication();
app.UseAuthorization();

var internalApi = app.MapGroup("/internal").RequireAuthorization();

// 200 for processed and for duplicates: the producer only needs to know it may stop retrying.
internalApi.MapPost("/events", async (IntegrationEventEnvelope envelope, EventIngestor ingestor, CancellationToken cancellationToken) =>
{
    var result = await ingestor.IngestAsync(envelope, cancellationToken);
    return result.Outcome == IngestOutcome.Rejected
        ? Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: result.Error,
            extensions: new Dictionary<string, object?> { ["code"] = result.ErrorCode })
        : Results.Ok(new { status = result.Outcome == IngestOutcome.Duplicate ? "duplicate" : "processed" });
});

// Lets developers and tests inspect what would have been sent. Looked up by order number, not by e-mail:
// query strings end up in access logs.
internalApi.MapGet("/notifications", async (string reference, NotificationsDbContext db, CancellationToken cancellationToken) =>
    await db.Notifications.AsNoTracking()
        .Where(n => n.Reference == reference)
        .OrderBy(n => n.CreatedAt)
        .Take(50)
        .Select(n => new { n.Id, n.MessageId, n.Channel, n.Reference, n.Recipient, n.Subject, n.Body, n.CreatedAt })
        .ToListAsync(cancellationToken));

app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") });

if (app.Configuration.GetValue<bool>("Database:ApplyMigrationsOnStartup"))
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<NotificationsDbContext>().Database.MigrateAsync();
}

await app.RunAsync();

/// <summary>Exposed for WebApplicationFactory in tests.</summary>
public partial class Program;
