using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Shop.Api.Domain;
using Shop.Api.Infrastructure.Messaging;
using Shop.Api.Infrastructure.Persistence;

namespace Shop.Api.Features.Orders;

public sealed record CheckoutResult(OrderDetailDto Order, bool Replayed);

/// <summary>
/// Creates orders. The guarantees, and the mechanism providing each one:
/// <list type="bullet">
/// <item>No overselling: per-product conditional UPDATE "stock = stock - n WHERE stock >= n" (row lock + re-check).</item>
/// <item>All-or-nothing: stock changes, payment outcome and the order insert share one transaction.</item>
/// <item>Retry safety: unique (user_id, idempotency_key) index; replays return the original order.</item>
/// <item>Authoritative money: prices are read from the database and totals come from <see cref="Pricing"/>.</item>
/// <item>Reliable notification: the OrderPlaced event is written to the outbox by the same commit as the order.</item>
/// </list>
/// See docs/engineering-decisions/08-database-transactions-and-concurrency.md.
/// </summary>
public sealed class CheckoutService(
    ShopDbContext db,
    PaymentSimulator payments,
    OrderQueries queries,
    Outbox outbox,
    TimeProvider clock,
    ILogger<CheckoutService> logger)
{
    public async Task<CheckoutResult> PlaceOrderAsync(
        Guid userId, string idempotencyKey, CheckoutRequest request, CancellationToken cancellationToken)
    {
        var lines = CartLines.Merge(request.Items);
        var fingerprint = Fingerprint(lines, request);

        var replay = await TryReplayAsync(userId, idempotencyKey, fingerprint, cancellationToken);
        if (replay is not null)
        {
            return replay;
        }

        var productIds = lines.Select(l => l.ProductId).ToArray();
        var order = await CreateOrderInTransactionAsync(userId, idempotencyKey, fingerprint, request, lines, productIds, cancellationToken);
        if (order is null)
        {
            // Lost a race against a concurrent request with the same idempotency key.
            return await TryReplayAsync(userId, idempotencyKey, fingerprint, cancellationToken)
                ?? throw new InvalidOperationException("Idempotency conflict without an existing order.");
        }

        logger.LogInformation("Order {OrderNumber} placed by {UserId}, total {Total}", order.OrderNumber, userId, order.Total);
        return new CheckoutResult(await queries.GetDetailAsync(order.Id, userId, cancellationToken), Replayed: false);
    }

    private async Task<Order?> CreateOrderInTransactionAsync(
        Guid userId,
        string idempotencyKey,
        string fingerprint,
        CheckoutRequest request,
        IReadOnlyList<CartLineRequest> lines,
        int[] productIds,
        CancellationToken cancellationToken)
    {
        // Any exception before CommitAsync disposes the transaction, which rolls back every stock change.
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        var products = await db.Products
            .AsNoTracking()
            .Where(p => productIds.Contains(p.Id) && p.IsActive)
            .Select(p => new { p.Id, p.Name, p.Price })
            .ToDictionaryAsync(p => p.Id, cancellationToken);

        var missing = productIds.Where(id => !products.ContainsKey(id)).ToArray();
        if (missing.Length > 0)
        {
            throw AppException.BusinessRule(
                "product_unavailable",
                "Some products are no longer available.",
                new Dictionary<string, object?> { ["productIds"] = missing });
        }

        var now = clock.GetUtcNow();
        var shortages = new List<int>();

        // Lines are sorted by product id, so concurrent checkouts lock rows in the same order (no deadlocks).
        foreach (var line in lines)
        {
            var updated = await db.Products
                .Where(p => p.Id == line.ProductId && p.IsActive && p.StockQuantity >= line.Quantity)
                .ExecuteUpdateAsync(
                    s => s.SetProperty(p => p.StockQuantity, p => p.StockQuantity - line.Quantity).SetProperty(p => p.UpdatedAt, now),
                    cancellationToken);

            if (updated == 0)
            {
                shortages.Add(line.ProductId);
            }
        }

        if (shortages.Count > 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            var available = await db.Products
                .AsNoTracking()
                .Where(p => shortages.Contains(p.Id))
                .Select(p => new { productId = p.Id, available = p.StockQuantity })
                .ToListAsync(cancellationToken);

            throw AppException.Conflict(
                "insufficient_stock",
                "Not enough stock for some items in your cart.",
                new Dictionary<string, object?> { ["items"] = available });
        }

        var items = lines
            .Select(l => new OrderItem(l.ProductId, products[l.ProductId].Name, products[l.ProductId].Price, l.Quantity))
            .ToList();
        var price = Pricing.Calculate(items.Select(i => (i.UnitPrice, i.Quantity)));

        // Simulated synchronous capture. A declined payment throws and rolls the reservation back.
        var paymentReference = payments.Charge(price.Total, request.PaymentToken, idempotencyKey);

        var address = request.ShippingAddress;
        var order = new Order(
            userId,
            idempotencyKey,
            fingerprint,
            new ShippingAddress(address.Recipient.Trim(), address.Line1.Trim(), address.City.Trim(), address.PostalCode.Trim(), address.Country),
            items,
            price,
            paymentReference,
            now);

        db.Orders.Add(order);
        var customer = await db.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.Email, u.FullName })
            .SingleAsync(cancellationToken);
        outbox.Enqueue(IntegrationEventTypes.OrderPlaced, new OrderPlacedV1(
            order.Id, order.OrderNumber, customer.Email, customer.FullName, order.Total, "USD", items.Sum(i => i.Quantity), now));
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.IsUniqueViolation("ix_orders_user_id_idempotency_key"))
        {
            await transaction.RollbackAsync(cancellationToken);
            db.ChangeTracker.Clear();
            return null;
        }

        await transaction.CommitAsync(cancellationToken);
        return order;
    }

    private async Task<CheckoutResult?> TryReplayAsync(
        Guid userId, string idempotencyKey, string fingerprint, CancellationToken cancellationToken)
    {
        var existing = await db.Orders
            .AsNoTracking()
            .Where(o => o.UserId == userId && o.IdempotencyKey == idempotencyKey)
            .Select(o => new { o.Id, o.RequestFingerprint })
            .SingleOrDefaultAsync(cancellationToken);

        if (existing is null)
        {
            return null;
        }

        if (existing.RequestFingerprint != fingerprint)
        {
            throw AppException.BusinessRule(
                "idempotency_key_reused", "This idempotency key was already used for a different checkout request.");
        }

        return new CheckoutResult(await queries.GetDetailAsync(existing.Id, userId, cancellationToken), Replayed: true);
    }

    internal static string Fingerprint(IReadOnlyList<CartLineRequest> lines, CheckoutRequest request)
    {
        var canonical = JsonSerializer.Serialize(new { lines, request.ShippingAddress, request.PaymentToken });
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(canonical)));
    }
}
