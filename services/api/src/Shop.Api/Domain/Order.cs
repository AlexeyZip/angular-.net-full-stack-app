namespace Shop.Api.Domain;

public enum OrderStatus
{
    /// <summary>Payment captured by the payment simulator; stock already reserved (decremented).</summary>
    Paid,
    Shipped,
    Delivered,

    /// <summary>Terminal. Cancelling returns the reserved stock to inventory.</summary>
    Cancelled,
}

/// <summary>Value object stored as columns of the orders table (EF Core complex type).</summary>
public sealed record ShippingAddress(string Recipient, string Line1, string City, string PostalCode, string Country);

public sealed class Order
{
    private static readonly IReadOnlyDictionary<OrderStatus, OrderStatus[]> AllowedTransitions =
        new Dictionary<OrderStatus, OrderStatus[]>
        {
            [OrderStatus.Paid] = [OrderStatus.Shipped, OrderStatus.Cancelled],
            [OrderStatus.Shipped] = [OrderStatus.Delivered],
            [OrderStatus.Delivered] = [],
            [OrderStatus.Cancelled] = [],
        };

    private Order()
    {
    }

    public Order(
        Guid userId,
        string idempotencyKey,
        string requestFingerprint,
        ShippingAddress shippingAddress,
        IReadOnlyList<OrderItem> items,
        PriceBreakdown price,
        string paymentReference,
        DateTimeOffset now)
    {
        if (items.Count == 0)
        {
            throw AppException.BusinessRule("empty_order", "An order must contain at least one item.");
        }

        Id = Guid.CreateVersion7(now);
        OrderNumber = $"SO-{now:yyyyMMdd}-{Id.ToString("N")[^8..].ToUpperInvariant()}";
        UserId = userId;
        IdempotencyKey = idempotencyKey;
        RequestFingerprint = requestFingerprint;
        ShippingAddress = shippingAddress;
        Items = [.. items];
        Subtotal = price.Subtotal;
        ShippingCost = price.Shipping;
        Total = price.Total;
        PaymentReference = paymentReference;
        Status = OrderStatus.Paid;
        CreatedAt = now;
        UpdatedAt = now;
    }

    public Guid Id { get; private set; }
    public string OrderNumber { get; private set; } = string.Empty;
    public Guid UserId { get; private set; }
    public User User { get; private set; } = null!;
    public OrderStatus Status { get; private set; }
    public decimal Subtotal { get; private set; }
    public decimal ShippingCost { get; private set; }
    public decimal Total { get; private set; }
    public ShippingAddress ShippingAddress { get; private set; } = null!;
    public string PaymentReference { get; private set; } = string.Empty;

    /// <summary>Client-generated key; unique per user. Makes checkout safe to retry.</summary>
    public string IdempotencyKey { get; private set; } = string.Empty;

    /// <summary>Hash of the checkout request, used to reject a reused key with a different payload.</summary>
    public string RequestFingerprint { get; private set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    /// <summary>xmin concurrency token: two admins changing the status at once cannot both win.</summary>
    public uint Version { get; private set; }

    public List<OrderItem> Items { get; private set; } = [];

    public static IReadOnlyList<OrderStatus> NextStatuses(OrderStatus from) => AllowedTransitions[from];

    public bool CanTransitionTo(OrderStatus next) => AllowedTransitions[Status].Contains(next);

    public void TransitionTo(OrderStatus next, DateTimeOffset now)
    {
        if (!CanTransitionTo(next))
        {
            throw AppException.BusinessRule(
                "invalid_status_transition",
                $"Order cannot move from {Status} to {next}.",
                new Dictionary<string, object?> { ["from"] = Status.ToString(), ["to"] = next.ToString() });
        }

        Status = next;
        UpdatedAt = now;
    }
}

public sealed class OrderItem
{
    private OrderItem()
    {
    }

    public OrderItem(int productId, string productName, decimal unitPrice, int quantity)
    {
        if (quantity <= 0)
        {
            throw AppException.BusinessRule("invalid_quantity", "Quantity must be positive.");
        }

        ProductId = productId;
        ProductName = productName;
        UnitPrice = unitPrice;
        Quantity = quantity;
        LineTotal = unitPrice * quantity;
    }

    public int Id { get; private set; }
    public Guid OrderId { get; private set; }
    public int ProductId { get; private set; }

    /// <summary>Snapshot: later product renames or price changes must not rewrite history.</summary>
    public string ProductName { get; private set; } = string.Empty;

    public decimal UnitPrice { get; private set; }
    public int Quantity { get; private set; }
    public decimal LineTotal { get; private set; }
}
