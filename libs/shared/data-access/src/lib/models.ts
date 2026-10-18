/**
 * TypeScript mirrors of the API DTOs (services/api/src/Shop.Api/Features/**\/*Contracts.cs).
 * These types are compile-time only: the server is the authority and validates every request.
 */

export interface PagedResult<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly totalPages: number;
}

export interface Category {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly productCount: number;
}

export const PRODUCT_SORTS = ['Newest', 'PriceAsc', 'PriceDesc', 'Name', 'Rating'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export interface ProductQuery {
  readonly search?: string | null;
  readonly category?: string | null;
  readonly brand?: string | null;
  readonly minPrice?: number | null;
  readonly maxPrice?: number | null;
  readonly inStock?: boolean | null;
  readonly sort?: ProductSort;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface ProductSummary {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  readonly brand: string;
  readonly price: number;
  readonly imageUrl: string | null;
  readonly categorySlug: string;
  readonly categoryName: string;
  readonly availableQuantity: number;
  readonly averageRating: number;
  readonly reviewCount: number;
}

export interface ProductDetail extends ProductSummary {
  readonly description: string;
  readonly categoryId: number;
}

export interface Review {
  readonly id: number;
  readonly rating: number;
  readonly comment: string;
  readonly authorName: string;
  readonly createdAt: string;
}

export interface CartLineRequest {
  readonly productId: number;
  readonly quantity: number;
}

export type CartLineIssue = 'Unavailable' | 'InsufficientStock';

export interface CartQuoteLine {
  readonly productId: number;
  readonly name: string;
  readonly slug: string;
  readonly imageUrl: string | null;
  readonly unitPrice: number;
  readonly quantity: number;
  readonly lineTotal: number;
  readonly availableQuantity: number;
  readonly issue: CartLineIssue | null;
}

export interface CartQuote {
  readonly lines: readonly CartQuoteLine[];
  readonly subtotal: number;
  readonly shipping: number;
  readonly total: number;
  readonly freeShippingThreshold: number;
  readonly canCheckout: boolean;
}

export interface ShippingAddress {
  readonly recipient: string;
  readonly line1: string;
  readonly city: string;
  readonly postalCode: string;
  readonly country: string;
}

/** Tokens understood by the backend payment simulator. Never real card data. */
export const PAYMENT_TOKENS = ['tok_visa', 'tok_declined', 'tok_unavailable'] as const;
export type PaymentToken = (typeof PAYMENT_TOKENS)[number];

export interface CheckoutRequest {
  readonly items: readonly CartLineRequest[];
  readonly shippingAddress: ShippingAddress;
  readonly paymentToken: PaymentToken;
}

export const ORDER_STATUSES = ['Paid', 'Shipped', 'Delivered', 'Cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderSummary {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly total: number;
  readonly itemCount: number;
  readonly createdAt: string;
}

export interface OrderItem {
  readonly productId: number;
  readonly productName: string;
  readonly unitPrice: number;
  readonly quantity: number;
  readonly lineTotal: number;
}

export interface OrderDetail {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly subtotal: number;
  readonly shippingCost: number;
  readonly total: number;
  readonly shippingAddress: ShippingAddress;
  readonly paymentReference: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly items: readonly OrderItem[];
  readonly allowedNextStatuses: readonly OrderStatus[];
  readonly customerEmail: string | null;
}

export type UserRole = 'Customer' | 'Admin';

export interface User {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly role: UserRole;
}

export interface AuthResponse {
  readonly accessToken: string;
  readonly accessTokenExpiresAt: string;
  readonly user: User;
}

// ---------- Admin ----------

export interface AdminProduct {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly brand: string;
  readonly price: number;
  readonly stockQuantity: number;
  readonly imageUrl: string | null;
  readonly isActive: boolean;
  readonly categoryId: number;
  readonly categoryName: string;
  readonly version: number;
  readonly updatedAt: string;
}

export interface SaveProductInput {
  readonly name: string;
  readonly slug: string | null;
  readonly description: string;
  readonly brand: string;
  readonly price: number;
  readonly categoryId: number;
  readonly imageUrl: string | null;
  readonly isActive: boolean;
}

export interface SaveCategoryInput {
  readonly name: string;
  readonly slug: string | null;
  readonly description: string;
}

export interface AdminOrderSummary {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly customerEmail: string;
  readonly total: number;
  readonly itemCount: number;
  readonly createdAt: string;
}

export interface Dashboard {
  readonly revenue: number;
  readonly revenueLast30Days: number;
  readonly orderCount: number;
  readonly customerCount: number;
  readonly activeProductCount: number;
  /** The API includes every status, with 0 when there are no orders in it. */
  readonly ordersByStatus: Readonly<Record<OrderStatus, number>>;
  readonly lowStockProducts: readonly { id: number; name: string; stockQuantity: number }[];
  readonly recentOrders: readonly AdminOrderSummary[];
}

export interface AuditLogEntry {
  readonly id: string;
  readonly actorEmail: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly details: string;
  readonly createdAt: string;
}
