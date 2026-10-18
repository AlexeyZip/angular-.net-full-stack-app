using System.Diagnostics;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using Shop.Api.Domain;
using Shop.Api.Features.Admin;
using Shop.Api.Features.Assistant;
using Shop.Api.Features.Auth;
using Shop.Api.Features.Catalog;
using Shop.Api.Features.Orders;
using Shop.Api.Infrastructure.Audit;
using Shop.Api.Infrastructure.Auth;
using Shop.Api.Infrastructure.ErrorHandling;
using Shop.Api.Infrastructure.Messaging;
using Shop.Api.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

// ---------- Web layer ----------
builder.Services
    .AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.Configure<JsonOptions>(options => options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
{
    // A trace id in every error response lets support correlate a user report with server logs.
    context.ProblemDetails.Extensions.TryAdd("traceId", Activity.Current?.Id ?? context.HttpContext.TraceIdentifier);
    if (context.ProblemDetails is HttpValidationProblemDetails)
    {
        context.ProblemDetails.Extensions.TryAdd("code", "validation_failed");
    }
});
builder.Services.AddExceptionHandler<AppExceptionHandler>();
builder.Services.AddOpenApi();
builder.Services.AddShopRateLimiting();

builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
{
    // The SPA is served from the same origin (dev proxy / nginx), so no origins are allowed by default.
    var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
    policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
}));

// ---------- Persistence ----------
builder.Services.AddDbContext<ShopDbContext>((services, options) => options
    .UseNpgsql(services.GetRequiredService<IConfiguration>().GetConnectionString("Shop")
        ?? throw new InvalidOperationException("Connection string 'ConnectionStrings:Shop' is not configured."))
    .UseSnakeCaseNamingConvention());

// ---------- Authentication & authorization ----------
builder.Services.AddOptions<AuthOptions>()
    .BindConfiguration(AuthOptions.SectionName)
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<AuthOptions>>((jwt, auth) =>
    {
        jwt.MapInboundClaims = false; // keep "sub"/"role" as issued instead of legacy SOAP claim URIs
        jwt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = auth.Value.Issuer,
            ValidAudience = auth.Value.Audience,
            IssuerSigningKey = TokenService.CreateSigningKey(auth.Value.SigningKey),
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            NameClaimType = "name",
            RoleClaimType = ShopClaims.Role,
            ClockSkew = TimeSpan.FromSeconds(30),
        };
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy(ShopClaims.AdminPolicy, policy => policy.RequireRole(nameof(UserRole.Admin)));

// ---------- Application services ----------
// Scoped = one instance per HTTP request, same lifetime as the DbContext they depend on.
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<PaymentSimulator>();
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<AuditLogger>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<CatalogService>();
builder.Services.AddScoped<ReviewService>();
builder.Services.AddScoped<CartQuoteService>();
builder.Services.AddScoped<CheckoutService>();
builder.Services.AddScoped<OrderQueries>();
builder.Services.AddScoped<OrderStatusService>();
builder.Services.AddScoped<AdminCatalogService>();
builder.Services.AddScoped<AdminOrdersService>();
builder.Services.AddScoped<DevelopmentSeeder>();
builder.Services.AddShopAssistant(builder.Configuration);
builder.Services.AddShopMessaging(builder.Configuration);

// ---------- Health ----------
builder.Services.AddHealthChecks().AddDbContextCheck<ShopDbContext>("database", tags: ["ready"]);

var app = builder.Build();

// ---------- HTTP pipeline (order matters, like NestJS middleware -> guards -> interceptors) ----------
if (app.Configuration.GetValue<bool>("ReverseProxy:TrustForwardedHeaders"))
{
    // Only safe when the API is reachable exclusively through the proxy (as in docker-compose, where the
    // api service publishes no port); otherwise any client could spoof X-Forwarded-For to dodge rate limits.
    var forwarded = new ForwardedHeadersOptions { ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto, ForwardLimit = 1 };
    forwarded.KnownIPNetworks.Clear();
    forwarded.KnownProxies.Clear();
    app.UseForwardedHeaders(forwarded);
}

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(); // interactive API docs at /scalar
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();

// Liveness: the process responds. Readiness: it can also reach PostgreSQL.
app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") });

await app.InitializeDatabaseAsync();
await app.RunAsync();

/// <summary>Exposed for WebApplicationFactory in integration tests.</summary>
public partial class Program;
