import { createEntityAdapter, EntityState } from '@ngrx/entity';
import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import { ApiError, ProductSummary } from '@shop/shared/data-access';
import { RequestStatus } from '@shop/state/contracts';
import { wishlistActions, wishlistApiActions, wishlistSessionActions } from './wishlist.actions';

export const wishlistAdapter = createEntityAdapter<ProductSummary>();

export interface WishlistState extends EntityState<ProductSummary> {
  readonly status: RequestStatus;
  readonly error: ApiError | null;
}

export const initialWishlistState: WishlistState = wishlistAdapter.getInitialState({ status: 'idle', error: null });

const { selectAll } = wishlistAdapter.getSelectors();

function prepend(product: ProductSummary, state: WishlistState): WishlistState {
  return state.entities[product.id] ? state : wishlistAdapter.setAll([product, ...selectAll(state)], state);
}

export const wishlistFeature = createFeature({
  name: 'wishlist',
  reducer: createReducer(
    initialWishlistState,
    on(wishlistSessionActions.reset, () => initialWishlistState),
    on(wishlistActions.loadRequested, (state) => ({ ...state, status: 'loading' as const, error: null })),
    on(wishlistApiActions.loaded, (state, { items }) => wishlistAdapter.setAll([...items], { ...state, status: 'success' as const })),
    on(wishlistApiActions.loadFailed, (state, { error }) => ({ ...state, status: 'error' as const, error })),
    // Optimistic update + compensating rollback, both expressed as pure state transitions.
    // Newest first, matching the API's ordering and the Signals variant.
    on(wishlistActions.itemAdded, (state, { product }) => prepend(product, { ...state, error: null })),
    on(wishlistApiActions.addFailed, (state, { productId, error }) => wishlistAdapter.removeOne(productId, { ...state, error })),
    on(wishlistActions.itemRemoved, (state, { product }) => wishlistAdapter.removeOne(product.id, { ...state, error: null })),
    on(wishlistApiActions.removeFailed, (state, { product, error }) => prepend(product, { ...state, error })),
  ),
  extraSelectors: ({ selectWishlistState }) => {
    const { selectTotal } = wishlistAdapter.getSelectors();
    return {
      selectItems: createSelector(selectWishlistState, selectAll),
      selectCount: createSelector(selectWishlistState, selectTotal),
    };
  },
});
