using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Shop.Api.Domain;
using Shop.Api.Features.Shared;
using Shop.Api.Infrastructure.Auth;

namespace Shop.Api.Features.Orders;

[ApiController]
[Route("api")]
public sealed class OrdersController(
    CartQuoteService quotes,
    CheckoutService checkout,
    OrderQueries queries,
    OrderStatusService statuses) : ControllerBase
{
    public const string IdempotencyHeader = "Idempotency-Key";

    /// <summary>Server-side pricing of a client-held cart. Anonymous: guests can see totals too.</summary>
    [HttpPost("cart/quote")]
    public Task<CartQuoteDto> Quote(CartQuoteRequest request, CancellationToken cancellationToken) =>
        quotes.QuoteAsync(request.Items, cancellationToken);

    /// <summary>
    /// Places an order. Requires an Idempotency-Key header (8-64 chars, letters, digits, '-' or '_').
    /// Returns 201 for a new order and 200 with "Idempotent-Replayed: true" for a retried request.
    /// </summary>
    [Authorize]
    [HttpPost("orders")]
    [EnableRateLimiting(RateLimitPolicies.Checkout)]
    [ProducesResponseType<OrderDetailDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<OrderDetailDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<OrderDetailDto>> Checkout(
        [FromHeader(Name = IdempotencyHeader), Required, RegularExpression("^[A-Za-z0-9_-]{8,64}$")] string idempotencyKey,
        CheckoutRequest request,
        CancellationToken cancellationToken)
    {
        var result = await checkout.PlaceOrderAsync(User.GetRequiredUserId(), idempotencyKey, request, cancellationToken);
        if (result.Replayed)
        {
            Response.Headers["Idempotent-Replayed"] = "true";
            return Ok(result.Order);
        }

        return CreatedAtAction(nameof(GetOrder), new { id = result.Order.Id }, result.Order);
    }

    [Authorize]
    [HttpGet("orders")]
    public Task<PagedResult<OrderSummaryDto>> GetOrders(
        [FromQuery, Range(1, 10_000)] int page = 1,
        [FromQuery, Range(1, 50)] int pageSize = 10,
        CancellationToken cancellationToken = default) =>
        queries.GetForUserAsync(User.GetRequiredUserId(), page, pageSize, cancellationToken);

    [Authorize]
    [HttpGet("orders/{id:guid}")]
    public Task<OrderDetailDto> GetOrder(Guid id, CancellationToken cancellationToken) =>
        queries.GetDetailAsync(id, User.GetRequiredUserId(), cancellationToken);

    [Authorize]
    [HttpPost("orders/{id:guid}/cancel")]
    public Task<OrderDetailDto> Cancel(Guid id, CancellationToken cancellationToken) =>
        statuses.CancelByCustomerAsync(User.GetRequiredUserId(), id, cancellationToken);
}
