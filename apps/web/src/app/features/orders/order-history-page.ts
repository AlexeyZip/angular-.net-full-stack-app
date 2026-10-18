import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { errorOf, LOADING, loadable, OrdersApi, valueOf } from '@shop/shared/data-access';
import { Button, EmptyState, ErrorState, Pagination, Spinner } from '@shop/shared/ui';
import { switchMap } from 'rxjs';
import { OrderStatusBadge } from '../../shared/order-status-badge';

@Component({
  selector: 'shop-order-history-page',
  imports: [CurrencyPipe, DatePipe, RouterLink, Button, EmptyState, ErrorState, Pagination, Spinner, OrderStatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Your orders</h1>
    @switch (state().status) {
      @case ('loading') {
        <shop-spinner label="Loading orders" />
      }
      @case ('error') {
        <shop-error-state [message]="errorMessage()" (retry)="reload.update((n) => n + 1)" />
      }
      @case ('success') {
        @if (result(); as result) {
          @if (result.totalCount === 0) {
            <shop-empty-state title="No orders yet" message="When you place an order, it will appear here.">
              <a shopButton routerLink="/products">Start shopping</a>
            </shop-empty-state>
          } @else {
            <div class="shop-table-wrapper">
              <table class="shop-table">
                <caption class="shop-visually-hidden">Your orders, newest first</caption>
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">Date</th>
                    <th scope="col">Status</th>
                    <th scope="col" class="shop-table__number">Items</th>
                    <th scope="col" class="shop-table__number">Total</th>
                  </tr>
                </thead>
                <tbody>
                  @for (order of result.items; track order.id) {
                    <tr data-testid="order-row">
                      <td><a [routerLink]="['/orders', order.id]">{{ order.orderNumber }}</a></td>
                      <td>{{ order.createdAt | date: 'mediumDate' }}</td>
                      <td><shop-order-status-badge [status]="order.status" /></td>
                      <td class="shop-table__number">{{ order.itemCount }}</td>
                      <td class="shop-table__number">{{ order.total | currency: 'USD' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <shop-pagination label="Order pages" [page]="page()" [totalPages]="result.totalPages" (pageChange)="page.set($event)" />
          }
        }
      }
    }
  `,
})
export class OrderHistoryPage {
  private readonly api = inject(OrdersApi);
  protected readonly page = signal(1);
  protected readonly reload = signal(0);

  // computed() combines both triggers into one value; toObservable + switchMap cancels outdated requests.
  private readonly request = computed(() => ({ page: this.page(), reload: this.reload() }));
  protected readonly state = toSignal(toObservable(this.request).pipe(switchMap(({ page }) => loadable(this.api.list(page)))), {
    initialValue: LOADING,
  });
  protected readonly result = computed(() => valueOf(this.state()));
  protected readonly errorMessage = computed(() => errorOf(this.state())?.message ?? '');
}
