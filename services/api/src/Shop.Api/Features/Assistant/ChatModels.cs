using System.ComponentModel.DataAnnotations;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace Shop.Api.Features.Assistant;

public sealed class AssistantOptions
{
    public const string SectionName = "Assistant";

    /// <summary><c>Mock</c> (default, offline, free) or <c>OpenAiCompatible</c> (e.g. a local Ollama server).</summary>
    public string Provider { get; init; } = MockChatModel.ProviderName;

    public OpenAiCompatibleOptions OpenAiCompatible { get; init; } = new();
}

public sealed class OpenAiCompatibleOptions
{
    /// <summary>Base URL including the API version segment, e.g. <c>http://localhost:11434/v1</c> for Ollama.</summary>
    public Uri? BaseUrl { get; init; }

    public string Model { get; init; } = string.Empty;

    /// <summary>Optional. Comes from user secrets or the environment, never from appsettings in the repository.</summary>
    public string? ApiKey { get; init; }

    /// <summary>Per attempt. A local model on a CPU can need a minute for its first answer while it loads.</summary>
    [Range(typeof(TimeSpan), "00:00:01", "00:03:00")]
    public TimeSpan Timeout { get; init; } = TimeSpan.FromSeconds(20);

    /// <summary>Caps generation time and cost; the answer is limited to about 120 words anyway.</summary>
    [Range(50, 2000)]
    public int MaxOutputTokens { get; init; } = 400;

    /// <summary>Sends one tiny request at start-up so a local server loads the model before the first user asks.</summary>
    public bool WarmUpOnStart { get; init; }
}

/// <summary>
/// Deterministic offline provider for development and tests. It "answers" from the structured sources it is
/// given, uses the same citation format a real model is asked to use, and never invents products.
/// </summary>
public sealed class MockChatModel : IChatModel
{
    public const string ProviderName = "Mock";

    public string Name => ProviderName;

    public Task<string> CompleteAsync(ChatRequest request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (request.Sources.Count == 0)
        {
            return Task.FromResult("I could not find products that match your question. Try other words or browse the catalog.");
        }

        var answer = new StringBuilder(request.Sources.Count == 1 ? "This product matches your question: " : "These products match your question: ");
        answer.AppendJoin("; ", request.Sources.Select(p => $"{p.Name} by {p.Brand} ({p.CategoryName}) [P:{p.Id}]"));
        answer.Append(". Prices and availability below come straight from the catalog.");
        return Task.FromResult(answer.ToString());
    }
}

/// <summary>
/// Client for any server that implements the OpenAI chat-completions API (Ollama, LM Studio, vLLM, hosted
/// providers). Disabled unless configured. Timeouts, retries and the circuit breaker come from the resilience
/// handler registered in <see cref="AssistantRegistration"/>.
/// </summary>
public sealed class OpenAiCompatibleChatModel(HttpClient http, IOptions<AssistantOptions> options) : IChatModel
{
    public const string ProviderName = "OpenAiCompatible";

    /// <summary>Shown to users as "Answered by", so it names the model rather than the protocol.</summary>
    public string Name => options.Value.OpenAiCompatible.Model;

    public async Task<string> CompleteAsync(ChatRequest request, CancellationToken cancellationToken)
    {
        var settings = options.Value.OpenAiCompatible;
        using var message = new HttpRequestMessage(HttpMethod.Post, "chat/completions")
        {
            Content = JsonContent.Create(new CompletionRequest(
                settings.Model,
                request.Messages.Select(m => new CompletionMessage(m.Role == ChatRole.System ? "system" : "user", m.Content)).ToList(),
                Temperature: 0,
                settings.MaxOutputTokens)),
        };
        if (!string.IsNullOrWhiteSpace(settings.ApiKey))
        {
            message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.ApiKey);
        }

        using var response = await http.SendAsync(message, cancellationToken);
        response.EnsureSuccessStatusCode();
        var completion = await response.Content.ReadFromJsonAsync<CompletionResponse>(cancellationToken);
        return completion?.Choices.FirstOrDefault()?.Message.Content
            ?? throw new InvalidOperationException("The model returned no choices.");
    }

    private sealed record CompletionRequest(
        [property: JsonPropertyName("model")] string Model,
        [property: JsonPropertyName("messages")] IReadOnlyList<CompletionMessage> Messages,
        [property: JsonPropertyName("temperature")] double Temperature,
        [property: JsonPropertyName("max_tokens")] int MaxTokens);

    private sealed record CompletionMessage(
        [property: JsonPropertyName("role")] string Role,
        [property: JsonPropertyName("content")] string Content);

    private sealed record CompletionResponse([property: JsonPropertyName("choices")] IReadOnlyList<CompletionChoice> Choices);

    private sealed record CompletionChoice([property: JsonPropertyName("message")] CompletionMessage Message);
}
