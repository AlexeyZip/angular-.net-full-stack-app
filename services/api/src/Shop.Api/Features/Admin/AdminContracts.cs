using System.ComponentModel.DataAnnotations;
using Shop.Api.Domain;

namespace Shop.Api.Features.Admin;

public sealed record AdminProductDto(
    int Id,
    string Name,
    string Slug,
    string Description,
    string Brand,
    decimal Price,
    int StockQuantity,
    string? ImageUrl,
    bool IsActive,
    int CategoryId,
    string CategoryName,
    int Version,
    DateTimeOffset UpdatedAt);

/// <summary>
/// Explicit input model: only these fields can be set by the client (no mass assignment of Id,
/// rating, timestamps or stock - stock changes go through audited adjustments).
/// </summary>
public sealed record SaveProductRequest(
    [Required, MinLength(2), MaxLength(200)] string Name,
    [MaxLength(220)] string? Slug,
    [MaxLength(4000)] string Description,
    [Required, MinLength(1), MaxLength(100)] string Brand,
    [Range(0.01, 1_000_000)] decimal Price,
    [Range(1, int.MaxValue)] int CategoryId,
    [MaxLength(500)] string? ImageUrl,
    bool IsActive);

public sealed record CreateProductRequest(
    [Required] SaveProductRequest Product,
    [Range(0, 100_000)] int InitialStock);

/// <summary>The client echoes back the Version it loaded; a stale version yields 409.</summary>
public sealed record UpdateProductRequest(
    [Required] SaveProductRequest Product,
    int Version);

public sealed record StockAdjustmentRequest(
    [Range(-100_000, 100_000)] int Delta,
    [Required, MinLength(3), MaxLength(200)] string Reason);

public sealed record StockAdjustmentResult(int ProductId, int StockQuantity);

public sealed record SaveCategoryRequest(
    [Required, MinLength(2), MaxLength(100)] string Name,
    [MaxLength(120)] string? Slug,
    [MaxLength(1000)] string Description);

public sealed record ChangeOrderStatusRequest([Required] OrderStatus Status);

public sealed record AdminOrderSummaryDto(
    Guid Id,
    string OrderNumber,
    OrderStatus Status,
    string CustomerEmail,
    decimal Total,
    int ItemCount,
    DateTimeOffset CreatedAt);

public sealed record LowStockProductDto(int Id, string Name, int StockQuantity);

public sealed record DashboardDto(
    decimal Revenue,
    decimal RevenueLast30Days,
    int OrderCount,
    int CustomerCount,
    int ActiveProductCount,
    IReadOnlyDictionary<string, int> OrdersByStatus,
    IReadOnlyList<LowStockProductDto> LowStockProducts,
    IReadOnlyList<AdminOrderSummaryDto> RecentOrders);

public sealed record AuditLogEntryDto(
    Guid Id,
    string ActorEmail,
    string Action,
    string EntityType,
    string EntityId,
    string Details,
    DateTimeOffset CreatedAt);

public sealed class AdminOrderQuery
{
    public OrderStatus? Status { get; init; }

    [MaxLength(100)]
    public string? Search { get; init; }

    [Range(1, 10_000)]
    public int Page { get; init; } = 1;

    [Range(1, 100)]
    public int PageSize { get; init; } = 20;
}

public sealed class AdminProductQuery
{
    [MaxLength(100)]
    public string? Search { get; init; }

    public bool? LowStockOnly { get; init; }

    [Range(1, 10_000)]
    public int Page { get; init; } = 1;

    [Range(1, 100)]
    public int PageSize { get; init; } = 20;
}

public static class AdminDefaults
{
    public const int LowStockThreshold = 5;
}
