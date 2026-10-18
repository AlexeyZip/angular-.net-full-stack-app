using System.ComponentModel.DataAnnotations;

namespace Shop.Api.Infrastructure.Auth;

/// <summary>Bound from the "Auth" configuration section and validated at startup (fail fast).</summary>
public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    [Required]
    public string Issuer { get; init; } = string.Empty;

    [Required]
    public string Audience { get; init; } = string.Empty;

    /// <summary>HMAC-SHA256 key. Must come from user secrets / environment variables outside development.</summary>
    [Required, MinLength(32)]
    public string SigningKey { get; init; } = string.Empty;

    public TimeSpan AccessTokenLifetime { get; init; } = TimeSpan.FromMinutes(15);

    public TimeSpan RefreshTokenLifetime { get; init; } = TimeSpan.FromDays(7);

    /// <summary>Must be true whenever the API is served over HTTPS (all non-local environments).</summary>
    public bool RefreshCookieSecure { get; init; } = true;
}
