namespace Shop.Api.Domain;

/// <summary>
/// An expected, client-visible failure (business rule violation, missing resource, conflict).
/// The global exception handler converts it into an RFC 9457 problem-details response.
/// Unexpected exceptions are NOT AppExceptions and are returned as a generic 500 without internals.
/// </summary>
public sealed class AppException : Exception
{
    public AppException(int statusCode, string code, string message, IReadOnlyDictionary<string, object?>? details = null)
        : base(message)
    {
        StatusCode = statusCode;
        Code = code;
        Details = details;
    }

    public int StatusCode { get; }

    /// <summary>Stable machine-readable error code that the frontend can switch on.</summary>
    public string Code { get; }

    public IReadOnlyDictionary<string, object?>? Details { get; }

    public static AppException NotFound(string resource, object id) =>
        new(StatusCodes.Status404NotFound, "not_found", $"{resource} '{id}' was not found.");

    public static AppException Conflict(string code, string message, IReadOnlyDictionary<string, object?>? details = null) =>
        new(StatusCodes.Status409Conflict, code, message, details);

    public static AppException BusinessRule(string code, string message, IReadOnlyDictionary<string, object?>? details = null) =>
        new(StatusCodes.Status422UnprocessableEntity, code, message, details);

    public static AppException Unauthorized(string code, string message) =>
        new(StatusCodes.Status401Unauthorized, code, message);
}
