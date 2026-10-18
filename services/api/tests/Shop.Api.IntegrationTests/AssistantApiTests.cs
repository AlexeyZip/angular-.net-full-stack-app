using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Shop.Api.Features.Assistant;

namespace Shop.Api.IntegrationTests;

public sealed class AssistantApiTests(ApiFixture api)
{
    [Fact]
    public async Task Answers_cite_retrieved_products_with_prices_from_the_database()
    {
        var token = UniqueWord();
        var product = await api.CreateProductAsync(stock: 4, price: 42.50m, name: $"Zephyr {token} Kettle");

        var answer = await AskAsync(api.CreateClient(), $"Do you have a {token} kettle?");

        Assert.False(answer.Degraded);
        Assert.Equal(MockChatModel.ProviderName, answer.Provider);
        var shown = Assert.Single(answer.Products);
        Assert.Equal(product.Id, shown.Id);
        Assert.Equal(42.50m, shown.Price);
        Assert.Equal(4, shown.StockQuantity);
        Assert.Contains($"Zephyr {token} Kettle", answer.Answer);
        Assert.DoesNotContain("[P:", answer.Answer);
    }

    [Fact]
    public async Task A_product_matching_more_terms_is_found_even_when_a_common_term_matches_many_older_products()
    {
        var common = UniqueWord();
        var token = UniqueWord();
        for (var i = 0; i < 45; i++)
        {
            await api.CreateProductAsync(stock: 3, name: $"{common} Item {i}");
        }

        var target = await api.CreateProductAsync(stock: 3, name: $"{token} {common} Item");

        var answer = await AskAsync(api.CreateClient(), $"a {token} {common}");

        Assert.Equal(target.Id, answer.Products[0].Id);
    }

    [Fact]
    public async Task Price_and_stock_filters_from_the_question_are_applied_in_sql()
    {
        var token = UniqueWord();
        var cheap = await api.CreateProductAsync(stock: 10, price: 20m, name: $"{token} Lamp Small");
        await api.CreateProductAsync(stock: 10, price: 80m, name: $"{token} Lamp Large");
        await api.CreateProductAsync(stock: 0, price: 15m, name: $"{token} Lamp Sold Out");

        var answer = await AskAsync(api.CreateClient(), $"any {token} under $50 in stock?");

        Assert.Equal([cheap.Id], answer.Products.Select(p => p.Id));
    }

    [Fact]
    public async Task Archived_products_are_never_retrieved()
    {
        var token = UniqueWord();
        var archived = await api.CreateProductAsync(stock: 5, name: $"{token} Archived Speaker");
        await api.QueryAsync(db => db.Products.Where(p => p.Id == archived.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsActive, false), TestContext.Current.CancellationToken));

        var answer = await AskAsync(api.CreateClient(), $"show me {token}");

