import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Button, Spinner } from '@shop/shared/ui';
import { CartStore } from '@shop/state/contracts';

/**
 * Totals panel shared by the cart and checkout pages. Final numbers always come from the server quote;
 * the snapshot-based estimate is labelled as such and shown only while a quote is in flight.
 */
@Component({
  selector: 'shop-order-summary-panel',
  imports: [CurrencyPipe, Button, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="shop-card summary" aria-labelledby="summary-heading" [attr.aria-busy]="cart.quoteStatus() === 'loading'">
      <h2 id="summary-heading">Order summary</h2>
      @if (cart.quoteStatus() === 'error') {
        <p class="shop-alert" role="alert">{{ cart.quoteError()?.message }}</p>
        <button shopButton variant="secondary" size="sm" type="button" (click)="cart.refreshQuote()">Recalculate</button>
      } @else if (cart.quote(); as quote) {
        <dl>
          <div><dt>Subtotal</dt><dd data-testid="summary-subtotal">{{ quote.subtotal | currency: 'USD' }}</dd></div>
          <div>
            <dt>Shipping</dt>
            <dd data-testid="summary-shipping">{{ quote.shipping === 0 ? 'Free' : (quote.shipping | currency: 'USD') }}</dd>
          </div>
          <div class="total"><dt>Total</dt><dd data-testid="summary-total">{{ quote.total | currency: 'USD' }}</dd></div>
        </dl>
        @if (quote.shipping > 0) {
          <p class="shop-muted hint">Free shipping on orders of {{ quote.freeShippingThreshold | currency: 'USD' }} or more.</p>
        }
        @if (cart.quoteStatus() === 'loading') {
          <shop-spinner size="sm" label="Updating totals" />
        }
      } @else {
        <p class="shop-muted">Estimated subtotal: {{ cart.estimatedSubtotal() | currency: 'USD' }}</p>
        <shop-spinner size="sm" label="Calculating totals" />
      }
      <div class="actions"><ng-content /></div>
    </aside>
  `,
  styles: `
    dl { margin: 0; }
    dl div { display: flex; justify-content: space-between; padding: var(--shop-space-1) 0; }
    dd { margin: 0; font-variant-numeric: tabular-nums; }
    .total { border-top: 1px solid var(--shop-color-border); margin-top: var(--shop-space-2); padding-top: var(--shop-space-2); font-weight: 800; }
    .hint { font-size: var(--shop-font-size-sm); }
    .actions { margin-top: var(--shop-space-4); }
  `,
})
export class OrderSummaryPanel {
  protected readonly cart = inject(CartStore);
}
