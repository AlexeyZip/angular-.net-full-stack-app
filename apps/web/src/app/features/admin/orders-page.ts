import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminApi, errorOf, LOADING, loadable, ORDER_STATUSES, OrderStatus, valueOf } from '@shop/shared/data-access';
import { EmptyState, ErrorState, Pagination, Spinner } from '@shop/shared/ui';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { OrderStatusBadge } from '../../shared/order-status-badge';

@Component({
  selector: 'shop-admin-orders-page',
  imports: [CurrencyPipe, DatePipe, RouterLink, EmptyState, ErrorState, Pagination, Spinner, OrderStatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Orders</h1>
    <div class="toolbar">
      <label class="shop-visually-hidden" for="order-search">Search orders</label>
      <input id="order-search" class="shop-input" type="search" placeholder="Order number or customer email" maxlength="100" (input)="onSearch(search.value)" #search />
      <label class="shop-visually-hidden" for="order-status">Status</label>
      <select id="order-status" class="shop-select" (change)="onStatus(statusField.value)" #statusField>
        <option value="">All statuses</option>
        @for (status of statuses; track status) {
          <option [value]="status">{{ status }}</option>
        }
      </select>
    </div>

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
            <shop-empty-state title="No orders found" />
          } @else {
            <div class="shop-table-wrapper">
              <table class="shop-table">
                <thead>
                  <tr>
                    <th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Date</th><th scope="col">Status</th>
                    <th scope="col" class="shop-table__number">Items</th><th scope="col" class="shop-table__number">Total</th>
                  </tr>
                </thead>
                <tbody>
                  @for (order of result.items; track order.id) {
                    <tr>
                      <td><a [routerLink]="['/admin/orders', order.id]">{{ order.orderNumber }}</a></td>
                      <td>{{ order.customerEmail }}</td>
                      <td>{{ order.createdAt | date: 'short' }}</td>
                      <td><shop-order-status-badge [status]="order.status" /></td>
                      <td class="shop-table__number">{{ order.itemCount }}</td>
                      <td class="shop-table__number">{{ order.total | currency: 'USD' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <shop-pagination [page]="page()" [totalPages]="result.totalPages" (pageChange)="page.set($event)" />
          }
        }
      }
    }
  `,
  styles: `
    .toolbar { display: flex; gap: var(--shop-space-4); margin-bottom: var(--shop-space-4); }
    .toolbar .shop-input { max-width: 320px; }
    .toolbar .shop-select { max-width: 200px; }
  `,
})
export class AdminOrdersPage {
  private readonly api = inject(AdminApi);
  protected readonly statuses = ORDER_STATUSES;
  private readonly searchTerm = signal('');
  private readonly status = signal<OrderStatus | null>(null);
  protected readonly page = signal(1);
  protected readonly reload = signal(0);

  private readonly debouncedSearch = toSignal(toObservable(this.searchTerm).pipe(debounceTime(300), distinctUntilChanged()), { initialValue: '' });
  private readonly query = computed(() => ({
    search: this.debouncedSearch() || null,
    status: this.status(),
    page: this.page(),
    reload: this.reload(),
  }));

  protected readonly state = toSignal(
    toObservable(this.query).pipe(switchMap(({ search, status, page }) => loadable(this.api.orders({ search, status, page })))),
    { initialValue: LOADING },
  );
  protected readonly result = computed(() => valueOf(this.state()));
  protected readonly errorMessage = computed(() => errorOf(this.state())?.message ?? '');

  protected onSearch(term: string): void {
    this.searchTerm.set(term.trim());
    this.page.set(1);
  }

  protected onStatus(value: string): void {
    this.status.set((ORDER_STATUSES as readonly string[]).includes(value) ? (value as OrderStatus) : null);
    this.page.set(1);
  }
}
