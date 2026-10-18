import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { ApiError, ProductSummary } from '@shop/shared/data-access';

export const wishlistActions = createActionGroup({
  source: 'Wishlist',
  events: {
    'Load Requested': emptyProps(),
    'Item Added': props<{ product: ProductSummary }>(),
    /** Carries the removed product so the reducer can roll back if the API call fails. */
    'Item Removed': props<{ product: ProductSummary }>(),
  },
});

export const wishlistSessionActions = createActionGroup({
  source: 'Wishlist Session',
  events: {
    Reset: emptyProps(),
  },
});

export const wishlistApiActions = createActionGroup({
  source: 'Wishlist API',
  events: {
    Loaded: props<{ items: readonly ProductSummary[] }>(),
    'Load Failed': props<{ error: ApiError }>(),
    'Add Confirmed': props<{ productId: number }>(),
    'Add Failed': props<{ productId: number; error: ApiError }>(),
    'Remove Confirmed': props<{ productId: number }>(),
    'Remove Failed': props<{ product: ProductSummary; error: ApiError }>(),
  },
});
