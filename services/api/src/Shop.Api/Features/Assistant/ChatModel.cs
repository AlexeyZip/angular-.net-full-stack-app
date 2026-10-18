namespace Shop.Api.Features.Assistant;

public enum ChatRole
{
    System,
    User,
}

public sealed record ChatMessage(ChatRole Role, string Content);

/// <summary>A retrieved product as the model sees it. Text fields are untrusted catalog content.</summary>
public sealed record SourceProduct(int Id, string Name, string Brand, string CategoryName, string Description);

/// <param name="Messages">What a real model receives.</param>
/// <param name="Sources">The same retrieved products in structured form, for providers that do not need text.</param>
public sealed record ChatRequest(IReadOnlyList<ChatMessage> Messages, IReadOnlyList<SourceProduct> Sources);

/// <summary>
/// Provider abstraction. Implementations must honour the cancellation token and throw on failure; the caller
/// decides how to degrade.
/// </summary>
public interface IChatModel
{
    string Name { get; }

    Task<string> CompleteAsync(ChatRequest request, CancellationToken cancellationToken);
}
