using Microsoft.EntityFrameworkCore;
using Shop.Api.Domain;
using Shop.Api.Features.Catalog;
using Shop.Api.Features.Shared;
using Shop.Api.Infrastructure.Persistence;

namespace Shop.Api.Features.Admin;

public sealed class AdminOrdersService(ShopDbContext db, TimeProvider clock)
{
    public Task<PagedResult<AdminOrderSummaryDto>> GetOrdersAsync(AdminOrderQuery query, CancellationToken cancellationToken)
    {
        var orders = db.Orders.AsNoTracking();
        if (query.Status is { } status)
        {
            orders = orders.Where(o => o.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = $"%{CatalogService.EscapeLikePattern(query.Search.Trim())}%";
            orders = orders.Where(o => EF.Functions.ILike(o.OrderNumber, pattern, @"\") || EF.Functions.ILike(o.User.Email, pattern, @"\"));
        }

        return orders
            .OrderByDescending(o => o.CreatedAt)
            .ThenByDescending(o => o.Id)
            .Select(o => new AdminOrderSummaryDto(o.Id, o.OrderNumber, o.Status, o.User.Email, o.Total, o.Items.Sum(i => i.Quantity), o.CreatedAt))
            .ToPagedResultAsync(query.Page, query.PageSize, cancellationToken);
    }

    public async Task<DashboardDto> GetDashboardAsync(CancellationToken cancellationToken)
    {
        var since = clock.GetUtcNow().AddDays(-30);
        var billable = db.Orders.AsNoTracking().Where(o => o.Status != OrderStatus.Cancelled);

        // Several small aggregate queries are easier to read and index than one giant one.
        // DbContext is not thread-safe, so they run sequentially rather than with Task.WhenAll.
        var revenue = await billable.SumAsync(o => o.Total, cancellationToken);
        var revenue30 = await billable.Where(o => o.CreatedAt >= since).SumAsync(o => o.Total, cancellationToken);
        var orderCount = await db.Orders.CountAsync(cancellationToken);
        var customerCount = await db.Users.CountAsync(u => u.Role == UserRole.Customer, cancellationToken);
        var activeProducts = await db.Products.CountAsync(p => p.IsActive, cancellationToken);

        var byStatus = await db.Orders
            .GroupBy(o => o.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var lowStock = await db.Products
            .AsNoTracking()
            .Where(p => p.IsActive && p.StockQuantity <= AdminDefaults.LowStockThreshold)
            .OrderBy(p => p.StockQuantity)
            .ThenBy(p => p.Name)
            .Take(8)
            .Select(p => new LowStockProductDto(p.Id, p.Name, p.StockQuantity))
            .ToListAsync(cancellationToken);

        var recent = await GetOrdersAsync(new AdminOrderQuery { PageSize = 5 }, cancellationToken);

        return new DashboardDto(
            revenue,
            revenue30,
            orderCount,
            customerCount,
            activeProducts,
            Enum.GetValues<OrderStatus>().ToDictionary(s => s.ToString(), s => byStatus.FirstOrDefault(b => b.Status == s)?.Count ?? 0),
            lowStock,
            recent.Items);
    }

    public Task<PagedResult<AuditLogEntryDto>> GetAuditLogAsync(int page, int pageSize, CancellationToken cancellationToken) =>
        db.AuditLog
            .AsNoTracking()
            .OrderByDescending(a => a.CreatedAt)
            .Join(db.Users, a => a.ActorUserId, u => u.Id, (a, u) => new AuditLogEntryDto(
                a.Id, u.Email, a.Action, a.EntityType, a.EntityId, a.Details, a.CreatedAt))
            .ToPagedResultAsync(page, pageSize, cancellationToken);
}
