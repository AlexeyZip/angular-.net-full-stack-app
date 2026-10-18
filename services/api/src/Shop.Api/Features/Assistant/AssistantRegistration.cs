using System.Net;
using Microsoft.Extensions.Options;

namespace Shop.Api.Features.Assistant;

public static class AssistantRegistration
{
    public static IServiceCollection AddShopAssistant(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<AssistantOptions>()
            .BindConfiguration(AssistantOptions.SectionName)
            .Validate(o => o.Provider is MockChatModel.ProviderName or OpenAiCompatibleChatModel.ProviderName,
                $"Assistant:Provider must be '{MockChatModel.ProviderName}' or '{OpenAiCompatibleChatModel.ProviderName}'.")
            .Validate(o => o.Provider != OpenAiCompatibleChatModel.ProviderName
                    || (o.OpenAiCompatible.BaseUrl is not null && !string.IsNullOrWhiteSpace(o.OpenAiCompatible.Model)),
                "Assistant:OpenAiCompatible:BaseUrl and Model are required for the OpenAiCompatible provider.")
            .ValidateOnStart();

        services.AddScoped<AssistantService>();

        var provider = configuration[$"{AssistantOptions.SectionName}:Provider"] ?? MockChatModel.ProviderName;
        if (provider == OpenAiCompatibleChatModel.ProviderName)
        {
            services.AddHttpClient<IChatModel, OpenAiCompatibleChatModel>((sp, http) =>
                {
                    var baseUrl = sp.GetRequiredService<IOptions<AssistantOptions>>().Value.OpenAiCompatible.BaseUrl!;
                    // A trailing slash makes the relative "chat/completions" resolve under the version segment.
                    http.BaseAddress = new Uri(baseUrl.ToString().TrimEnd('/') + "/");
                })
                .AddStandardResilienceHandler(resilience =>
                {
                    var timeout = configuration.GetValue<TimeSpan?>($"{AssistantOptions.SectionName}:OpenAiCompatible:Timeout")
                        ?? TimeSpan.FromSeconds(20);
                    resilience.AttemptTimeout.Timeout = timeout;
                    resilience.TotalRequestTimeout.Timeout = timeout * 2 + TimeSpan.FromSeconds(1);
                    // One retry for failures that end quickly (connection refused, model server restarting).
                    // A timed-out generation is not retried: the user would wait twice as long for the same result.
                    resilience.Retry.MaxRetryAttempts = 1;
                    resilience.Retry.ShouldHandle = args => ValueTask.FromResult(
                        args.Outcome.Exception is HttpRequestException
                        || args.Outcome.Result?.StatusCode is HttpStatusCode.BadGateway or HttpStatusCode.ServiceUnavailable);
                    resilience.CircuitBreaker.SamplingDuration = timeout * 2 + TimeSpan.FromSeconds(1);
                });

            if (configuration.GetValue<bool>($"{AssistantOptions.SectionName}:OpenAiCompatible:WarmUpOnStart"))
            {
                services.AddHostedService<ModelWarmUp>();
            }
        }
        else
        {
            services.AddSingleton<IChatModel, MockChatModel>();
        }

        return services;
    }
}

/// <summary>
/// Loads the model on a local server (Ollama) in the background at start-up. Failure is only logged:
/// the API must start even when the model server is down.
/// </summary>
internal sealed class ModelWarmUp(IServiceScopeFactory scopes, ILogger<ModelWarmUp> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await using var scope = scopes.CreateAsyncScope();
            var model = scope.ServiceProvider.GetRequiredService<IChatModel>();
            await model.CompleteAsync(
                new ChatRequest([new ChatMessage(ChatRole.System, "Reply with OK."), new ChatMessage(ChatRole.User, "Ping")], []),
                stoppingToken);
            logger.LogInformation("Assistant model {Provider} is warmed up", model.Name);
        }
        catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
        {
            logger.LogWarning(ex, "Assistant model warm-up failed; the first question will load the model");
        }
    }
}
