import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminApi, errorOf, LOADING, loadable, valueOf } from '@shop/shared/data-access';
import { Button, EmptyState, ErrorState, Pagination, Spinner } from '@shop/shared/ui';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

@Component({
  selector: 'shop-admin-products-page',
  imports: [CurrencyPipe, RouterLink, Button, EmptyState, ErrorState, Pagination, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <h1>Products</h1>
      <a shopButton routerLink="/admin/products/new">New product</a>
    </div>

    <div class="toolbar">
      <label class="shop-visually-hidden" for="product-search">Search products</label>
      <input id="product-search" class="shop-input" type="search" placeholder="Search by name or brand" maxlength="100" (input)="onSearch(search.value)" #search />
      <label class="checkbox">
        <input type="checkbox" [checked]="lowStockOnly()" (change)="lowStockOnly.set(lowStock.checked); page.set(1)" #lowStock />
        Low stock only
      </label>
    </div>

    @switch (state().status) {
      @case ('loading') {
        <shop-spinner label="Loading products" />
      }
      @case ('error') {
        <shop-error-state [message]="errorMessage()" (retry)="reload.update((n) => n + 1)" />
      }
      @case ('success') {
        @if (result(); as result) {
          @if (result.totalCount === 0) {
            <shop-empty-state title="No products found" />
          } @else {
            <div class="shop-table-wrapper">
              <table class="shop-table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Category</th>
                    <th scope="col" class="shop-table__number">Price</th>
                    <th scope="col" class="shop-table__number">Stock</th>
                    <th scope="col">Status</th>
                    <th scope="col"><span class="shop-visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (product of result.items; track product.id) {
                    <tr data-testid="admin-product-row">
                      <td>{{ product.name }}<br /><span class="shop-muted">{{ product.brand }}</span></td>
                      <td>{{ product.categoryName }}</td>
                      <td class="shop-table__number">{{ product.price | currency: 'USD' }}</td>
                      <td class="shop-table__number" [class.low]="product.stockQuantity <= 5">{{ product.stockQuantity }}</td>
                      <td>{{ product.isActive ? 'Active' : 'Archived' }}</td>
                      <td><a [routerLink]="['/admin/products', product.id]" [attr.aria-label]="'Edit ' + product.name">Edit</a></td>
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
    .head { display: flex; justify-content: space-between; align-items: center; }
    .toolbar { display: flex; gap: var(--shop-space-4); align-items: center; margin-bottom: var(--shop-space-4); }
    .toolbar .shop-input { max-width: 320px; }
    .checkbox { display: flex; gap: var(--shop-space-2); align-items: center; white-space: nowrap; }
    .low { color: var(--shop-color-danger); font-weight: 700; }
  `,
})
export class AdminProductsPage {
  private readonly api = inject(AdminApi);
  private readonly searchTerm = signal('');
  protected readonly lowStockOnly = signal(false);
  protected readonly page = signal(1);
  protected readonly reload = signal(0);

  private readonly debouncedSearch = toSignal(toObservable(this.searchTerm).pipe(debounceTime(300), distinctUntilChanged()), {
    initialValue: '',
  });

  private readonly query = computed(() => ({
    search: this.debouncedSearch() || null,
    lowStockOnly: this.lowStockOnly() || null,
    page: this.page(),
    reload: this.reload(),
  }));

  protected readonly state = toSignal(
    toObservable(this.query).pipe(switchMap(({ search, lowStockOnly, page }) => loadable(this.api.products({ search, lowStockOnly, page })))),
    { initialValue: LOADING },
  );
  protected readonly result = computed(() => valueOf(this.state()));
  protected readonly errorMessage = computed(() => errorOf(this.state())?.message ?? '');

  protected onSearch(term: string): void {
    this.searchTerm.set(term.trim());
    this.page.set(1);
  }
}
