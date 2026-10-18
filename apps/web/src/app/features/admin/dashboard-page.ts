import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminApi, errorOf, LOADING, loadable, ORDER_STATUSES, valueOf } from '@shop/shared/data-access';
import { ErrorState, Spinner } from '@shop/shared/ui';
import { switchMap } from 'rxjs';
import { OrderStatusBadge } from '../../shared/order-status-badge';

@Component({
  selector: 'shop-admin-dashboard-page',
  imports: [CurrencyPipe, DatePipe, RouterLink, ErrorState, Spinner, OrderStatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Dashboard</h1>
    @switch (state().status) {
      @case ('loading') {
        <shop-spinner label="Loading dashboard" />
      }
      @case ('error') {
        <shop-error-state [message]="errorMessage()" (retry)="reload.update((n) => n + 1)" />
      }
      @case ('success') {
        @if (dashboard(); as d) {
          <section class="kpis" aria-label="Key figures">
            <div class="shop-card kpi"><span class="shop-muted">Revenue (excl. cancelled)</span><strong>{{ d.revenue | currency: 'USD' }}</strong></div>
            <div class="shop-card kpi"><span class="shop-muted">Revenue, last 30 days</span><strong>{{ d.revenueLast30Days | currency: 'USD' }}</strong></div>
            <div class="shop-card kpi"><span class="shop-muted">Orders</span><strong data-testid="kpi-orders">{{ d.orderCount }}</strong></div>
            <div class="shop-card kpi"><span class="shop-muted">Customers</span><strong>{{ d.customerCount }}</strong></div>
            <div class="shop-card kpi"><span class="shop-muted">Active products</span><strong>{{ d.activeProductCount }}</strong></div>
          </section>

          <div class="columns">
            <section class="shop-card" aria-labelledby="status-heading">
              <h2 id="status-heading">Orders by status</h2>
              <ul class="plain">
                @for (status of statuses; track status) {
                  <li><shop-order-status-badge [status]="status" /> {{ d.ordersByStatus[status] }}</li>
                }
              </ul>
            </section>
            <section class="shop-card" aria-labelledby="low-stock-heading">
              <h2 id="low-stock-heading">Low stock</h2>
              <ul class="plain">
                @for (product of d.lowStockProducts; track product.id) {
                  <li>
                    <a [routerLink]="['/admin/products', product.id]">{{ product.name }}</a> –
                    <span [class.danger]="product.stockQuantity === 0">{{ product.stockQuantity }} left</span>
                  </li>
                } @empty {
                  <li class="shop-muted">All products are well stocked.</li>
                }
              </ul>
            </section>
          </div>

          <section class="shop-card" aria-labelledby="recent-heading">
            <h2 id="recent-heading">Recent orders</h2>
            <div class="shop-table-wrapper">
              <table class="shop-table">
                <thead>
                  <tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Date</th><th scope="col">Status</th><th scope="col" class="shop-table__number">Total</th></tr>
                </thead>
                <tbody>
                  @for (order of d.recentOrders; track order.id) {
                    <tr>
                      <td><a [routerLink]="['/admin/orders', order.id]">{{ order.orderNumber }}</a></td>
                      <td>{{ order.customerEmail }}</td>
                      <td>{{ order.createdAt | date: 'short' }}</td>
                      <td><shop-order-status-badge [status]="order.status" /></td>
                      <td class="shop-table__number">{{ order.total | currency: 'USD' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }
      }
    }
  `,
  styles: `
    .kpis { display: grid; gap: var(--shop-space-4); grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); margin-bottom: var(--shop-space-6); }
    .kpi { display: flex; flex-direction: column; gap: var(--shop-space-1); }
    .kpi strong { font-size: var(--shop-font-size-xl); }
    .columns { display: grid; gap: var(--shop-space-4); grid-template-columns: 1fr 1fr; margin-bottom: var(--shop-space-6); }
    .plain { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--shop-space-2); }
    .danger { color: var(--shop-color-danger); font-weight: 700; }
    @media (max-width: 768px) { .columns { grid-template-columns: 1fr; } }
  `,
})
export class DashboardPage {
  private readonly api = inject(AdminApi);
  protected readonly statuses = ORDER_STATUSES;
  protected readonly reload = signal(0);
  protected readonly state = toSignal(toObservable(this.reload).pipe(switchMap(() => loadable(this.api.dashboard()))), { initialValue: LOADING });
  protected readonly dashboard = computed(() => valueOf(this.state()));
  protected readonly errorMessage = computed(() => errorOf(this.state())?.message ?? '');
}
