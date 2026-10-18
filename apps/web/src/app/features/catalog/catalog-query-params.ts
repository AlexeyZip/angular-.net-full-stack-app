import { ParamMap, Params } from '@angular/router';
import { PRODUCT_SORTS, ProductSort } from '@shop/shared/data-access';
import { CatalogFilters, DEFAULT_CATALOG_FILTERS } from '@shop/state/contracts';

/**
 * The URL is the source of truth for catalog filters (shareable links, working back button).
 * Query parameters are untrusted input, so parsing is defensive: anything invalid falls back to the default.
 */
export function filtersFromParams(params: ParamMap): CatalogFilters {
  const sort = params.get('sort');
  const minPrice = toPrice(params.get('minPrice'));
  const maxPrice = toPrice(params.get('maxPrice'));
  return {
    ...DEFAULT_CATALOG_FILTERS,
    search: (params.get('search') ?? '').trim().slice(0, 100),
    category: params.get('category') || null,
    brand: params.get('brand') || null,
    minPrice,
    maxPrice: minPrice !== null && maxPrice !== null && maxPrice < minPrice ? null : maxPrice,
    inStock: params.get('inStock') === 'true',
    sort: isSort(sort) ? sort : DEFAULT_CATALOG_FILTERS.sort,
    page: toPage(params.get('page')),
  };
}

/** Only non-default values are written, which keeps URLs short and canonical. */
export function filtersToParams(filters: CatalogFilters): Params {
  return {
    search: filters.search || null,
    category: filters.category,
    brand: filters.brand,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    inStock: filters.inStock || null,
    sort: filters.sort === DEFAULT_CATALOG_FILTERS.sort ? null : filters.sort,
    page: filters.page > 1 ? filters.page : null,
  };
}

function isSort(value: string | null): value is ProductSort {
  return value !== null && (PRODUCT_SORTS as readonly string[]).includes(value);
}

function toPrice(value: string | null): number | null {
  if (value === null || value.trim() === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function toPage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 10_000 ? parsed : 1;
}
