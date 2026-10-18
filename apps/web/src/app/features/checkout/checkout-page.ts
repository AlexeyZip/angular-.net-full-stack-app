import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  ApiError,
  AuthSession,
  CheckoutRequest,
  createIdempotencyKey,
  OrdersApi,
  PaymentToken,
  toApiError,
} from '@shop/shared/data-access';
import { Button, EmptyState, FieldError, ToastService } from '@shop/shared/ui';
import { CartStore } from '@shop/state/contracts';
import { OrderSummaryPanel } from '../cart/order-summary-panel';

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'PL', name: 'Poland' },
] as const;

const PAYMENT_OPTIONS: readonly { token: PaymentToken; label: string; hint: string }[] = [
  { token: 'tok_visa', label: 'Test card – approved', hint: 'The simulator approves the payment.' },
  { token: 'tok_declined', label: 'Test card – declined', hint: 'The simulator declines the payment (HTTP 402).' },
  { token: 'tok_unavailable', label: 'Provider outage', hint: 'The simulator reports the provider as unavailable (HTTP 503).' },
];

@Component({
  selector: 'shop-checkout-page',
  imports: [ReactiveFormsModule, RouterLink, Button, EmptyState, FieldError, OrderSummaryPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Checkout</h1>
    @if (cart.isEmpty()) {
      <shop-empty-state title="Your cart is empty" message="Add products before checking out.">
        <a shopButton routerLink="/products">Browse the catalog</a>
      </shop-empty-state>
    } @else {
      <div class="layout">
        <form [formGroup]="form" (ngSubmit)="placeOrder()" novalidate aria-labelledby="shipping-heading">
          @if (error(); as error) {
            <div class="shop-alert" role="alert" data-testid="checkout-error">
              <strong>{{ errorTitle() }}</strong>
              <p>{{ error.message }}</p>
            </div>
          }

          <fieldset class="shop-card" formGroupName="address">
            <legend id="shipping-heading">Shipping address</legend>
            <div class="shop-field">
              <label for="recipient">Full name</label>
              <input id="recipient" class="shop-input" formControlName="recipient" autocomplete="name" aria-describedby="recipient-error" />
              <shop-field-error [control]="form.controls.address.controls.recipient" id="recipient-error" />
            </div>
            <div class="shop-field">
              <label for="line1">Address</label>
              <input id="line1" class="shop-input" formControlName="line1" autocomplete="address-line1" aria-describedby="line1-error" />
              <shop-field-error [control]="form.controls.address.controls.line1" id="line1-error" />
            </div>
            <div class="row">
              <div class="shop-field">
                <label for="city">City</label>
                <input id="city" class="shop-input" formControlName="city" autocomplete="address-level2" aria-describedby="city-error" />
                <shop-field-error [control]="form.controls.address.controls.city" id="city-error" />
              </div>
              <div class="shop-field">
                <label for="postalCode">Postal code</label>
                <input id="postalCode" class="shop-input" formControlName="postalCode" autocomplete="postal-code" aria-describedby="postal-error" />
                <shop-field-error [control]="form.controls.address.controls.postalCode" id="postal-error" />
              </div>
            </div>
            <div class="shop-field">
              <label for="country">Country</label>
              <select id="country" class="shop-select" formControlName="country" autocomplete="country">
                @for (country of countries; track country.code) {
                  <option [value]="country.code">{{ country.name }}</option>
                }
              </select>
            </div>
          </fieldset>

          <fieldset class="shop-card">
            <legend>Payment (simulator – no real cards)</legend>
            @for (option of paymentOptions; track option.token) {
              <label class="payment">
                <input type="radio" formControlName="paymentToken" [value]="option.token" />
                <span>
                  <strong>{{ option.label }}</strong><br />
                  <span class="shop-muted">{{ option.hint }}</span>
                </span>
              </label>
            }
          </fieldset>

          <button shopButton type="submit" [block]="true" [loading]="submitting()" [disabled]="!cart.canCheckout()" data-testid="place-order">
            Place order
          </button>
        </form>

        <shop-order-summary-panel />
      </div>
    }
  `,
  styles: `
    .layout { display: grid; gap: var(--shop-space-6); grid-template-columns: 1fr 320px; align-items: start; }
    fieldset { margin: 0 0 var(--shop-space-4); }
    legend { font-weight: 700; padding: 0 var(--shop-space-2); }
    .row { display: grid; gap: var(--shop-space-4); grid-template-columns: 1fr 1fr; }
    .payment { display: flex; gap: var(--shop-space-3); align-items: flex-start; padding: var(--shop-space-2) 0; cursor: pointer; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
  `,
})
export class CheckoutPage {
  protected readonly cart = inject(CartStore);
  private readonly ordersApi = inject(OrdersApi);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  protected readonly countries = COUNTRIES;
  protected readonly paymentOptions = PAYMENT_OPTIONS;
  protected readonly submitting = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  /**
   * The idempotency key identifies one checkout ATTEMPT. Retrying the identical request (after a timeout,
   * a 503 or a double click) reuses the key, so the server returns the existing order instead of charging
   * twice. Any change to the request (address, payment method, cart) starts a new attempt with a new key.
   */
  private attempt: { readonly payload: string; readonly key: string } | null = null;

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    address: this.fb.group({
      recipient: [inject(AuthSession).user()?.fullName ?? '', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
      line1: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
      city: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      postalCode: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(20)]],
      country: ['US' as string, Validators.required],
    }),
    paymentToken: ['tok_visa' as PaymentToken, Validators.required],
  });

  protected placeOrder(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.submitting() || !this.cart.canCheckout()) {
      return;
    }

    const { address, paymentToken } = this.form.getRawValue();
    const request: CheckoutRequest = {
      // Only ids and quantities are sent: prices and totals are always computed by the server.
      items: this.cart.lines().map(({ productId, quantity }) => ({ productId, quantity })),
      shippingAddress: {
        recipient: address.recipient.trim(),
        line1: address.line1.trim(),
        city: address.city.trim(),
        postalCode: address.postalCode.trim(),
        country: address.country,
      },
      paymentToken,
    };

    const payload = JSON.stringify(request);
    if (this.attempt?.payload !== payload) {
      this.attempt = { payload, key: createIdempotencyKey() };
    }

    this.submitting.set(true);
    this.error.set(null);
    this.ordersApi.checkout(request, this.attempt.key).subscribe({
      next: (order) => {
        this.attempt = null;
        this.cart.clear();
        this.toasts.success(`Order ${order.orderNumber} placed.`);
        void this.router.navigate(['/orders', order.id], { queryParams: { placed: 1 } });
      },
      error: (error: unknown) => {
        const apiError = toApiError(error);
        this.submitting.set(false);
        this.error.set(apiError);
        if (apiError.code === 'insufficient_stock' || apiError.code === 'product_unavailable') {
          this.cart.refreshQuote();
        }
      },
    });
  }

  protected readonly errorTitle = computed(() => {
    switch (this.error()?.code) {
      case 'insufficient_stock':
      case 'product_unavailable':
        return 'Some items are no longer available in the requested quantity. Your cart has been updated.';
      case 'payment_declined':
        return 'Payment declined.';
      case 'payment_unavailable':
        return 'Payment provider unavailable. You can safely retry: you will not be charged twice.';
      case 'network_error':
        return 'Connection problem. Retrying is safe: the same order will not be created twice.';
      default:
        return 'The order could not be placed.';
    }
  });
}