        Assert.Empty(answer.Products);
    }

    [Fact]
    public async Task A_failing_model_degrades_to_search_results_instead_of_an_error()
    {
        var token = UniqueWord();
        var product = await api.CreateProductAsync(stock: 3, name: $"{token} Router");
        await using var factory = api.Factory.WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services => services.AddSingleton<IChatModel, FailingChatModel>()));

        var answer = await AskAsync(factory.CreateClient(), $"show me {token}");

        Assert.True(answer.Degraded);
        Assert.Equal([product.Id], answer.Products.Select(p => p.Id));
    }

    [Fact]
    public async Task A_model_citing_unknown_products_cannot_add_them_to_the_answer()
    {
        var token = UniqueWord();
        var product = await api.CreateProductAsync(stock: 3, name: $"{token} Monitor");
        var output = $"Try {token} Monitor [P:{product.Id}] or the Apple Studio Display [P:2147483].";

        var answer = await AskWithModelAsync(output, $"show me {token}");

        Assert.Equal($"Try {token} Monitor or the Apple Studio Display.", answer.Answer);
        Assert.Equal([product.Id], answer.Products.Select(p => p.Id));
    }

    [Fact]
    public async Task An_answer_without_valid_citations_is_replaced_because_it_cannot_be_checked()
    {
        var token = UniqueWord();
        var product = await api.CreateProductAsync(stock: 3, name: $"{token} Keyboard");

        var answer = await AskWithModelAsync("We recommend the Logitech MX Keys and the Apple Magic Keyboard.", $"any {token}?");

        Assert.Equal(AssistantService.UncitedAnswer, answer.Answer);
        Assert.Equal([product.Id], answer.Products.Select(p => p.Id));
    }

    [Fact]
    public async Task An_answer_naming_retrieved_products_without_citations_is_kept()
    {
        var token = UniqueWord();
        var named = await api.CreateProductAsync(stock: 3, name: $"{token} Desk Lamp");
        await api.CreateProductAsync(stock: 3, name: $"{token} Floor Lamp");

        var answer = await AskWithModelAsync($"The {token} Desk Lamp is the better choice for reading.", $"which {token} for reading?");

        Assert.Equal($"The {token} Desk Lamp is the better choice for reading.", answer.Answer);
        Assert.Equal([named.Id], answer.Products.Select(p => p.Id));
    }

    [Fact]
    public async Task The_model_is_not_asked_when_nothing_was_retrieved()
    {
        var answer = await AskWithModelAsync("Our best bicycle is the Contoso Roadster.", $"do you sell {UniqueWord()}?");

        Assert.Equal(AssistantService.NoMatchAnswer, answer.Answer);
        Assert.Empty(answer.Products);
    }

    [Fact]
    public async Task Prices_written_by_the_model_are_replaced_by_the_catalog_price()
    {
        var token = UniqueWord();
        var product = await api.CreateProductAsync(stock: 3, price: 80m, name: $"{token} Lamp");

        var answer = await AskWithModelAsync($"The {token} Lamp [P:{product.Id}] costs only $1.", $"a {token} under $100");

        Assert.Equal($"The {token} Lamp costs only {PriceGuard.Replacement}.", answer.Answer);
        Assert.Equal(80m, Assert.Single(answer.Products).Price);
    }

    [Fact]
    public async Task A_follow_up_without_search_terms_answers_about_the_products_shown_before()
    {
        var token = UniqueWord();
        var cheap = await api.CreateProductAsync(stock: 2, price: 40m, name: $"{token} Kettle Mini");
        var expensive = await api.CreateProductAsync(stock: 2, price: 90m, name: $"{token} Kettle Max");
        var first = await AskAsync(api.CreateClient(), $"show me {token}");

        var followUp = await AskAsync(api.CreateClient(), "which of them is under $60?",
            [new AssistantTurnDto($"show me {token}", first.Products.Select(p => p.Id).ToList())]);

        Assert.Equal([cheap.Id, expensive.Id], first.Products.Select(p => p.Id).Order());
        // The price filter from the follow-up still applies, in SQL, to the products shown before.
        Assert.Equal([cheap.Id], followUp.Products.Select(p => p.Id));
        Assert.Equal(40m, followUp.Products[0].Price);
    }

    [Fact]
    public async Task Product_ids_from_the_client_history_cannot_bring_back_archived_products()
    {
        var token = UniqueWord();
        var archived = await api.CreateProductAsync(stock: 5, name: $"{token} Archived Lamp");
        await api.QueryAsync(db => db.Products.Where(p => p.Id == archived.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsActive, false), TestContext.Current.CancellationToken));

        var answer = await AskAsync(api.CreateClient(), "tell me more about it", [new AssistantTurnDto("a lamp", [archived.Id])]);

        Assert.Equal(AssistantService.NoMatchAnswer, answer.Answer);
        Assert.Empty(answer.Products);
    }

    [Fact]
    public async Task The_model_receives_earlier_questions_but_never_earlier_answer_text()
    {
        var token = UniqueWord();
        var product = await api.CreateProductAsync(stock: 3, name: $"{token} Speaker");
        var model = new RecordingChatModel($"The {token} Speaker [P:{product.Id}] is the better one.");
        await using var factory = api.Factory.WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services => services.AddSingleton<IChatModel>(model)));

        await AskAsync(factory.CreateClient(), "which of them is better?", [new AssistantTurnDto($"a {token} speaker", [product.Id])]);

        var request = Assert.Single(model.Requests);
        Assert.Equal([ChatRole.System, ChatRole.User], request.Messages.Select(m => m.Role));
        Assert.Contains($"- a {token} speaker", request.Messages[1].Content);
        Assert.Equal([product.Id], request.Sources.Select(s => s.Id));
    }

    [Fact]
    public async Task Too_long_histories_are_rejected_with_a_validation_problem()
    {
        var history = Enumerable.Range(0, AssistantLimits.MaxHistoryTurns + 1).Select(i => new AssistantTurnDto($"question {i}")).ToList();

        var response = await api.CreateClient().PostAsJsonAsync(
            "/api/assistant/ask", new AskAssistantRequest("lamps please", history), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("validation_failed", await response.ReadProblemCodeAsync());
    }

    private async Task<AssistantAnswerDto> AskWithModelAsync(string modelOutput, string question)
    {
        await using var factory = api.Factory.WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services => services.AddSingleton<IChatModel>(new FixedChatModel(modelOutput))));
        return await AskAsync(factory.CreateClient(), question);
    }

    [Fact]
    public async Task Too_short_questions_are_rejected_with_a_validation_problem()
    {
        var response = await api.CreateClient().PostAsJsonAsync("/api/assistant/ask", new AskAssistantRequest("hi"), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("validation_failed", await response.ReadProblemCodeAsync());
    }

    private static async Task<AssistantAnswerDto> AskAsync(HttpClient client, string question, IReadOnlyList<AssistantTurnDto>? history = null)
    {
        var response = await client.PostAsJsonAsync("/api/assistant/ask", new AskAssistantRequest(question, history), TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.ReadAsync<AssistantAnswerDto>();
    }

    /// <summary>
    /// Letters only, so the question parser keeps it as one search term. Questions use only this word: common words
    /// like "speaker" would also match seeded products and make exact assertions meaningless.
    /// </summary>
    private static string UniqueWord() => "zq" + string.Concat(Guid.NewGuid().ToString("N").Select(c => (char)('a' + c % 26)));

    private sealed class FailingChatModel : IChatModel
    {
        public string Name => "Failing";

        public Task<string> CompleteAsync(ChatRequest request, CancellationToken cancellationToken) =>
            throw new HttpRequestException("provider down");
    }

    private sealed class FixedChatModel(string output) : IChatModel
    {
        public string Name => "Fixed";

        public Task<string> CompleteAsync(ChatRequest request, CancellationToken cancellationToken) => Task.FromResult(output);
    }

    private sealed class RecordingChatModel(string output) : IChatModel
    {
        public List<ChatRequest> Requests { get; } = [];

        public string Name => "Recording";

        public Task<string> CompleteAsync(ChatRequest request, CancellationToken cancellationToken)
        {
            Requests.Add(request);
            return Task.FromResult(output);
        }
    }
}
