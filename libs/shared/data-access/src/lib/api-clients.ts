import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { toHttpParams } from './http-params';
import {
  AdminOrderSummary,
  AdminProduct,
  AuditLogEntry,
  CartLineRequest,
  CartQuote,
  Category,
  CheckoutRequest,
  Dashboard,
  OrderDetail,
  OrderStatus,
  OrderSummary,
  PagedResult,
  ProductDetail,
  ProductQuery,
  ProductSummary,
  Review,
  SaveCategoryInput,
  SaveProductInput,
} from './models';

// Thin, stateless HTTP clients: one method per endpoint, typed request/response, no caching or state.
// Both state-management variants and the admin pages share them.

@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/api/catalog`;

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.base}/categories`);
  }

  getBrands(category: string | null): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/brands`, { params: toHttpParams({ category }) });
  }

  getProducts(query: ProductQuery): Observable<PagedResult<ProductSummary>> {
    return this.http.get<PagedResult<ProductSummary>>(`${this.base}/products`, { params: toHttpParams({ ...query }) });
  }

  getProduct(slug: string): Observable<ProductDetail> {
    return this.http.get<ProductDetail>(`${this.base}/products/${encodeURIComponent(slug)}`);
  }

  getReviews(productId: number, page = 1, pageSize = 5): Observable<PagedResult<Review>> {
    return this.http.get<PagedResult<Review>>(`${this.base}/products/${productId}/reviews`, { params: toHttpParams({ page, pageSize }) });
  }

  createReview(productId: number, rating: number, comment: string): Observable<Review> {
    return this.http.post<Review>(`${this.base}/products/${productId}/reviews`, { rating, comment });
  }
}

@Injectable({ providedIn: 'root' })
export class CartApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  quote(items: readonly CartLineRequest[]): Observable<CartQuote> {
    return this.http.post<CartQuote>(`${this.base}/api/cart/quote`, { items });
  }
}

@Injectable({ providedIn: 'root' })
export class WishlistApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/api/wishlist`;

  get(): Observable<ProductSummary[]> {
    return this.http.get<ProductSummary[]>(this.base);
  }

  add(productId: number): Observable<void> {
    return this.http.put<void>(`${this.base}/${productId}`, null);
  }

  remove(productId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${productId}`);
  }
}

@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/api/orders`;

  /** The same idempotency key must be reused when retrying the same checkout attempt. */
  checkout(request: CheckoutRequest, idempotencyKey: string): Observable<OrderDetail> {
    return this.http.post<OrderDetail>(this.base, request, { headers: { 'Idempotency-Key': idempotencyKey } });
  }

  list(page = 1, pageSize = 10): Observable<PagedResult<OrderSummary>> {
    return this.http.get<PagedResult<OrderSummary>>(this.base, { params: toHttpParams({ page, pageSize }) });
  }

  get(id: string): Observable<OrderDetail> {
    return this.http.get<OrderDetail>(`${this.base}/${id}`);
  }

  cancel(id: string): Observable<OrderDetail> {
    return this.http.post<OrderDetail>(`${this.base}/${id}/cancel`, null);
  }
}

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/api/admin`;

  dashboard(): Observable<Dashboard> {
    return this.http.get<Dashboard>(`${this.base}/dashboard`);
  }

  products(query: { search?: string | null; lowStockOnly?: boolean | null; page?: number; pageSize?: number }): Observable<PagedResult<AdminProduct>> {
    return this.http.get<PagedResult<AdminProduct>>(`${this.base}/products`, { params: toHttpParams({ ...query }) });
  }

  product(id: number): Observable<AdminProduct> {
    return this.http.get<AdminProduct>(`${this.base}/products/${id}`);
  }

  createProduct(product: SaveProductInput, initialStock: number): Observable<AdminProduct> {
    return this.http.post<AdminProduct>(`${this.base}/products`, { product, initialStock });
  }

  updateProduct(id: number, product: SaveProductInput, version: number): Observable<AdminProduct> {
    return this.http.put<AdminProduct>(`${this.base}/products/${id}`, { product, version });
  }

  adjustStock(id: number, delta: number, reason: string): Observable<{ productId: number; stockQuantity: number }> {
    return this.http.post<{ productId: number; stockQuantity: number }>(`${this.base}/products/${id}/stock-adjustments`, { delta, reason });
  }

  categories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.base}/categories`);
  }

  createCategory(input: SaveCategoryInput): Observable<Category> {
    return this.http.post<Category>(`${this.base}/categories`, input);
  }

  updateCategory(id: number, input: SaveCategoryInput): Observable<Category> {
    return this.http.put<Category>(`${this.base}/categories/${id}`, input);
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/categories/${id}`);
  }

  orders(query: { status?: OrderStatus | null; search?: string | null; page?: number; pageSize?: number }): Observable<PagedResult<AdminOrderSummary>> {
    return this.http.get<PagedResult<AdminOrderSummary>>(`${this.base}/orders`, { params: toHttpParams({ ...query }) });
  }

  order(id: string): Observable<OrderDetail> {
    return this.http.get<OrderDetail>(`${this.base}/orders/${id}`);
  }

  changeOrderStatus(id: string, status: OrderStatus): Observable<OrderDetail> {
    return this.http.post<OrderDetail>(`${this.base}/orders/${id}/status`, { status });
  }

  auditLog(page = 1, pageSize = 20): Observable<PagedResult<AuditLogEntry>> {
    return this.http.get<PagedResult<AuditLogEntry>>(`${this.base}/audit-log`, { params: toHttpParams({ page, pageSize }) });
  }
}
