import { createEntityAdapter, EntityState } from '@ngrx/entity';
import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import { ApiError, CartQuote } from '@shop/shared/data-access';
import { addCartLine, CartLine, cartItemCount, clampQuantity, estimateSubtotal, RequestStatus } from '@shop/state/contracts';
import { cartActions, cartApiActions, cartSessionActions } from './cart.actions';

/**
 * EntityAdapter normalizes lines into { ids, entities } keyed by productId, giving O(1) updates by id and
 * ready-made immutable helpers (setAll/updateOne/removeOne). Justified here because every cart operation
 * addresses a line by product id.
 */
export const cartAdapter = createEntityAdapter<CartLine>({ selectId: (line) => line.productId });

export interface CartState extends EntityState<CartLine> {
  readonly userId: string | null;
  readonly quote: CartQuote | null;
  readonly quoteStatus: RequestStatus;
  readonly quoteError: ApiError | null;
}

export const initialCartState: CartState = cartAdapter.getInitialState({
  userId: null,
  quote: null,
  quoteStatus: 'idle',
  quoteError: null,
});

/** After any line change: an empty cart has no quote; otherwise a new quote is pending. */
function linesChanged(state: CartState): CartState {
  const empty = state.ids.length === 0;
  return { ...state, quote: empty ? null : state.quote, quoteStatus: empty ? 'idle' : 'loading', quoteError: null };
}

export const cartFeature = createFeature({
  name: 'cart',
  reducer: createReducer(
    initialCartState,
    on(cartActions.itemAdded, (state, { product, quantity }) =>
      linesChanged(cartAdapter.setAll(addCartLine(cartAdapter.getSelectors().selectAll(state), product, quantity), state)),
    ),
    on(cartActions.quantityUpdated, (state, { productId, quantity }) =>
      linesChanged(cartAdapter.updateOne({ id: productId, changes: { quantity: clampQuantity(quantity) } }, state)),
    ),
    on(cartActions.itemRemoved, (state, { productId }) => linesChanged(cartAdapter.removeOne(productId, state))),
    on(cartActions.cleared, (state) => linesChanged(cartAdapter.removeAll(state))),
    on(cartActions.quoteRefreshRequested, (state) => linesChanged(state)),
    on(cartSessionActions.restored, (state, { userId, lines }) => linesChanged(cartAdapter.setAll([...lines], { ...state, userId }))),
    on(cartApiActions.quoteLoaded, (state, { quote }) => ({ ...state, quote, quoteStatus: 'success' as const, quoteError: null })),
    on(cartApiActions.quoteFailed, (state, { error }) => ({ ...state, quoteStatus: 'error' as const, quoteError: error })),
  ),
  extraSelectors: ({ selectCartState, selectQuote, selectQuoteStatus }) => {
    const selectLines = createSelector(selectCartState, cartAdapter.getSelectors().selectAll);
    const selectIsEmpty = createSelector(selectLines, (lines) => lines.length === 0);
    return {
      selectLines,
      selectIsEmpty,
      // Memoized: recomputed only when the lines array changes, like computed() in the Signals variant.
      selectItemCount: createSelector(selectLines, cartItemCount),
      selectEstimatedSubtotal: createSelector(selectLines, estimateSubtotal),
      selectCanCheckout: createSelector(
        selectIsEmpty,
        selectQuoteStatus,
        selectQuote,
        (empty, status, quote) => !empty && status === 'success' && quote?.canCheckout === true,
      ),
    };
  },
});
