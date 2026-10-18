using Microsoft.Extensions.Options;

namespace Shop.Api.Infrastructure.Messaging;

public static class MessagingRegistration
{
    public static IServiceCollection AddShopMessaging(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<Outbox>();
        services.AddOptions<OutboxOptions>().BindConfiguration(OutboxOptions.SectionName).ValidateDataAnnotations().ValidateOnStart();
        services.AddOptions<NotificationsOptions>()
            .BindConfiguration(NotificationsOptions.SectionName)
            .Validate(o => o.BaseUrl is null || !string.IsNullOrWhiteSpace(o.ServiceKey),
                "Notifications:ServiceKey is required when Notifications:BaseUrl is set.")
            .ValidateOnStart();

        // Without a consumer, events are still recorded (and published once one is configured).
        if (configuration.GetValue<Uri?>($"{NotificationsOptions.SectionName}:BaseUrl") is null)
        {
            return services;
        }

        services.AddHttpClient<NotificationsClient>((sp, http) =>
            {
                var baseUrl = sp.GetRequiredService<IOptions<NotificationsOptions>>().Value.BaseUrl!;
                http.BaseAddress = new Uri(baseUrl.ToString().TrimEnd('/') + "/");
            })
            .AddStandardResilienceHandler(resilience =>
            {
                resilience.AttemptTimeout.Timeout = TimeSpan.FromSeconds(5);
                resilience.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(20);
                resilience.Retry.MaxRetryAttempts = 2;
                // After repeated failures, stop calling for a while: fail fast instead of piling up timeouts.
                resilience.CircuitBreaker.SamplingDuration = TimeSpan.FromSeconds(30);
                resilience.CircuitBreaker.BreakDuration = TimeSpan.FromSeconds(15);
            });
        services.AddScoped<OutboxProcessor>();

        if (configuration.GetValue($"{OutboxOptions.SectionName}:PublisherEnabled", true))
        {
            services.AddHostedService<OutboxPublisher>();
        }

        return services;
    }
}
