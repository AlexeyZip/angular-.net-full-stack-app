using System.ComponentModel.DataAnnotations;

namespace Shop.Api.Features.Assistant;

/// <summary>
/// <c>History</c> holds earlier turns of the same conversation, oldest first. It is optional: the server keeps no
/// chat state, the client sends what a follow-up question needs.
/// </summary>
public sealed record AskAssistantRequest(
    [Required, MinLength(3), MaxLength(AssistantLimits.MaxQuestionLength)] string Question,
    [MaxLength(AssistantLimits.MaxHistoryTurns)] IReadOnlyList<AssistantTurnDto>? History = null);

/// <summary>
/// An earlier turn as the client remembers it: the question and the ids of the products it was shown. The answer
/// text is deliberately not accepted back, so a client cannot put words into the assistant's mouth; product ids are
/// only hints that are looked up again in the database.
/// </summary>
public sealed record AssistantTurnDto(
    [Required, MaxLength(AssistantLimits.MaxQuestionLength)] string Question,
    [MaxLength(AssistantLimits.MaxSources)] IReadOnlyList<int>? ProductIds = null);

/// <summary>
/// Products always come from the database (price, stock), never from the model's text.
/// <paramref name="Degraded"/> is true when the model failed and only retrieval results are returned.
/// </summary>
public sealed record AssistantAnswerDto(string Answer, IReadOnlyList<AssistantProductDto> Products, string Provider, bool Degraded);

public sealed record AssistantProductDto(int Id, string Name, string Slug, string Brand, string CategoryName, decimal Price, int StockQuantity);

public static class AssistantLimits
{
    public const int MaxQuestionLength = 500;
    public const int MaxSources = 5;
    public const int MaxDescriptionLength = 300;
    public const int MaxAnswerLength = 2_000;
    public const int MaxHistoryTurns = 4;
}
