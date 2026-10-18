import { product } from '../testing/test-data';
import { addCartLine, applyFilterPatch, clampQuantity, DEFAULT_CATALOG_FILTERS, estimateSubtotal } from './state-contracts';

describe('applyFilterPatch', () => {
  it('returns to page 1 when any filter other than the page changes', () => {
    const onPage5 = { ...DEFAULT_CATALOG_FILTERS, page: 5 };
    expect(applyFilterPatch(onPage5, { brand: 'Acme' })).toMatchObject({ brand: 'Acme', page: 1 });
  });

  it('keeps an explicit page change', () => {
    expect(applyFilterPatch(DEFAULT_CATALOG_FILTERS, { page: 3 }).page).toBe(3);
  });

  it('does not mutate the current filters', () => {
    const current = { ...DEFAULT_CATALOG_FILTERS };
    applyFilterPatch(current, { search: 'x' });
    expect(current).toEqual(DEFAULT_CATALOG_FILTERS);
  });
});

describe('cart helpers', () => {
  it.each([
    [0, 1],
    [-3, 1],
    [2.7, 2],
    [21, 20],
  ])('clampQuantity(%d) = %d', (input, expected) => {
    expect(clampQuantity(input)).toBe(expected);
  });

  it('adds to an existing line instead of duplicating it', () => {
    const once = addCartLine([], product(1), 2);
    const twice = addCartLine(once, product(1), 3);
    expect(twice).toHaveLength(1);
    expect(twice[0].quantity).toBe(5);
    expect(once[0].quantity).toBe(2); // immutable
  });

  it('estimates in integer cents to avoid floating-point drift', () => {
    const lines = [addCartLine([], product(1, { price: 0.1 }), 3)[0], addCartLine([], product(2, { price: 19.99 }), 3)[0]];
    expect(estimateSubtotal(lines)).toBe(60.27);
  });
});
