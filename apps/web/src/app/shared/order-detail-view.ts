import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { OrderDetail } from '@shop/shared/data-access';
import { OrderStatusBadge } from './order-status-badge';

/** Read-only order rendering shared by the customer order page and the admin order page. */
@Component({
  selector: 'shop-order-detail-view',
  imports: [CurrencyPipe, DatePipe, OrderStatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let o = order();
    <header class="head">
      <div>
        <h1>Order {{ o.orderNumber }}</h1>
        <p class="shop-muted">Placed {{ o.createdAt | date: 'medium' }} · Updated {{ o.updatedAt | date: 'medium' }}</p>
        @if (o.customerEmail) {
          <p class="shop-muted">Customer: {{ o.customerEmail }}</p>
        }
      </div>
      <shop-order-status-badge [status]="o.status" />
    </header>

    <div class="layout">
      <section class="shop-card" aria-labelledby="items-heading">
        <h2 id="items-heading">Items</h2>
        <div class="shop-table-wrapper">
          <table class="shop-table">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col" class="shop-table__number">Price</th>
                <th scope="col" class="shop-table__number">Qty</th>
                <th scope="col" class="shop-table__number">Total</th>
              </tr>
            </thead>
            <tbody>
              @for (item of o.items; track item.productId) {
                <tr>
                  <td>{{ item.productName }}</td>
                  <td class="shop-table__number">{{ item.unitPrice | currency: 'USD' }}</td>
                  <td class="shop-table__number">{{ item.quantity }}</td>
                  <td class="shop-table__number">{{ item.lineTotal | currency: 'USD' }}</td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr><th scope="row" colspan="3">Subtotal</th><td class="shop-table__number">{{ o.subtotal | currency: 'USD' }}</td></tr>
              <tr><th scope="row" colspan="3">Shipping</th><td class="shop-table__number">{{ o.shippingCost | currency: 'USD' }}</td></tr>
              <tr><th scope="row" colspan="3">Total</th><td class="shop-table__number" data-testid="order-total"><strong>{{ o.total | currency: 'USD' }}</strong></td></tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section class="shop-card" aria-labelledby="shipping-heading">
        <h2 id="shipping-heading">Shipping to</h2>
        <address>
          {{ o.shippingAddress.recipient }}<br />
          {{ o.shippingAddress.line1 }}<br />
          {{ o.shippingAddress.postalCode }} {{ o.shippingAddress.city }}<br />
          {{ o.shippingAddress.country }}
        </address>
        <h2 class="payment-heading">Payment</h2>
        <p class="shop-muted">Simulator reference: <code>{{ o.paymentReference }}</code></p>
      </section>
    </div>
  `,
  styles: `
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--shop-space-4); }
    .head p { margin: 0; }
    .layout { display: grid; gap: var(--shop-space-4); grid-template-columns: 2fr 1fr; margin: var(--shop-space-6) 0; align-items: start; }
    address { font-style: normal; }
    .payment-heading { margin-top: var(--shop-space-6); font-size: var(--shop-font-size-md); }
    code { word-break: break-all; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
  `,
})
export class OrderDetailView {
  readonly order = input.required<OrderDetail>();
}
