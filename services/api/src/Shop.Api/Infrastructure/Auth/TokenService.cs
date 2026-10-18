using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Shop.Api.Domain;

namespace Shop.Api.Infrastructure.Auth;

public sealed record AccessToken(string Token, DateTimeOffset ExpiresAt);

public sealed class TokenService(IOptions<AuthOptions> options, TimeProvider clock)
{
    private readonly AuthOptions _options = options.Value;

    public AccessToken CreateAccessToken(User user)
    {
        var now = clock.GetUtcNow();
        var expiresAt = now.Add(_options.AccessTokenLifetime);

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = _options.Issuer,
            Audience = _options.Audience,
            IssuedAt = now.UtcDateTime,
            NotBefore = now.UtcDateTime,
            Expires = expiresAt.UtcDateTime,
            SigningCredentials = new SigningCredentials(CreateSigningKey(_options.SigningKey), SecurityAlgorithms.HmacSha256),
            Subject = new ClaimsIdentity(
            [
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim(JwtRegisteredClaimNames.Name, user.FullName),
                new Claim(ShopClaims.Role, user.Role.ToString()),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
            ]),
        };

        return new AccessToken(new JsonWebTokenHandler().CreateToken(descriptor), expiresAt);
    }

    /// <summary>Opaque random value given to the browser. Only its hash is stored.</summary>
    public static string CreateRefreshTokenValue() => Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));

    public static string HashRefreshToken(string value) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    public static SymmetricSecurityKey CreateSigningKey(string key) => new(Encoding.UTF8.GetBytes(key));
}

public static class ShopClaims
{
    public const string Role = "role";
    public const string AdminPolicy = "AdminOnly";

    public static Guid GetRequiredUserId(this ClaimsPrincipal principal)
    {
        var value = principal.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return Guid.TryParse(value, out var id)
            ? id
            : throw AppException.Unauthorized("unauthenticated", "Authentication is required.");
    }
}
