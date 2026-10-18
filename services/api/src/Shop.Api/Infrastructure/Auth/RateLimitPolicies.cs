using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace Shop.Api.Infrastructure.Auth;

public sealed class RateLimitingOptions
{
    public const string SectionName = "RateLimiting";

    public int AuthPermitLimit { get; init; } = 10;
    public TimeSpan AuthWindow { get; init; } = TimeSpan.FromMinutes(1);
    public int CheckoutPermitLimit { get; init; } = 10;
    public TimeSpan CheckoutWindow { get; init; } = TimeSpan.FromMinutes(1);
}

public static class RateLimitPolicies
{
    public const string Auth = "auth";
    public const string Checkout = "checkout";

    public static IServiceCollection AddShopRateLimiting(this IServiceCollection services)
    {
        services.AddOptions<RateLimitingOptions>().BindConfiguration(RateLimitingOptions.SectionName);

        return services.AddRateLimiter(limiter =>
        {
            limiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // Brute-force protection for credential endpoints, partitioned by client IP.
            limiter.AddPolicy(Auth, context =>
            {
                var options = context.RequestServices.GetRequiredService<IOptions<RateLimitingOptions>>().Value;
                return RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = options.AuthPermitLimit, Window = options.AuthWindow });
            });

            // Per-user limit for the most expensive write path.
            limiter.AddPolicy(Checkout, context =>
            {
                var options = context.RequestServices.GetRequiredService<IOptions<RateLimitingOptions>>().Value;
                return RateLimitPartition.GetFixedWindowLimiter(
                    context.User.FindFirst("sub")?.Value ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = options.CheckoutPermitLimit, Window = options.CheckoutWindow });
            });
        });
    }
}
