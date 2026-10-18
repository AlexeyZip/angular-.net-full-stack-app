using System.ComponentModel.DataAnnotations;

namespace Shop.Api.Features.Auth;

public sealed record RegisterRequest(
    [Required, EmailAddress, MaxLength(254)] string Email,
    [Required, MinLength(8), MaxLength(128)] string Password,
    [Required, MinLength(2), MaxLength(150)] string FullName);

public sealed record LoginRequest(
    [Required, EmailAddress, MaxLength(254)] string Email,
    [Required, MaxLength(128)] string Password);

public sealed record UpdateProfileRequest([Required, MinLength(2), MaxLength(150)] string FullName);

public sealed record UserDto(Guid Id, string Email, string FullName, string Role);

/// <summary>
/// Returned to the SPA. The access token is kept in memory only; the refresh token never appears
/// in a response body - it travels exclusively in an HttpOnly cookie.
/// </summary>
public sealed record AuthResponse(string AccessToken, DateTimeOffset AccessTokenExpiresAt, UserDto User);
