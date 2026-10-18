using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using Shop.Api.Domain;
using Shop.Api.Infrastructure.Auth;

namespace Shop.Api.Features.Auth;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(AuthService auth, IOptions<AuthOptions> options) : ControllerBase
{
    public const string RefreshCookieName = "shop_refresh";

    /// <summary>
    /// Cookie-authenticated endpoints (refresh/logout) require this header. Browsers cannot attach a custom
    /// header to a cross-site request without a CORS preflight, which our CORS policy rejects: a CSRF guard
    /// in addition to SameSite=Strict.
    /// </summary>
    public const string CsrfHeaderName = "X-Shop-Client";

    [HttpPost("register")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        var result = await auth.RegisterAsync(request, cancellationToken);
        SetRefreshCookie(result);
        return StatusCode(StatusCodes.Status201Created, result.Response);
    }

    [HttpPost("login")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<AuthResponse> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var result = await auth.LoginAsync(request, cancellationToken);
        SetRefreshCookie(result);
        return result.Response;
    }

    [HttpPost("refresh")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<AuthResponse> Refresh(CancellationToken cancellationToken)
    {
        EnsureCsrfHeader();
        try
        {
            var result = await auth.RefreshAsync(Request.Cookies[RefreshCookieName], cancellationToken);
            SetRefreshCookie(result);
            return result.Response;
        }
        catch (AppException)
        {
            ClearRefreshCookie();
            throw;
        }
    }

    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        EnsureCsrfHeader();
        await auth.LogoutAsync(Request.Cookies[RefreshCookieName], cancellationToken);
        ClearRefreshCookie();
        return NoContent();
    }

    [Authorize]
    [HttpGet("me")]
    public Task<UserDto> Me(CancellationToken cancellationToken) =>
        auth.GetUserAsync(User.GetRequiredUserId(), cancellationToken);

    [Authorize]
    [HttpPut("me")]
    public Task<UserDto> UpdateProfile(UpdateProfileRequest request, CancellationToken cancellationToken) =>
        auth.UpdateProfileAsync(User.GetRequiredUserId(), request, cancellationToken);

    private void EnsureCsrfHeader()
    {
        if (!Request.Headers.ContainsKey(CsrfHeaderName))
        {
            throw new AppException(StatusCodes.Status400BadRequest, "csrf_header_missing", $"The {CsrfHeaderName} header is required.");
        }
    }

    private void SetRefreshCookie(AuthResult result) =>
        Response.Cookies.Append(RefreshCookieName, result.RefreshToken, CreateCookieOptions(result.RefreshTokenExpiresAt));

    private void ClearRefreshCookie() =>
        Response.Cookies.Delete(RefreshCookieName, CreateCookieOptions(expires: null));

    private CookieOptions CreateCookieOptions(DateTimeOffset? expires) => new()
    {
        HttpOnly = true, // not readable from JavaScript, so XSS cannot exfiltrate it
        Secure = options.Value.RefreshCookieSecure,
        SameSite = SameSiteMode.Strict,
        Path = "/api/auth", // only sent to the endpoints that need it
        Expires = expires,
        IsEssential = true,
    };
}
