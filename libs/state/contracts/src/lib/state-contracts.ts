import { InjectionToken, Signal } from '@angular/core';
import { ApiError, CartQuote, Category, ProductSort, ProductSummary } from '@shop/shared/data-access';

/**
 * The state contracts shared by both implementations.
 *
 * Components inject these abstract classes and never know whether Angular Signals services or
 * NgRx Store sit behind them. Abstract classes (not interfaces) are used because TypeScript interfaces
 * vanish at runtime and therefore cannot be DI tokens.
 *
 * Reads are Signals in both variants (NgRx exposes them via store.selectSignal), commands are methods.
 */

export type RequestStatus = 'idle' | 'loading' | 'success' | 'error';

export type StateVariant = 'signals' | 'ngrx';

/** Which implementation is active. Shown in the footer and asserted by end-to-end tests. */
export const STATE_VARIANT = new InjectionToken<StateVariant>('STATE_VARIANT');

/** Debounce for server cart quotes, so pressing "+" five times sends one request. Tests set it to 0. */
export const CART_QUOTE_DEBOUNCE_MS = new InjectionToken<number>('CART_QUOTE_DEBOUNCE_MS', { providedIn: 'root', factory: () => 250 });

export interface CatalogFilters {
  readonly search: string;
  readonly category: string | null;
  readonly brand: string | null;
  readonly minPrice: number | null;
  readonly maxPrice: number | null;
  readonly inStock: boolean;
  readonly sort: ProductSort;
  readonly page: number;
  readonly pageSize: number;
}

export const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  search: '',
  category: null,
  brand: null,
  minPrice: null,
  maxPrice: null,
  inStock: false,
  sort: 'Newest',
  page: 1,
  pageSize: 12,
};

/**
 * Applies a filter change. Any change other than the page itself resets to page 1, otherwise a user
 * on page 5 who narrows the filter could land on an empty page. Shared so both variants behave the same.
 */
export function applyFilterPatch(current: CatalogFilters, patch: Partial<CatalogFilters>): CatalogFilters {
  const next = { ...current, ...patch };
  return 'page' in patch ? next : { ...next, page: 1 };
}

export abstract class CatalogStore {
  abstract readonly filters: Signal<CatalogFilters>;
  abstract readonly products: Signal<readonly ProductSummary[]>;
  abstract readonly totalCount: Signal<number>;
  abstract readonly totalPages: Signal<number>;
  abstract readonly status: Signal<RequestStatus>;
  abstract readonly error: Signal<ApiError | null>;
  /** Derived: the last request succeeded and returned nothing. */
  abstract readonly isEmpty: Signal<boolean>;
  abstract readonly categories: Signal<readonly Category[]>;
  abstract readonly brands: Signal<readonly string[]>;

  /** Loads reference data and the first page if nothing is loaded yet. Safe to call repeatedly. */
  abstract open(initial?: Partial<CatalogFilters>): void;
  abstract updateFilters(patch: Partial<CatalogFilters>): void;
  abstract setPage(page: number): void;
  abstract resetFilters(): void;
  abstract reload(): void;
}

/** What the cart stores locally: identity, quantity and a display snapshot (never authoritative). */
export interface CartLine {
  readonly productId: number;
  readonly quantity: number;
  readonly name: string;
  readonly slug: string;
  readonly imageUrl: string | null;
  /** Price at the time of adding; used only for an instant estimate until the server quote arrives. */
  readonly unitPriceSnapshot: number;
}

export type CartProduct = Pick<ProductSummary, 'id' | 'name' | 'slug' | 'imageUrl' | 'price'>;

export const MAX_QUANTITY_PER_LINE = 20;

export abstract class CartStore {
  abstract readonly lines: Signal<readonly CartLine[]>;
  abstract readonly itemCount: Signal<number>;
  abstract readonly isEmpty: Signal<boolean>;
  /** Client-side estimate from snapshots. Displayed only while the server quote is loading. */
  abstract readonly estimatedSubtotal: Signal<number>;
  /** Server-calculated pricing: the only totals shown as final. */
  abstract readonly quote: Signal<CartQuote | null>;
  abstract readonly quoteStatus: Signal<RequestStatus>;
  abstract readonly quoteError: Signal<ApiError | null>;
  abstract readonly canCheckout: Signal<boolean>;

  abstract add(product: CartProduct, quantity?: number): void;
  abstract updateQuantity(productId: number, quantity: number): void;
  abstract remove(productId: number): void;
  abstract clear(): void;
  abstract refreshQuote(): void;
}

export abstract class WishlistStore {
  abstract readonly items: Signal<readonly ProductSummary[]>;
  abstract readonly count: Signal<number>;
  abstract readonly status: Signal<RequestStatus>;
  abstract readonly error: Signal<ApiError | null>;

  abstract has(productId: number): boolean;
  abstract load(): void;
  /** Optimistic: the UI updates immediately and rolls back if the API call fails. */
  abstract add(product: ProductSummary): void;
  abstract remove(productId: number): void;
  abstract toggle(product: ProductSummary): void;
}

// ---------- Pure helpers shared by both implementations ----------

export function clampQuantity(quantity: number): number {
  return Math.min(MAX_QUANTITY_PER_LINE, Math.max(1, Math.trunc(quantity)));
}

export function addCartLine(lines: readonly CartLine[], product: CartProduct, quantity: number): CartLine[] {
  const existing = lines.find((line) => line.productId === product.id);
  if (existing) {
    return lines.map((line) => (line.productId === product.id ? { ...line, quantity: clampQuantity(line.quantity + quantity) } : line));
  }

  return [
    ...lines,
    {
      productId: product.id,
      quantity: clampQuantity(quantity),
      name: product.name,
      slug: product.slug,
      imageUrl: product.imageUrl,
      unitPriceSnapshot: product.price,
    },
  ];
}

export function cartItemCount(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** Integer cents avoid floating-point drift (0.1 + 0.2) in the client-side estimate. */
export function estimateSubtotal(lines: readonly CartLine[]): number {
  return lines.reduce((cents, line) => cents + Math.round(line.unitPriceSnapshot * 100) * line.quantity, 0) / 100;
}
