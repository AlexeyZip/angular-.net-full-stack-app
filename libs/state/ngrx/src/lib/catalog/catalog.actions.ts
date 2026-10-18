import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { ApiError, Category, PagedResult, ProductSummary } from '@shop/shared/data-access';
import { CatalogFilters } from '@shop/state/contracts';

// Actions describe events ("what happened"), named by source, not commands ("do X").

export const catalogPageActions = createActionGroup({
  source: 'Catalog Page',
  events: {
    Opened: props<{ initial: Partial<CatalogFilters> | null }>(),
    'Filters Changed': props<{ patch: Partial<CatalogFilters> }>(),
    'Page Changed': props<{ page: number }>(),
    'Filters Reset': emptyProps(),
    'Reload Requested': emptyProps(),
  },
});

export const catalogApiActions = createActionGroup({
  source: 'Catalog API',
  events: {
    'Products Loaded': props<{ result: PagedResult<ProductSummary> }>(),
    'Products Load Failed': props<{ error: ApiError }>(),
    'Categories Loaded': props<{ categories: readonly Category[] }>(),
    'Brands Loaded': props<{ brands: readonly string[] }>(),
  },
});
