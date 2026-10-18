using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Shop.Api.Infrastructure.Auth;

namespace Shop.Api.Features.Assistant;

/// <summary>
/// Anonymous on purpose: it only reads public catalog data, so the assistant microfrontend needs no access token.
/// Rate-limited per client IP because every call may cost model time.
/// </summary>
[ApiController]
[Route("api/assistant")]
[EnableRateLimiting(RateLimitPolicies.Assistant)]
public sealed class AssistantController(AssistantService assistant) : ControllerBase
{
    [HttpPost("ask")]
    public Task<AssistantAnswerDto> Ask(AskAssistantRequest request, CancellationToken cancellationToken) =>
        assistant.AskAsync(request.Question, request.History ?? [], cancellationToken);
}
