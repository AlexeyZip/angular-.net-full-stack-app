using Microsoft.EntityFrameworkCore;
using Shop.Api.Domain;
using Shop.Api.Features.Shared;
using Shop.Api.Infrastructure.Persistence;

namespace Shop.Api.Features.Orders;

public sealed class OrderQueries(ShopDbContext db)
{
    public Task<PagedResult<OrderSummaryDto>> GetForUserAsync(Guid userId, int page, int pageSize, CancellationToken cancellationToken) =>
        db.Orders
            .AsNoTracking()
            .Where(o => o.UserId == userId)
            .OrderByDescending(o => o.CreatedAt)
            .ThenByDescending(o => o.Id)
            .Select(o => new OrderSummaryDto(o.Id, o.OrderNumber, o.Status, o.Total, o.Items.Sum(i => i.Quantity), o.CreatedAt))
            .ToPagedResultAsync(page, pageSize, cancellationToken);

    /// <param name="orderId">Order to load.</param>
    /// <param name="userId">When set, the order must belong to this user (404 otherwise, so ids cannot be probed).</param>
    /// <param name="cancellationToken">Request cancellation.</param>
    public async Task<OrderDetailDto> GetDetailAsync(Guid orderId, Guid? userId, CancellationToken cancellationToken)
    {
        var order = await db.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .Include(o => o.User)
            .Where(o => o.Id == orderId && (userId == null || o.UserId == userId))
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw AppException.NotFound("Order", orderId);

        return ToDetail(order, includeCustomer: userId is null);
    }

    public static OrderDetailDto ToDetail(Order order, bool includeCustomer)
    {
        var address = order.ShippingAddress;
        return new OrderDetailDto(
            order.Id,
            order.OrderNumber,
            order.Status,
            order.Subtotal,
            order.ShippingCost,
            order.Total,
            new ShippingAddressDto(address.Recipient, address.Line1, address.City, address.PostalCode, address.Country),
            order.PaymentReference,
            order.CreatedAt,
            order.UpdatedAt,
            order.Items.OrderBy(i => i.Id).Select(i => new OrderItemDto(i.ProductId, i.ProductName, i.UnitPrice, i.Quantity, i.LineTotal)).ToList(),
            Order.NextStatuses(order.Status),
            includeCustomer ? order.User.Email : null);
    }
}
