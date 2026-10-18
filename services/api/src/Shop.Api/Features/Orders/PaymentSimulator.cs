using Shop.Api.Domain;

namespace Shop.Api.Features.Orders;

/// <summary>
/// Local stand-in for a payment provider. Deterministic by token so tests and demos can exercise
/// every branch. No real card data is ever accepted or stored.
/// A real provider would sit behind an interface with an HTTP client, timeouts and idempotency keys;
/// that abstraction is deliberately not introduced until a second implementation exists.
/// </summary>
public sealed class PaymentSimulator
{
    public const string ApprovedToken = "tok_visa";
    public const string DeclinedToken = "tok_declined";
    public const string UnavailableToken = "tok_unavailable";

    public string Charge(decimal amount, string paymentToken, string idempotencyKey)
    {
        return paymentToken switch
        {
            ApprovedToken => $"sim_{Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(
                System.Text.Encoding.UTF8.GetBytes($"{idempotencyKey}:{amount}")))[..24]}",
            DeclinedToken => throw new AppException(
                StatusCodes.Status402PaymentRequired, "payment_declined", "The payment was declined. Use a different payment method."),
            UnavailableToken => throw new AppException(
                StatusCodes.Status503ServiceUnavailable, "payment_unavailable", "The payment provider is unavailable. Please retry."),
            _ => throw AppException.BusinessRule("invalid_payment_token", "Unknown payment token."),
        };
    }
}
