namespace Shop.Api.Domain;

public enum UserRole
{
    Customer,
    Admin,
}

public sealed class User
{
    private User()
    {
    }

    public User(string email, string fullName, UserRole role, DateTimeOffset now)
    {
        Id = Guid.CreateVersion7(now);
        Email = NormalizeEmail(email);
        FullName = fullName.Trim();
        Role = role;
        CreatedAt = now;
    }

    public Guid Id { get; private set; }

    /// <summary>Stored lower-cased; a unique index enforces one account per email.</summary>
    public string Email { get; private set; } = string.Empty;

    public string FullName { get; private set; } = string.Empty;

    /// <summary>PBKDF2 hash produced by ASP.NET Core's <c>PasswordHasher</c>. Never the password itself.</summary>
    public string PasswordHash { get; private set; } = string.Empty;

    public UserRole Role { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }

    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    public void SetPasswordHash(string passwordHash) => PasswordHash = passwordHash;

    public void UpdateProfile(string fullName) => FullName = fullName.Trim();
}
