import { AuthResponse, CartQuote, PagedResult, ProductSummary, User } from '@shop/shared/data-access';
import { CartLine } from '../lib/state-contracts';

export function product(id: number, overrides: Partial<ProductSummary> = {}): ProductSummary {
  return {
    id,
    name: `Product ${id}`,
    slug: `product-${id}`,
    brand: 'Acme',
    price: 10 + id,
    imageUrl: null,
    categorySlug: 'audio',
    categoryName: 'Audio',
    availableQuantity: 10,
    averageRating: 4,
    reviewCount: 2,
    ...overrides,
  };
}

export function page<T>(items: T[], totalCount = items.length): PagedResult<T> {
  return { items, page: 1, pageSize: 12, totalCount, totalPages: Math.max(1, Math.ceil(totalCount / 12)) };
}

export const ALICE: User = { id: 'user-alice', email: 'alice@shop.local', fullName: 'Alice', role: 'Customer' };
export const BOB: User = { id: 'user-bob', email: 'bob@shop.local', fullName: 'Bob', role: 'Customer' };

export function authResponse(user: User): AuthResponse {
  return { accessToken: `token-for-${user.id}`, accessTokenExpiresAt: '2030-01-01T00:00:00Z', user };
}

export function quoteFor(lines: readonly Pick<CartLine, 'productId' | 'quantity'>[], unitPrice = 10): CartQuote {
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * unitPrice, 0);
  const shipping = subtotal >= 100 ? 0 : 9.99;
  return {
    lines: lines.map((line) => ({
      productId: line.productId,
      name: `Product ${line.productId}`,
      slug: `product-${line.productId}`,
      imageUrl: null,
      unitPrice,
      quantity: line.quantity,
      lineTotal: line.quantity * unitPrice,
      availableQuantity: 10,
      issue: null,
    })),
    subtotal,
    shipping,
    total: subtotal + shipping,
    freeShippingThreshold: 100,
    canCheckout: true,
  };
}
