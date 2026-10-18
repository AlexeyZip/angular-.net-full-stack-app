using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Shop.Notifications.Security;

public sealed class ServiceAuthOptions
{
    public const string SectionName = "ServiceAuth";

    /// <summary>Shared secret of the calling service. Only DEV-ONLY placeholders live in the repository.</summary>
    [Required, MinLength(16)]
    public string ServiceKey { get; init; } = string.Empty;
}

/// <summary>
/// Service-to-service authentication with a shared key in a header. As an authentication scheme it runs in
/// the authorization middleware, before the request body is read. Production alternatives: mTLS or
/// client-credentials tokens from an identity provider.
/// </summary>
public sealed class ServiceKeyAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IOptions<ServiceAuthOptions> serviceAuth)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "ServiceKey";
    public const string HeaderName = "X-Service-Key";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(HeaderName, out var presented) || presented.Count != 1)
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        if (!KeysMatch(presented.ToString(), serviceAuth.Value.ServiceKey))
        {
            return Task.FromResult(AuthenticateResult.Fail("Invalid service key."));
        }

        var identity = new ClaimsIdentity([new Claim(ClaimTypes.Name, "shop-api")], SchemeName);
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
    }

    protected override async Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status401Unauthorized;
        await Results.Problem(
                statusCode: StatusCodes.Status401Unauthorized,
                title: "A valid service key is required.",
                extensions: new Dictionary<string, object?> { ["code"] = "invalid_service_key" })
            .ExecuteAsync(Context);
    }

    /// <summary>Hashing first gives equal-length inputs, so the comparison time reveals neither content nor length.</summary>
    internal static bool KeysMatch(string presented, string expected) =>
        CryptographicOperations.FixedTimeEquals(
            SHA256.HashData(Encoding.UTF8.GetBytes(presented)),
            SHA256.HashData(Encoding.UTF8.GetBytes(expected)));
}
