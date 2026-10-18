import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Button, EmptyState, ErrorState, Pagination, Spinner } from '@shop/shared/ui';
import { applyFilterPatch, CatalogFilters, CatalogStore, DEFAULT_CATALOG_FILTERS, WishlistStore } from '@shop/state/contracts';
import { map } from 'rxjs';
import { ProductActions } from '../../shared/product-actions';
import { ProductCard } from '../../shared/product-card';
import { CatalogFiltersPanel } from './catalog-filters-panel';
import { filtersFromParams, filtersToParams } from './catalog-query-params';

@Component({
  selector: 'shop-catalog-page',
  imports: [Button, EmptyState, ErrorState, Pagination, Spinner, ProductCard, CatalogFiltersPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Catalog</h1>
    <div class="layout">
      <aside>
        <shop-catalog-filters-panel
          [filters]="store.filters()"
          [categories]="store.categories()"
          [brands]="store.brands()"
          (changed)="changeFilters($event)"
          (searchChanged)="changeFilters({ search: $event }, true)"
          (cleared)="changeFilters(defaults)"
        />
      </aside>

      <section aria-labelledby="results-heading" [attr.aria-busy]="store.status() === 'loading'">
        <h2 id="results-heading" class="shop-visually-hidden">Results</h2>
        <p class="shop-muted" aria-live="polite" data-testid="result-count">
          @if (store.status() === 'success') {
            {{ store.totalCount() }} {{ store.totalCount() === 1 ? 'product' : 'products' }} found
          }
        </p>

        @switch (store.status()) {
          @case ('error') {
            <shop-error-state title="Could not load products" [message]="store.error()?.message ?? ''" (retry)="store.reload()" />
          }
          @default {
            @if (store.isEmpty()) {
              <shop-empty-state title="No products match your filters" message="Try a different search or remove some filters.">
                <button shopButton variant="secondary" type="button" (click)="changeFilters(defaults)">Clear filters</button>
              </shop-empty-state>
            } @else {
              @if (store.status() === 'loading') {
                <div class="loading"><shop-spinner label="Loading products" /></div>
              }
              <div class="grid" [class.grid--stale]="store.status() === 'loading'">
                @for (product of store.products(); track product.id) {
                  <shop-product-card
                    [product]="product"
                    [inWishlist]="wishlist.has(product.id)"
                    (addToCart)="actions.addToCart($event)"
                    (toggleWishlist)="actions.toggleWishlist($event)"
                  />
                }
              </div>
              <shop-pagination [page]="store.filters().page" [totalPages]="store.totalPages()" (pageChange)="changeFilters({ page: $event })" />
            }
          }
        }
      </section>
    </div>
  `,
  styles: `
    .layout { display: grid; gap: var(--shop-space-6); grid-template-columns: 260px 1fr; align-items: start; }
    .grid { display: grid; gap: var(--shop-space-4); grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
    .grid--stale { opacity: 0.55; }
    .loading { display: flex; justify-content: center; padding: var(--shop-space-4); }
    @media (max-width: 768px) { .layout { grid-template-columns: 1fr; } }
  `,
})
export class CatalogPage {
  protected readonly store = inject(CatalogStore);
  protected readonly wishlist = inject(WishlistStore);
  protected readonly actions = inject(ProductActions);
  protected readonly defaults = DEFAULT_CATALOG_FILTERS;
  private readonly router = inject(Router);

  constructor() {
    // URL -> store. Each query-string change (including back/forward) loads the matching page;
    // the store's switchMap discards responses for filters the user has already left.
    inject(ActivatedRoute)
      .queryParamMap.pipe(map(filtersFromParams), takeUntilDestroyed())
      .subscribe((filters) => this.store.open(filters));
  }

  /** UI -> URL. Typing in the search box replaces the history entry instead of adding one per keystroke. */
  protected changeFilters(patch: Partial<CatalogFilters>, replaceUrl = false): void {
    const next = applyFilterPatch(this.store.filters(), patch);
    void this.router.navigate([], { queryParams: filtersToParams(next), replaceUrl });
  }
}
