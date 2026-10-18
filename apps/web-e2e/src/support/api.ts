import { APIRequestContext, expect, request } from '@playwright/test';
import { randomUUID } from 'node:crypto';

/**
 * Direct API helpers for arranging test data. Tests create their own users and products with unique
 * names, so they never depend on seed contents or on each other and can run in parallel.
 */
export const API_URL = process.env['E2E_API_URL'] ?? 'http://localhost:5080';

/** Seeded only in the Development environment (see DevelopmentSeeder). */
export const ADMIN = { email: 'admin@shop.local', password: 'DevOnly-Admin-2026' };

export interface Customer {
  readonly email: string;
  readonly password: string;
  readonly fullName: string;
}

export interface CreatedProduct {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  readonly price: number;
}

export const unique = (prefix: string): string => `${prefix} ${randomUUID().slice(0, 8)}`;

export function newCustomer(): Customer {
  const id = randomUUID().slice(0, 8);
  return { email: `e2e-${id}@test.local`, password: 'E2e-Password-123', fullName: `E2E Customer ${id}` };
}

export interface PlacedOrder {
  readonly id: string;
  readonly orderNumber: string;
}

/** Registers a throw-away customer through the API and places a paid order for one product. */
export async function placeOrderAsNewCustomer(productId: number, quantity = 1): Promise<PlacedOrder> {
  const customer = newCustomer();
  const context = await request.newContext({ baseURL: API_URL });
  try {
    const registered = await context.post('/api/auth/register', { data: customer });
    expect(registered.status(), await registered.text()).toBe(201);
    const { accessToken } = (await registered.json()) as { accessToken: string };

    const response = await context.post('/api/orders', {
      headers: { Authorization: `Bearer ${accessToken}`, 'Idempotency-Key': randomUUID() },
      data: {
        items: [{ productId, quantity }],
        shippingAddress: { recipient: customer.fullName, line1: '1 Test Street', city: 'Testville', postalCode: '12345', country: 'US' },
        paymentToken: 'tok_visa',
      },
    });
    expect(response.status(), await response.text()).toBe(201);
    return (await response.json()) as PlacedOrder;
  } finally {
    await context.dispose();
  }
}

export class AdminApi {
  private constructor(private readonly context: APIRequestContext) {}

  static async signIn(): Promise<AdminApi> {
    const anonymous = await request.newContext({ baseURL: API_URL });
    const response = await anonymous.post('/api/auth/login', { data: ADMIN });
    expect(response.ok(), `admin login failed: ${response.status()}`).toBe(true);
    const { accessToken } = (await response.json()) as { accessToken: string };
    await anonymous.dispose();

    return new AdminApi(await request.newContext({ baseURL: API_URL, extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` } }));
  }

  async createProduct(options: { stock: number; price?: number; name?: string }): Promise<CreatedProduct> {
    const categories = (await (await this.context.get('/api/admin/categories')).json()) as { id: number }[];
    const name = options.name ?? unique('E2E Product');
    const response = await this.context.post('/api/admin/products', {
      data: {
        product: {
          name,
          slug: null,
          description: 'Created by an end-to-end test.',
          brand: 'E2E Brand',
          price: options.price ?? 25,
          categoryId: categories[0].id,
          imageUrl: null,
          isActive: true,
        },
        initialStock: options.stock,
      },
    });
    expect(response.status(), await response.text()).toBe(201);
    return (await response.json()) as CreatedProduct;
  }

  async adjustStock(productId: number, delta: number): Promise<void> {
    const response = await this.context.post(`/api/admin/products/${productId}/stock-adjustments`, { data: { delta, reason: 'E2E adjustment' } });
    expect(response.ok(), await response.text()).toBe(true);
  }

  async dispose(): Promise<void> {
    await this.context.dispose();
  }
}
