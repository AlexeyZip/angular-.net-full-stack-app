using Microsoft.EntityFrameworkCore;
using Shop.Api.Domain;
using Shop.Api.Infrastructure.Audit;
using Shop.Api.Infrastructure.Messaging;
using Shop.Api.Infrastructure.Persistence;

namespace Shop.Api.Features.Orders;

/// <summary>Status changes for customers (cancel) and administrators (any valid transition).</summary>
public sealed class OrderStatusService(ShopDbContext db, AuditLogger audit, Outbox outbox, OrderQueries queries, TimeProvider clock)
{
    public async Task<OrderDetailDto> CancelByCustomerAsync(Guid userId, Guid orderId, CancellationToken cancellationToken)
    {
        await ChangeStatusAsync(orderId, OrderStatus.Cancelled, ownerId: userId, adminId: null, cancellationToken);
        return await queries.GetDetailAsync(orderId, userId, cancellationToken);
    }

    public async Task<OrderDetailDto> ChangeByAdminAsync(Guid adminId, Guid orderId, OrderStatus next, CancellationToken cancellationToken)
    {
        await ChangeStatusAsync(orderId, next, ownerId: null, adminId, cancellationToken);
        return await queries.GetDetailAsync(orderId, userId: null, cancellationToken);
    }

    private async Task ChangeStatusAsync(Guid orderId, OrderStatus next, Guid? ownerId, Guid? adminId, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        var order = await db.Orders
            .Include(o => o.Items)
            .SingleOrDefaultAsync(o => o.Id == orderId && (ownerId == null || o.UserId == ownerId), cancellationToken)
            ?? throw AppException.NotFound("Order", orderId);

        var previous = order.Status;
        order.TransitionTo(next, clock.GetUtcNow()); // throws 422 for transitions the state machine forbids

        if (next == OrderStatus.Cancelled)
        {
            foreach (var item in order.Items)
            {
                await db.Products
                    .Where(p => p.Id == item.ProductId)
                    .ExecuteUpdateAsync(s => s.SetProperty(p => p.StockQuantity, p => p.StockQuantity + item.Quantity), cancellationToken);
            }
        }

        if (adminId is { } actor)
        {
            audit.Record(actor, "order.status_changed", "Order", order.Id, new { order.OrderNumber, from = previous, to = next });
        }

        var customer = await db.Users.AsNoTracking()
            .Where(u => u.Id == order.UserId)
            .Select(u => new { u.Email, u.FullName })
            .SingleAsync(cancellationToken);
        outbox.Enqueue(IntegrationEventTypes.OrderStatusChanged, new OrderStatusChangedV1(
            order.Id, order.OrderNumber, customer.Email, customer.FullName, previous.ToString(), next.ToString(), clock.GetUtcNow()));

        // Order.Version (xmin) makes a concurrent second cancellation fail instead of restocking twice.
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }
}
