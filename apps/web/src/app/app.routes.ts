import { Route } from '@angular/router';
import { adminGuard, authGuard, guestOnlyGuard } from '@shop/shared/data-access';

// Every page is lazy-loaded (loadComponent / loadChildren), so the initial bundle only contains the
// shell. The admin area is a separate chunk that non-admins never download (canMatch).
export const appRoutes: Route[] = [
  { path: '', title: 'Home · NorthwindShop', loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage) },
  { path: 'products', title: 'Catalog · NorthwindShop', loadComponent: () => import('./features/catalog/catalog-page').then((m) => m.CatalogPage) },
  { path: 'products/:slug', title: 'Product · NorthwindShop', loadComponent: () => import('./features/product/product-page').then((m) => m.ProductPage) },
  { path: 'cart', title: 'Cart · NorthwindShop', loadComponent: () => import('./features/cart/cart-page').then((m) => m.CartPage) },
  {
    path: 'checkout',
    title: 'Checkout · NorthwindShop',
    canActivate: [authGuard],
    loadComponent: () => import('./features/checkout/checkout-page').then((m) => m.CheckoutPage),
  },
  {
    path: 'orders',
    title: 'Orders · NorthwindShop',
    canActivate: [authGuard],
    loadComponent: () => import('./features/orders/order-history-page').then((m) => m.OrderHistoryPage),
  },
  {
    path: 'orders/:id',
    title: 'Order · NorthwindShop',
    canActivate: [authGuard],
    loadComponent: () => import('./features/orders/order-detail-page').then((m) => m.OrderDetailPage),
  },
  {
    path: 'wishlist',
    title: 'Wishlist · NorthwindShop',
    canActivate: [authGuard],
    loadComponent: () => import('./features/wishlist/wishlist-page').then((m) => m.WishlistPage),
  },
  {
    path: 'account',
    title: 'Account · NorthwindShop',
    canActivate: [authGuard],
    loadComponent: () => import('./features/account/profile-page').then((m) => m.ProfilePage),
  },
  {
    path: 'login',
    title: 'Sign in · NorthwindShop',
    canActivate: [guestOnlyGuard],
    loadComponent: () => import('./features/account/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    title: 'Create account · NorthwindShop',
    canActivate: [guestOnlyGuard],
    loadComponent: () => import('./features/account/register-page').then((m) => m.RegisterPage),
  },
  { path: 'admin', canMatch: [adminGuard], loadChildren: () => import('./features/admin/admin.routes').then((m) => m.adminRoutes) },
  { path: '**', title: 'Not found · NorthwindShop', loadComponent: () => import('./features/not-found-page').then((m) => m.NotFoundPage) },
];
