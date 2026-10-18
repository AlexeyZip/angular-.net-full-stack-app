import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartQuoteLine } from '@shop/shared/data-access';
import { Button, ConfirmDialog, EmptyState, ProductImage, QuantityStepper } from '@shop/shared/ui';
import { CartStore, MAX_QUANTITY_PER_LINE } from '@shop/state/contracts';
import { OrderSummaryPanel } from './order-summary-panel';

@Component({
  selector: 'shop-cart-page',
  imports: [CurrencyPipe, RouterLink, Button, ConfirmDialog, EmptyState, ProductImage, QuantityStepper, OrderSummaryPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Your cart</h1>
    @if (cart.isEmpty()) {
      <shop-empty-state title="Your cart is empty" message="Find something you like in the catalog.">
        <a shopButton routerLink="/products">Browse the catalog</a>
      </shop-empty-state>
    } @else {
      <div class="layout">
        <section aria-label="Cart items">
          <ul class="lines">
            @for (line of cart.lines(); track line.productId) {
              @let quoteLine = quoteLines().get(line.productId);
              <li class="line shop-card" data-testid="cart-line">
                <shop-product-image class="line__image" [src]="line.imageUrl" [alt]="line.name" [seed]="line.productId" />
                <div class="line__info">
                  <a [routerLink]="['/products', line.slug]">{{ line.name }}</a>
                  <p class="shop-muted">{{ quoteLine?.unitPrice ?? line.unitPriceSnapshot | currency: 'USD' }} each</p>
                  @if (quoteLine?.issue === 'Unavailable') {
                    <p class="issue" role="alert">This product is no longer available. Remove it to check out.</p>
                  } @else if (quoteLine?.issue === 'InsufficientStock') {
                    <p class="issue" role="alert">Only {{ quoteLine?.availableQuantity }} in stock. Reduce the quantity to check out.</p>
                  }
                </div>
                <shop-quantity-stepper
                  [value]="line.quantity"
                  (valueChange)="cart.updateQuantity(line.productId, $event)"
                  [max]="maxPerLine"
                  [label]="'quantity of ' + line.name"
                />
                <p class="line__total">
                  @if (quoteLine) {
                    {{ quoteLine.lineTotal | currency: 'USD' }}
                  } @else {
                    <span class="shop-muted">…</span>
                  }
                </p>
                <button shopButton variant="ghost" size="sm" type="button" (click)="cart.remove(line.productId)" [attr.aria-label]="'Remove ' + line.name">
                  Remove
                </button>
              </li>
            }
          </ul>
          <button shopButton variant="ghost" type="button" (click)="confirmClear.set(true)">Clear cart</button>
        </section>

        <shop-order-summary-panel>
          <button shopButton type="button" routerLink="/checkout" [block]="true" [disabled]="!cart.canCheckout()" data-testid="checkout-button">
            Proceed to checkout
          </button>
        </shop-order-summary-panel>
      </div>

      <shop-confirm-dialog
        [(open)]="confirmClear"
        title="Clear the cart?"
        message="All items will be removed from your cart."
        confirmLabel="Clear cart"
        [danger]="true"
        (confirmed)="cart.clear()"
      />
    }
  `,
  styles: `
    .layout { display: grid; gap: var(--shop-space-6); grid-template-columns: 1fr 320px; align-items: start; }
    .lines { list-style: none; padding: 0; margin: 0 0 var(--shop-space-4); display: flex; flex-direction: column; gap: var(--shop-space-3); }
    .line { display: grid; grid-template-columns: 96px 1fr auto 100px auto; gap: var(--shop-space-4); align-items: center; }
    .line__info p { margin: var(--shop-space-1) 0 0; }
    .line__total { font-weight: 700; text-align: right; margin: 0; }
    .issue { color: var(--shop-color-danger); font-size: var(--shop-font-size-sm); }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      .line { grid-template-columns: 72px 1fr; }
    }
  `,
})
export class CartPage {
  protected readonly cart = inject(CartStore);
  protected readonly maxPerLine = MAX_QUANTITY_PER_LINE;
  protected readonly confirmClear = signal(false);

  protected readonly quoteLines = computed(
    () => new Map<number, CartQuoteLine>((this.cart.quote()?.lines ?? []).map((line) => [line.productId, line])),
  );
}
