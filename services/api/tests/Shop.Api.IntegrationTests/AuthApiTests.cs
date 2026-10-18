using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Shop.Api.Features.Auth;
using Shop.Api.Infrastructure.Persistence;

namespace Shop.Api.IntegrationTests;

public sealed class AuthApiTests(ApiFixture api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Register_returns_access_token_and_sets_http_only_refresh_cookie()
    {
        var client = api.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/register",
            new RegisterRequest($"new-{Guid.NewGuid():N}@test.local", "Password-123", "New Customer"), Ct);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var auth = await response.ReadAsync<AuthResponse>();
        Assert.Equal("Customer", auth.User.Role);
        Assert.False(string.IsNullOrEmpty(auth.AccessToken));

        var cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"));
        Assert.Contains("shop_refresh=", cookie);
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=strict", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("refresh", await response.Content.ReadAsStringAsync(Ct), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Duplicate_email_is_rejected_case_insensitively()
    {
        var email = $"dup-{Guid.NewGuid():N}@test.local";
        var client = api.CreateClient();
        await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "Password-123", "First"), Ct);

        var response = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email.ToUpperInvariant(), "Password-123", "Second"), Ct);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("email_taken", await response.ReadProblemCodeAsync());
    }

    [Fact]
    public async Task Wrong_password_and_unknown_email_get_the_same_error()
    {
        var client = api.CreateClient();

        var wrongPassword = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(DevelopmentSeeder.AdminEmail, "nope-12345"), Ct);
        var unknownEmail = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("nobody@test.local", "nope-12345"), Ct);

        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknownEmail.StatusCode);
        Assert.Equal("invalid_credentials", await wrongPassword.ReadProblemCodeAsync());
        Assert.Equal("invalid_credentials", await unknownEmail.ReadProblemCodeAsync());
    }

    [Fact]
    public async Task Weak_password_is_rejected()
    {
        var response = await api.CreateClient().PostAsJsonAsync("/api/auth/register",
            new RegisterRequest($"weak-{Guid.NewGuid():N}@test.local", "abcdefgh", "Weak"), Ct);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Equal("weak_password", await response.ReadProblemCodeAsync());
    }

    [Fact]
    public async Task Me_requires_a_valid_token()
    {
        var anonymous = await api.CreateClient().GetAsync("/api/auth/me", Ct);
        var (client, auth) = await api.RegisterCustomerAsync();
        var me = await (await client.GetAsync("/api/auth/me", Ct)).ReadAsync<UserDto>();

        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
        Assert.Equal(auth.User.Id, me.Id);
    }

    [Fact]
    public async Task Refresh_requires_the_csrf_header()
    {
        var (client, _) = await api.RegisterCustomerAsync();

        var response = await client.PostAsync("/api/auth/refresh", null, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("csrf_header_missing", await response.ReadProblemCodeAsync());
    }

    [Fact]
    public async Task Refresh_rotates_the_token_and_reuse_revokes_the_session()
    {
        // Cookies are handled manually here so the test can replay an old token like an attacker would.
        var client = api.Factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { HandleCookies = false });
        var register = await client.PostAsJsonAsync("/api/auth/register",
            new RegisterRequest($"rotate-{Guid.NewGuid():N}@test.local", "Password-123", "Rotating Customer"), Ct);
        var original = ExtractRefreshCookie(register);

        var refreshed = await RefreshWithCookieAsync(client, original);
        Assert.Equal(HttpStatusCode.OK, refreshed.StatusCode);
        var rotated = ExtractRefreshCookie(refreshed);
        Assert.NotEqual(original, rotated);

        var reuse = await RefreshWithCookieAsync(client, original);
        Assert.Equal(HttpStatusCode.Unauthorized, reuse.StatusCode);

        // Reuse detection revoked the legitimate client's newer token as well.
        var afterReuse = await RefreshWithCookieAsync(client, rotated);
        Assert.Equal(HttpStatusCode.Unauthorized, afterReuse.StatusCode);
    }

    [Fact]
    public async Task Logout_revokes_the_refresh_token_server_side()
    {
        var client = api.Factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { HandleCookies = false });
        var register = await client.PostAsJsonAsync("/api/auth/register",
            new RegisterRequest($"logout-{Guid.NewGuid():N}@test.local", "Password-123", "Leaving Customer"), Ct);
        var cookie = ExtractRefreshCookie(register);

        var logoutRequest = new HttpRequestMessage(HttpMethod.Post, "/api/auth/logout");
        logoutRequest.Headers.Add("Cookie", cookie);
        logoutRequest.Headers.Add(AuthController.CsrfHeaderName, "web");
        var logout = await client.SendAsync(logoutRequest, Ct);

        // Even if a copy of the cookie survived on the client, it is useless now.
        var refresh = await RefreshWithCookieAsync(client, cookie);

        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);
    }

    [Fact]
    public async Task Customers_cannot_call_admin_endpoints()
    {
        var (customer, _) = await api.RegisterCustomerAsync();
        var anonymous = api.CreateClient();

        Assert.Equal(HttpStatusCode.Forbidden, (await customer.GetAsync("/api/admin/dashboard", Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/admin/dashboard", Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer.PostAsJsonAsync("/api/admin/products/1/stock-adjustments",
            new { delta = 100, reason = "free stock" }, Ct)).StatusCode);
    }

    [Fact]
    public async Task Tampered_token_is_rejected()
    {
        var (client, auth) = await api.RegisterCustomerAsync();
        var parts = auth.AccessToken.Split('.');
        var tampered = $"{parts[0]}.{parts[1]}x.{parts[2]}";
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tampered);

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me", Ct)).StatusCode);
    }

    private static string ExtractRefreshCookie(HttpResponseMessage response)
    {
        var header = response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("shop_refresh=", StringComparison.Ordinal));
        return header.Split(';')[0];
    }

    private static Task<HttpResponseMessage> RefreshWithCookieAsync(HttpClient client, string cookie)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/refresh");
        request.Headers.Add("Cookie", cookie);
        request.Headers.Add(AuthController.CsrfHeaderName, "web");
        return client.SendAsync(request, Ct);
    }
}
