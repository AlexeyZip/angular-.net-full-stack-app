import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'shop-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin">
      <nav class="admin__nav shop-card" aria-label="Administration">
        <p class="admin__title">Admin</p>
        <a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Dashboard</a>
        <a routerLink="/admin/products" routerLinkActive="active">Products</a>
        <a routerLink="/admin/categories" routerLinkActive="active">Categories</a>
        <a routerLink="/admin/orders" routerLinkActive="active">Orders</a>
        <a routerLink="/admin/audit-log" routerLinkActive="active">Audit log</a>
      </nav>
      <div class="admin__content"><router-outlet /></div>
    </div>
  `,
  styles: `
    .admin { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: var(--shop-space-6); align-items: start; }
    .admin__nav { display: flex; flex-direction: column; gap: var(--shop-space-2); position: sticky; top: 80px; }
    .admin__title { font-weight: 800; margin: 0 0 var(--shop-space-2); }
    .admin__nav a { color: var(--shop-color-text); text-decoration: none; padding: var(--shop-space-1) var(--shop-space-2); border-radius: var(--shop-radius-sm); }
    .admin__nav a.active { background: var(--shop-color-surface-muted); color: var(--shop-color-primary); font-weight: 600; }
    @media (max-width: 768px) {
      .admin { grid-template-columns: 1fr; }
      .admin__nav { flex-direction: row; flex-wrap: wrap; position: static; }
    }
  `,
})
export class AdminLayout {}
