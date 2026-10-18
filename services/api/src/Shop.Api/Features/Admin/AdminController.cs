using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shop.Api.Features.Catalog;
using Shop.Api.Features.Orders;
using Shop.Api.Features.Shared;
using Shop.Api.Infrastructure.Auth;

namespace Shop.Api.Features.Admin;

/// <summary>
/// Every action requires the AdminOnly policy. Hiding admin links in Angular is a UX nicety;
/// this attribute is the actual security boundary.
/// </summary>
[ApiController]
[Authorize(Policy = ShopClaims.AdminPolicy)]
[Route("api/admin")]
public sealed class AdminController(
    AdminCatalogService catalog,
    AdminOrdersService orders,
    OrderQueries orderQueries,
    OrderStatusService orderStatuses) : ControllerBase
{
    [HttpGet("dashboard")]
    public Task<DashboardDto> Dashboard(CancellationToken cancellationToken) => orders.GetDashboardAsync(cancellationToken);

    [HttpGet("products")]
    public Task<PagedResult<AdminProductDto>> GetProducts([FromQuery] AdminProductQuery query, CancellationToken cancellationToken) =>
        catalog.GetProductsAsync(query, cancellationToken);

    [HttpGet("products/{id:int}")]
    public Task<AdminProductDto> GetProduct(int id, CancellationToken cancellationToken) => catalog.GetProductAsync(id, cancellationToken);

    [HttpPost("products")]
    [ProducesResponseType<AdminProductDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<AdminProductDto>> CreateProduct(CreateProductRequest request, CancellationToken cancellationToken)
    {
        var product = await catalog.CreateProductAsync(User.GetRequiredUserId(), request, cancellationToken);
        return CreatedAtAction(nameof(GetProduct), new { id = product.Id }, product);
    }

    [HttpPut("products/{id:int}")]
    public Task<AdminProductDto> UpdateProduct(int id, UpdateProductRequest request, CancellationToken cancellationToken) =>
        catalog.UpdateProductAsync(User.GetRequiredUserId(), id, request, cancellationToken);

    [HttpPost("products/{id:int}/stock-adjustments")]
    public Task<StockAdjustmentResult> AdjustStock(int id, StockAdjustmentRequest request, CancellationToken cancellationToken) =>
        catalog.AdjustStockAsync(User.GetRequiredUserId(), id, request, cancellationToken);

    [HttpGet("categories")]
    public Task<IReadOnlyList<CategoryDto>> GetCategories(CancellationToken cancellationToken) => catalog.GetCategoriesAsync(cancellationToken);

    [HttpPost("categories")]
    [ProducesResponseType<CategoryDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<CategoryDto>> CreateCategory(SaveCategoryRequest request, CancellationToken cancellationToken)
    {
        var category = await catalog.CreateCategoryAsync(User.GetRequiredUserId(), request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, category);
    }

    [HttpPut("categories/{id:int}")]
    public Task<CategoryDto> UpdateCategory(int id, SaveCategoryRequest request, CancellationToken cancellationToken) =>
        catalog.UpdateCategoryAsync(User.GetRequiredUserId(), id, request, cancellationToken);

    [HttpDelete("categories/{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteCategory(int id, CancellationToken cancellationToken)
    {
        await catalog.DeleteCategoryAsync(User.GetRequiredUserId(), id, cancellationToken);
        return NoContent();
    }

    [HttpGet("orders")]
    public Task<PagedResult<AdminOrderSummaryDto>> GetOrders([FromQuery] AdminOrderQuery query, CancellationToken cancellationToken) =>
        orders.GetOrdersAsync(query, cancellationToken);

    [HttpGet("orders/{id:guid}")]
    public Task<OrderDetailDto> GetOrder(Guid id, CancellationToken cancellationToken) =>
        orderQueries.GetDetailAsync(id, userId: null, cancellationToken);

    [HttpPost("orders/{id:guid}/status")]
    public Task<OrderDetailDto> ChangeOrderStatus(Guid id, ChangeOrderStatusRequest request, CancellationToken cancellationToken) =>
        orderStatuses.ChangeByAdminAsync(User.GetRequiredUserId(), id, request.Status, cancellationToken);

    [HttpGet("audit-log")]
    public Task<PagedResult<AuditLogEntryDto>> GetAuditLog(
        [FromQuery, Range(1, 10_000)] int page = 1,
        [FromQuery, Range(1, 100)] int pageSize = 20,
        CancellationToken cancellationToken = default) =>
        orders.GetAuditLogAsync(page, pageSize, cancellationToken);
}
