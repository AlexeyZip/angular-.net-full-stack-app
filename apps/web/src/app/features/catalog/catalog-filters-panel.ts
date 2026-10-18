import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { outputFromObservable } from '@angular/core/rxjs-interop';
import { Category, PRODUCT_SORTS, ProductSort } from '@shop/shared/data-access';
import { Button } from '@shop/shared/ui';
import { CatalogFilters } from '@shop/state/contracts';
import { debounceTime, distinctUntilChanged, map, Subject } from 'rxjs';

const SORT_LABELS: Record<ProductSort, string> = {
  Newest: 'Newest',
  PriceAsc: 'Price: low to high',
  PriceDesc: 'Price: high to low',
  Name: 'Name',
  Rating: 'Top rated',
};

/**
 * Presentational filter panel. The current filters come in; changes go out as patches.
 * Search typing is time-based, so it is RxJS: debounce 300 ms and skip duplicates before emitting.
 */
@Component({
  selector: 'shop-catalog-filters-panel',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="filters shop-card" (submit)="$event.preventDefault()" aria-label="Product filters">
      <div class="shop-field">
        <label for="filter-search">Search</label>
        <input
          id="filter-search"
          class="shop-input"
          type="search"
          maxlength="100"
          [value]="filters().search"
          (input)="searchTerms.next(searchField.value)"
          #searchField
        />
      </div>

      <div class="shop-field">
        <label for="filter-category">Category</label>
        <select id="filter-category" class="shop-select" (change)="emit({ category: categoryField.value || null, brand: null })" #categoryField>
          <option value="" [selected]="!filters().category">All categories</option>
          @for (category of categories(); track category.id) {
            <option [value]="category.slug" [selected]="category.slug === filters().category">{{ category.name }}</option>
          }
        </select>
      </div>

      <div class="shop-field">
        <label for="filter-brand">Brand</label>
        <select id="filter-brand" class="shop-select" (change)="emit({ brand: brandField.value || null })" #brandField>
          <option value="" [selected]="!filters().brand">All brands</option>
          @for (brand of brands(); track brand) {
            <option [value]="brand" [selected]="brand === filters().brand">{{ brand }}</option>
          }
        </select>
      </div>

      <fieldset class="price">
        <legend>Price</legend>
        <label class="shop-visually-hidden" for="filter-min">Minimum price</label>
        <input
          id="filter-min"
          class="shop-input"
          type="number"
          min="0"
          placeholder="Min"
          [value]="filters().minPrice ?? ''"
          (change)="setPrice('minPrice', minField.value)"
          #minField
        />
        <span aria-hidden="true">–</span>
        <label class="shop-visually-hidden" for="filter-max">Maximum price</label>
        <input
          id="filter-max"
          class="shop-input"
          type="number"
          min="0"
          placeholder="Max"
          [value]="filters().maxPrice ?? ''"
          (change)="setPrice('maxPrice', maxField.value)"
          #maxField
        />
      </fieldset>
      @if (priceRangeInvalid()) {
        <p class="shop-field__error" role="alert">The minimum price cannot exceed the maximum price.</p>
      }

      <label class="checkbox">
        <input type="checkbox" [checked]="filters().inStock" (change)="emit({ inStock: stockField.checked })" #stockField />
        In stock only
      </label>

      <div class="shop-field">
        <label for="filter-sort">Sort by</label>
        <select id="filter-sort" class="shop-select" (change)="emit({ sort: $any(sortField.value) })" #sortField>
          @for (sort of sorts; track sort) {
            <option [value]="sort" [selected]="sort === filters().sort">{{ sortLabels[sort] }}</option>
          }
        </select>
      </div>

      <button shopButton variant="secondary" type="button" [block]="true" (click)="cleared.emit()">Clear filters</button>
    </form>
  `,
  styles: `
    .filters { display: flex; flex-direction: column; }
    .price { display: flex; align-items: center; gap: var(--shop-space-2); border: 0; padding: 0; margin: 0 0 var(--shop-space-4); }
    .price legend { font-weight: 600; font-size: var(--shop-font-size-sm); margin-bottom: var(--shop-space-1); }
    .checkbox { display: flex; gap: var(--shop-space-2); align-items: center; margin-bottom: var(--shop-space-4); }
  `,
})
export class CatalogFiltersPanel {
  readonly filters = input.required<CatalogFilters>();
  readonly categories = input.required<readonly Category[]>();
  readonly brands = input.required<readonly string[]>();
  readonly changed = output<Partial<CatalogFilters>>();
  readonly cleared = output<void>();

  protected readonly sorts = PRODUCT_SORTS;
  protected readonly sortLabels = SORT_LABELS;
  protected readonly searchTerms = new Subject<string>();

  /** A separate output for search, built directly from the debounced stream. */
  readonly searchChanged = outputFromObservable(
    this.searchTerms.pipe(
      map((term) => term.trim()),
      debounceTime(300),
      distinctUntilChanged(),
    ),
  );

  protected readonly priceRangeInvalid = signal(false);

  protected emit(patch: Partial<CatalogFilters>): void {
    this.changed.emit(patch);
  }

  /** An inverted range is rejected locally (the API would answer 400), keeping the last valid filter. */
  protected setPrice(key: 'minPrice' | 'maxPrice', raw: string): void {
    const parsed = raw.trim() === '' ? null : Number(raw);
    const value = parsed !== null && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    const min = key === 'minPrice' ? value : this.filters().minPrice;
    const max = key === 'maxPrice' ? value : this.filters().maxPrice;

    this.priceRangeInvalid.set(min !== null && max !== null && min > max);
    if (!this.priceRangeInvalid()) {
      this.emit({ [key]: value });
    }
  }
}
