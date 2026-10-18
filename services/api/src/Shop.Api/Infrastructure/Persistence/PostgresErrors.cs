using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Shop.Api.Infrastructure.Persistence;

public static class PostgresErrors
{
    public static bool IsUniqueViolation(this DbUpdateException exception, string? constraintName = null) =>
        exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } pg
        && (constraintName is null || pg.ConstraintName == constraintName);
}
