import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { ApiError, CartQuote } from '@shop/shared/data-access';
import { CartLine, CartProduct } from '@shop/state/contracts';

export const cartActions = createActionGroup({
  source: 'Cart',
  events: {
    'Item Added': props<{ product: CartProduct; quantity: number }>(),
    'Quantity Updated': props<{ productId: number; quantity: number }>(),
    'Item Removed': props<{ productId: number }>(),
    Cleared: emptyProps(),
    'Quote Refresh Requested': emptyProps(),
  },
});

export const cartSessionActions = createActionGroup({
  source: 'Cart Session',
  events: {
    /** The signed-in identity changed and the cart for the new identity was restored from storage. */
    Restored: props<{ userId: string | null; lines: readonly CartLine[] }>(),
  },
});

export const cartApiActions = createActionGroup({
  source: 'Cart API',
  events: {
    'Quote Loaded': props<{ quote: CartQuote }>(),
    'Quote Failed': props<{ error: ApiError }>(),
  },
});
