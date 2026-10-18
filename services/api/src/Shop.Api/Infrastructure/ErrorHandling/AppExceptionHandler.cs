using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shop.Api.Domain;

namespace Shop.Api.Infrastructure.ErrorHandling;

/// <summary>
/// Translates expected failures into problem-details responses. Anything not handled here falls
/// through to the framework's default handler, which returns a generic 500 without exception details.
/// Comparable to a NestJS exception filter registered globally.
/// </summary>
internal sealed class AppExceptionHandler(IProblemDetailsService problemDetails, ILogger<AppExceptionHandler> logger)
    : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var (status, code, title, details) = exception switch
        {
            AppException app => (app.StatusCode, app.Code, app.Message, app.Details),
            DbUpdateConcurrencyException => (
                StatusCodes.Status409Conflict,
                "concurrency_conflict",
                "The resource was modified by someone else. Reload it and try again.",
                (IReadOnlyDictionary<string, object?>?)null),
            BadHttpRequestException bad => (bad.StatusCode, "bad_request", "The request could not be read.", null),
            OperationCanceledException when httpContext.RequestAborted.IsCancellationRequested => (
                StatusCodes.Status499ClientClosedRequest, "client_closed_request", "The client closed the request.", null),
            _ => (0, string.Empty, string.Empty, null),
        };

        if (status == 0)
        {
            return false;
        }

        if (status == StatusCodes.Status499ClientClosedRequest)
        {
            logger.LogInformation("Request was cancelled by the client");
        }
        else
        {
            logger.LogWarning("Request failed with {StatusCode} {Code}: {Message}", status, code, title);
        }

        httpContext.Response.StatusCode = status;
        var problem = new ProblemDetails { Status = status, Title = title };
        problem.Extensions["code"] = code;
        if (details is not null)
        {
            problem.Extensions["details"] = details;
        }

        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problem,
            Exception = exception,
        });
    }
}
