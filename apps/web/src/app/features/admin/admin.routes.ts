import { Route } from '@angular/router';
import { AdminLayout } from './admin-layout';

/**
 * Lazy admin area. The parent route's canMatch(adminGuard) means a non-admin never even downloads this
 * chunk - but the real protection is the API's AdminOnly policy on every /api/admin endpoint.
 */
export const adminRoutes: Route[] = [
  {
    path: '',
    component: AdminLayout,
    children: [
      { path: '', title: 'Dashboard · Admin', loadComponent: () => import('./dashboard-page').then((m) => m.DashboardPage) },
      { path: 'products', title: 'Products · Admin', loadComponent: () => import('./products-page').then((m) => m.AdminProductsPage) },
      { path: 'products/new', title: 'New product · Admin', loadComponent: () => import('./product-edit-page').then((m) => m.ProductEditPage) },
      { path: 'products/:id', title: 'Edit product · Admin', loadComponent: () => import('./product-edit-page').then((m) => m.ProductEditPage) },
      { path: 'categories', title: 'Categories · Admin', loadComponent: () => import('./categories-page').then((m) => m.CategoriesPage) },
      { path: 'orders', title: 'Orders · Admin', loadComponent: () => import('./orders-page').then((m) => m.AdminOrdersPage) },
      { path: 'orders/:id', title: 'Order · Admin', loadComponent: () => import('./order-page').then((m) => m.AdminOrderPage) },
      { path: 'audit-log', title: 'Audit log · Admin', loadComponent: () => import('./audit-log-page').then((m) => m.AuditLogPage) },
    ],
  },
];
