import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import { ApiError, Category, ProductSummary } from '@shop/shared/data-access';
import { applyFilterPatch, CatalogFilters, DEFAULT_CATALOG_FILTERS, RequestStatus } from '@shop/state/contracts';
import { catalogApiActions, catalogPageActions } from './catalog.actions';

export interface CatalogState {
  readonly filters: CatalogFilters;
  readonly products: readonly ProductSummary[];
  readonly totalCount: number;
  readonly totalPages: number;
  readonly status: RequestStatus;
  readonly error: ApiError | null;
  readonly categories: readonly Category[];
  readonly brands: readonly string[];
}

export const initialCatalogState: CatalogState = {
  filters: DEFAULT_CATALOG_FILTERS,
  products: [],
  totalCount: 0,
  totalPages: 0,
  status: 'idle',
  error: null,
  categories: [],
  brands: [],
};

const startLoading = (state: CatalogState, filters: CatalogFilters): CatalogState => ({ ...state, filters, status: 'loading', error: null });

/**
 * Pure reducer: (state, action) => new state. No HTTP, no storage, no Date.now().
 * Convention used here: when the reducer moves the request into 'loading', the products effect fetches.
 */
export const catalogFeature = createFeature({
  name: 'catalog',
  reducer: createReducer(
    initialCatalogState,
    on(catalogPageActions.opened, (state, { initial }) => {
      if (initial && Object.keys(initial).length > 0) {
        return startLoading(state, applyFilterPatch(DEFAULT_CATALOG_FILTERS, initial));
      }
      return state.status === 'idle' ? startLoading(state, state.filters) : state;
    }),
    on(catalogPageActions.filtersChanged, (state, { patch }) => startLoading(state, applyFilterPatch(state.filters, patch))),
    on(catalogPageActions.pageChanged, (state, { page }) => startLoading(state, applyFilterPatch(state.filters, { page }))),
    on(catalogPageActions.filtersReset, (state) => startLoading(state, DEFAULT_CATALOG_FILTERS)),
    on(catalogPageActions.reloadRequested, (state) => startLoading(state, state.filters)),
    on(catalogApiActions.productsLoaded, (state, { result }) => ({
      ...state,
      products: result.items,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      status: 'success' as const,
      error: null,
    })),
    on(catalogApiActions.productsLoadFailed, (state, { error }) => ({ ...state, status: 'error' as const, error })),
    on(catalogApiActions.categoriesLoaded, (state, { categories }) => ({ ...state, categories })),
    on(catalogApiActions.brandsLoaded, (state, { brands }) => ({ ...state, brands })),
  ),
  // createFeature generates selectFilters, selectProducts, ... automatically; extra derived selectors here.
  extraSelectors: ({ selectStatus, selectProducts }) => ({
    selectIsEmpty: createSelector(selectStatus, selectProducts, (status, products) => status === 'success' && products.length === 0),
  }),
});
