namespace Shop.Api.Domain;

/// <summary>
/// A long-lived, single-use credential delivered in an HttpOnly cookie.
/// Only a SHA-256 hash is persisted, so a database leak does not leak usable tokens.
/// </summary>
public sealed class RefreshToken
{
    private RefreshToken()
    {
    }

    public RefreshToken(Guid userId, string tokenHash, DateTimeOffset expiresAt, DateTimeOffset now)
    {
        Id = Guid.CreateVersion7(now);
        UserId = userId;
        TokenHash = tokenHash;
        ExpiresAt = expiresAt;
        CreatedAt = now;
    }

    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public User User { get; private set; } = null!;
    public string TokenHash { get; private set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset ExpiresAt { get; private set; }
    public DateTimeOffset? RevokedAt { get; private set; }

    public bool IsActive(DateTimeOffset now) => RevokedAt is null && ExpiresAt > now;
}
