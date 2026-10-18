import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductSummary } from '@shop/shared/data-access';
import { Button, ProductImage, Rating } from '@shop/shared/ui';

/** Presentational: inputs in, events out. Pages decide what "add" and "toggle wishlist" mean. */
@Component({
  selector: 'shop-product-card',
  imports: [CurrencyPipe, RouterLink, Button, ProductImage, Rating],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card shop-card" [attr.aria-labelledby]="'product-' + product().id" data-testid="product-card">
      <a [routerLink]="['/products', product().slug]" tabindex="-1" aria-hidden="true">
        <shop-product-image [src]="product().imageUrl" [alt]="product().name" [seed]="product().id" />
      </a>
      <div class="card__body">
        <p class="card__brand shop-muted">{{ product().brand }}</p>
        <h3 class="card__title" [id]="'product-' + product().id">
          <a [routerLink]="['/products', product().slug]">{{ product().name }}</a>
        </h3>
        <shop-rating [value]="product().averageRating" [count]="product().reviewCount" />
        <p class="card__price" data-testid="product-price">{{ product().price | currency: 'USD' }}</p>
        @if (product().availableQuantity === 0) {
          <p class="card__stock card__stock--out">Out of stock</p>
        } @else if (product().availableQuantity <= 5) {
          <p class="card__stock">Only {{ product().availableQuantity }} left</p>
        }
      </div>
      <div class="card__actions">
        <button shopButton size="sm" type="button" [disabled]="product().availableQuantity === 0" (click)="addToCart.emit(product())">
          Add to cart
        </button>
        <button
          type="button"
          class="shop-icon-button"
          [attr.aria-pressed]="inWishlist()"
          [attr.aria-label]="(inWishlist() ? 'Remove ' : 'Save ') + product().name + (inWishlist() ? ' from wishlist' : ' to wishlist')"
          (click)="toggleWishlist.emit(product())"
          data-testid="wishlist-toggle"
        >
          <span aria-hidden="true">{{ inWishlist() ? '♥' : '♡' }}</span>
        </button>
      </div>
    </article>
  `,
  styles: `
    .card { display: flex; flex-direction: column; gap: var(--shop-space-3); height: 100%; }
    .card__body { flex: 1; }
    .card__brand { margin: 0; font-size: var(--shop-font-size-sm); }
    .card__title { font-size: var(--shop-font-size-md); margin: var(--shop-space-1) 0; }
    .card__title a { color: var(--shop-color-text); text-decoration: none; }
    .card__title a:hover { text-decoration: underline; }
    .card__price { font-weight: 700; font-size: var(--shop-font-size-lg); margin: var(--shop-space-2) 0 0; }
    .card__stock { margin: 0; font-size: var(--shop-font-size-sm); color: var(--shop-color-warning); }
    .card__stock--out { color: var(--shop-color-danger); }
    .card__actions { display: flex; justify-content: space-between; align-items: center; }
  `,
})
export class ProductCard {
  readonly product = input.required<ProductSummary>();
  readonly inWishlist = input(false);
  readonly addToCart = output<ProductSummary>();
  readonly toggleWishlist = output<ProductSummary>();
}
