import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button, EmptyState, ErrorState, Spinner } from '@shop/shared/ui';
import { WishlistStore } from '@shop/state/contracts';
import { ProductActions } from '../../shared/product-actions';
import { ProductCard } from '../../shared/product-card';

@Component({
  selector: 'shop-wishlist-page',
  imports: [RouterLink, Button, EmptyState, ErrorState, Spinner, ProductCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Your wishlist</h1>
    @if (wishlist.status() === 'error' && wishlist.count() === 0) {
      <shop-error-state [message]="wishlist.error()?.message ?? ''" (retry)="wishlist.load()" />
    } @else if (wishlist.status() === 'loading' && wishlist.count() === 0) {
      <shop-spinner label="Loading wishlist" />
    } @else if (wishlist.count() === 0) {
      <shop-empty-state title="Your wishlist is empty" message="Tap the heart on any product to save it for later.">
        <a shopButton routerLink="/products">Browse the catalog</a>
      </shop-empty-state>
    } @else {
      @if (wishlist.error(); as error) {
        <p class="shop-alert" role="alert">{{ error.message }}</p>
      }
      <div class="grid">
        @for (product of wishlist.items(); track product.id) {
          <shop-product-card
            [product]="product"
            [inWishlist]="true"
            (addToCart)="actions.addToCart($event)"
            (toggleWishlist)="actions.toggleWishlist($event)"
          />
        }
      </div>
    }
  `,
  styles: `
    .grid { display: grid; gap: var(--shop-space-4); grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
  `,
})
export class WishlistPage {
  protected readonly wishlist = inject(WishlistStore);
  protected readonly actions = inject(ProductActions);
}
