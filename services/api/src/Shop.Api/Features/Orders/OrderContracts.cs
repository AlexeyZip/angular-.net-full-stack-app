using System.ComponentModel.DataAnnotations;
using Shop.Api.Domain;

namespace Shop.Api.Features.Orders;

/// <summary>
/// A cart line as sent by the client. Note what is NOT here: price, name, totals or user id.
/// The server looks those up itself and never trusts client-supplied monetary values.
/// </summary>
public sealed record CartLineRequest(
    [Range(1, int.MaxValue)] int ProductId,
    [Range(1, Pricing.MaxQuantityPerLine)] int Quantity);

public sealed record CartQuoteRequest(
    [Required, MaxLength(Pricing.MaxLinesPerOrder)] IReadOnlyList<CartLineRequest> Items);

public enum CartLineIssue
{
    Unavailable,
    InsufficientStock,
}

public sealed record CartQuoteLineDto(
    int ProductId,
    string Name,
    string Slug,
    string? ImageUrl,
    decimal UnitPrice,
    int Quantity,
    decimal LineTotal,
    int AvailableQuantity,
    CartLineIssue? Issue);

public sealed record CartQuoteDto(
    IReadOnlyList<CartQuoteLineDto> Lines,
    decimal Subtotal,
    decimal Shipping,
    decimal Total,
    decimal FreeShippingThreshold,
    bool CanCheckout);

public sealed record ShippingAddressDto(
    [Required, MinLength(2), MaxLength(150)] string Recipient,
    [Required, MinLength(3), MaxLength(200)] string Line1,
    [Required, MinLength(2), MaxLength(100)] string City,
    [Required, MinLength(3), MaxLength(20)] string PostalCode,
    [Required, RegularExpression("^[A-Z]{2}$", ErrorMessage = "Country must be an ISO 3166-1 alpha-2 code.")] string Country);

public sealed record CheckoutRequest(
    [Required, MinLength(1), MaxLength(Pricing.MaxLinesPerOrder)] IReadOnlyList<CartLineRequest> Items,
    [Required] ShippingAddressDto ShippingAddress,
    // Simulator token: tok_visa (approved), tok_declined (declined), tok_unavailable (provider outage).
    [Required, MaxLength(40)] string PaymentToken);

public sealed record OrderItemDto(int ProductId, string ProductName, decimal UnitPrice, int Quantity, decimal LineTotal);

public sealed record OrderSummaryDto(Guid Id, string OrderNumber, OrderStatus Status, decimal Total, int ItemCount, DateTimeOffset CreatedAt);

public sealed record OrderDetailDto(
    Guid Id,
    string OrderNumber,
    OrderStatus Status,
    decimal Subtotal,
    decimal ShippingCost,
    decimal Total,
    ShippingAddressDto ShippingAddress,
    string PaymentReference,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    IReadOnlyList<OrderItemDto> Items,
    IReadOnlyList<OrderStatus> AllowedNextStatuses,
    string? CustomerEmail);
