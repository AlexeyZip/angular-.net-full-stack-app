import { product, quoteFor } from '@shop/state/contracts/testing';
import { cartActions, cartApiActions, cartSessionActions } from './cart.actions';
import { cartFeature, initialCartState } from './cart.feature';

// Reducers are pure functions: test them with plain values - no TestBed, no store, no HTTP.
const reduce = (...actions: Parameters<typeof cartFeature.reducer>[1][]) => actions.reduce(cartFeature.reducer, initialCartState);

describe('cart reducer', () => {
  it('merges repeated adds of the same product into one clamped line', () => {
    const state = reduce(cartActions.itemAdded({ product: product(1), quantity: 15 }), cartActions.itemAdded({ product: product(1), quantity: 15 }));

    expect(state.ids).toEqual([1]);
    expect(state.entities[1]?.quantity).toBe(20);
  });

  it('marks a quote as pending after every line change and drops it for an empty cart', () => {
    const quoted = reduce(cartActions.itemAdded({ product: product(1), quantity: 1 }), cartApiActions.quoteLoaded({ quote: quoteFor([{ productId: 1, quantity: 1 }]) }));
    expect(quoted.quoteStatus).toBe('success');

    const changed = cartFeature.reducer(quoted, cartActions.quantityUpdated({ productId: 1, quantity: 2 }));
    expect(changed.quoteStatus).toBe('loading');
    expect(changed.quote).not.toBeNull(); // kept on screen while the new quote loads

    const emptied = cartFeature.reducer(changed, cartActions.cleared());
    expect(emptied.quote).toBeNull();
    expect(emptied.quoteStatus).toBe('idle');
  });

  it('replaces the cart wholesale when the identity changes', () => {
    const state = reduce(
      cartActions.itemAdded({ product: product(1), quantity: 1 }),
      cartSessionActions.restored({ userId: 'u1', lines: [{ productId: 9, quantity: 2, name: 'P9', slug: 'p9', imageUrl: null, unitPriceSnapshot: 5 }] }),
    );

    expect(state.userId).toBe('u1');
    expect(state.ids).toEqual([9]);
  });

  it('never mutates the previous state', () => {
    const before = reduce(cartActions.itemAdded({ product: product(1), quantity: 1 }));
    const snapshot = structuredClone(before);
    cartFeature.reducer(before, cartActions.itemRemoved({ productId: 1 }));
    expect(before).toEqual(snapshot);
  });
});

describe('cart selectors', () => {
  const root = (cart: typeof initialCartState) => ({ cart });

  it('allow checkout only with a successful quote that the server accepts', () => {
    const withLine = reduce(cartActions.itemAdded({ product: product(1), quantity: 1 }));
    expect(cartFeature.selectCanCheckout(root(withLine))).toBe(false);

    const accepted = cartFeature.reducer(withLine, cartApiActions.quoteLoaded({ quote: quoteFor([{ productId: 1, quantity: 1 }]) }));
    expect(cartFeature.selectCanCheckout(root(accepted))).toBe(true);

    const rejected = cartFeature.reducer(withLine, cartApiActions.quoteLoaded({ quote: { ...quoteFor([]), canCheckout: false } }));
    expect(cartFeature.selectCanCheckout(root(rejected))).toBe(false);
  });

  it('are memoized: unrelated state changes return the same derived array', () => {
    const state = reduce(cartActions.itemAdded({ product: product(1), quantity: 1 }));
    const first = cartFeature.selectLines(root(state));
    const afterQuote = cartFeature.reducer(state, cartApiActions.quoteFailed({ error: { status: 500, code: 'x', message: 'x', fieldErrors: {}, details: null } }));

    expect(cartFeature.selectLines(root(afterQuote))).toBe(first);
  });
});
