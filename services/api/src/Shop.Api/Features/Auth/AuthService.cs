using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Shop.Api.Domain;
using Shop.Api.Infrastructure.Auth;
using Shop.Api.Infrastructure.Persistence;

namespace Shop.Api.Features.Auth;

public sealed record AuthResult(AuthResponse Response, string RefreshToken, DateTimeOffset RefreshTokenExpiresAt);

public sealed class AuthService(
    ShopDbContext db,
    TokenService tokens,
    IPasswordHasher<User> passwordHasher,
    IOptions<AuthOptions> options,
    TimeProvider clock,
    ILogger<AuthService> logger)
{
    private static readonly AppException InvalidCredentials =
        AppException.Unauthorized("invalid_credentials", "Email or password is incorrect.");

    public async Task<AuthResult> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken)
    {
        PasswordPolicy.EnsureValid(request.Password);

        var email = User.NormalizeEmail(request.Email);
        if (await db.Users.AnyAsync(u => u.Email == email, cancellationToken))
        {
            throw AppException.Conflict("email_taken", "An account with this email already exists.");
        }

        // Role is never taken from the request: self-registration always creates a customer.
        var user = new User(email, request.FullName, UserRole.Customer, clock.GetUtcNow());
        user.SetPasswordHash(passwordHasher.HashPassword(user, request.Password));
        db.Users.Add(user);

        try
        {
            return await IssueTokensAsync(user, cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.IsUniqueViolation())
        {
            throw AppException.Conflict("email_taken", "An account with this email already exists.");
        }
    }

    public async Task<AuthResult> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        var email = User.NormalizeEmail(request.Email);
        var user = await db.Users.SingleOrDefaultAsync(u => u.Email == email, cancellationToken);
        if (user is null)
        {
            // Same error for unknown email and wrong password: do not reveal which accounts exist.
            throw InvalidCredentials;
        }

        var result = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (result == PasswordVerificationResult.Failed)
        {
            logger.LogWarning("Failed login for user {UserId}", user.Id);
            throw InvalidCredentials;
        }

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.SetPasswordHash(passwordHasher.HashPassword(user, request.Password));
        }

        return await IssueTokensAsync(user, cancellationToken);
    }

    /// <summary>
    /// Refresh-token rotation: each refresh token is single use. Presenting an already-rotated token
    /// means it was probably stolen, so every active session of that user is revoked.
    /// </summary>
    public async Task<AuthResult> RefreshAsync(string? refreshToken, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(refreshToken))
        {
            throw AppException.Unauthorized("refresh_token_missing", "No active session.");
        }

        var now = clock.GetUtcNow();
        var hash = TokenService.HashRefreshToken(refreshToken);
        var stored = await db.RefreshTokens
            .AsNoTracking()
            .Include(t => t.User)
            .SingleOrDefaultAsync(t => t.TokenHash == hash, cancellationToken);

        if (stored is null)
        {
            throw AppException.Unauthorized("refresh_token_invalid", "The session is invalid or has expired.");
        }

        if (stored.RevokedAt is not null)
        {
            logger.LogWarning("Refresh token reuse detected for user {UserId}; revoking all sessions", stored.UserId);
            await db.RefreshTokens
                .Where(t => t.UserId == stored.UserId && t.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), cancellationToken);
            throw AppException.Unauthorized("refresh_token_invalid", "The session is invalid or has expired.");
        }

        if (!stored.IsActive(now))
        {
            throw AppException.Unauthorized("refresh_token_invalid", "The session is invalid or has expired.");
        }

        // Conditional UPDATE: if two requests race with the same token, exactly one of them rotates it.
        var rotated = await db.RefreshTokens
            .Where(t => t.Id == stored.Id && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), cancellationToken);
        if (rotated == 0)
        {
            throw AppException.Unauthorized("refresh_token_invalid", "The session is invalid or has expired.");
        }

        return await IssueTokensAsync(stored.User, cancellationToken);
    }

    public async Task LogoutAsync(string? refreshToken, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(refreshToken))
        {
            return;
        }

        var hash = TokenService.HashRefreshToken(refreshToken);
        var now = clock.GetUtcNow();
        await db.RefreshTokens
            .Where(t => t.TokenHash == hash && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), cancellationToken);
    }

    public async Task<UserDto> GetUserAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == userId, cancellationToken)
            ?? throw AppException.Unauthorized("unauthenticated", "Authentication is required.");
        return ToDto(user);
    }

    public async Task<UserDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleOrDefaultAsync(u => u.Id == userId, cancellationToken)
            ?? throw AppException.Unauthorized("unauthenticated", "Authentication is required.");
        user.UpdateProfile(request.FullName);
        await db.SaveChangesAsync(cancellationToken);
        return ToDto(user);
    }

    private async Task<AuthResult> IssueTokensAsync(User user, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var refreshValue = TokenService.CreateRefreshTokenValue();
        var refreshExpiresAt = now.Add(options.Value.RefreshTokenLifetime);
        db.RefreshTokens.Add(new RefreshToken(user.Id, TokenService.HashRefreshToken(refreshValue), refreshExpiresAt, now));

        await db.SaveChangesAsync(cancellationToken);

        var access = tokens.CreateAccessToken(user);
        return new AuthResult(new AuthResponse(access.Token, access.ExpiresAt, ToDto(user)), refreshValue, refreshExpiresAt);
    }

    private static UserDto ToDto(User user) => new(user.Id, user.Email, user.FullName, user.Role.ToString());
}

public static class PasswordPolicy
{
    public static void EnsureValid(string password)
    {
        if (password.Length < 8 || !password.Any(char.IsLetter) || !password.Any(char.IsDigit))
        {
            throw AppException.BusinessRule(
                "weak_password", "Password must be at least 8 characters long and contain letters and digits.");
        }
    }
}
