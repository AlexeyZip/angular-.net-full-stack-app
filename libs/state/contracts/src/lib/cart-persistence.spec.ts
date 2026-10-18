import { CartPersistence, cartForIdentityChange, mergeCarts } from './cart-persistence';
import { CartLine } from './state-contracts';

const line = (productId: number, quantity: number): CartLine => ({
  productId,
  quantity,
  name: `P${productId}`,
  slug: `p${productId}`,
  imageUrl: null,
  unitPriceSnapshot: 10,
});

describe('CartPersistence', () => {
  const persistence = new CartPersistence();
  beforeEach(() => localStorage.clear());

  it('round-trips a cart per owner', () => {
    persistence.write('u1', [line(1, 2)]);
    expect(persistence.read('u1')).toEqual([line(1, 2)]);
    expect(persistence.read('u2')).toEqual([]);
    expect(persistence.read(null)).toEqual([]);
  });

  it('removes the key instead of storing an empty cart', () => {
    persistence.write('u1', [line(1, 1)]);
    persistence.write('u1', []);
    expect(localStorage.getItem('shop.cart.v1:u1')).toBeNull();
  });

  it.each([
    ['invalid JSON', '{not json'],
    ['a wrong schema version', JSON.stringify({ version: 2, owner: 'u1', lines: [] })],
    ['a cart copied from another user', JSON.stringify({ version: 1, owner: 'someone-else', lines: [line(1, 1)] })],
    ['a malformed line', JSON.stringify({ version: 1, owner: 'u1', lines: [{ productId: '1', quantity: 1 }] })],
  ])('treats %s as an empty cart', (_case, raw) => {
    localStorage.setItem('shop.cart.v1:u1', raw);
    expect(persistence.read('u1')).toEqual([]);
  });

  it('clamps quantities edited in storage to the allowed range', () => {
    localStorage.setItem('shop.cart.v1:u1', JSON.stringify({ version: 1, owner: 'u1', lines: [line(1, 999), line(2, -4)] }));
    expect(persistence.read('u1').map((l) => l.quantity)).toEqual([20, 1]);
  });
});

describe('cartForIdentityChange', () => {
  const persistence = new CartPersistence();
  beforeEach(() => localStorage.clear());

  it('merges the guest cart into the saved user cart on sign-in and removes the guest copy', () => {
    persistence.write('u1', [line(1, 2)]);
    persistence.write(null, [line(1, 1), line(2, 1)]);

    const result = cartForIdentityChange(persistence, null, 'u1');

    expect(result.map((l) => [l.productId, l.quantity])).toEqual([
      [1, 3],
      [2, 1],
    ]);
    expect(persistence.read(null)).toEqual([]);
    expect(persistence.read('u1')).toEqual(result);
  });

  it('deletes the previous user cart on sign-out (shared-device privacy)', () => {
    persistence.write('u1', [line(1, 2)]);

    const result = cartForIdentityChange(persistence, 'u1', null);

    expect(result).toEqual([]);
    expect(persistence.read('u1')).toEqual([]);
  });
});

describe('mergeCarts', () => {
  it('caps merged quantities at the per-line maximum', () => {
    expect(mergeCarts([line(1, 15)], [line(1, 15)])[0].quantity).toBe(20);
  });
});
