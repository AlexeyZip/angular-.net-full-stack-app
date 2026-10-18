import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthSession, ProductSummary } from '@shop/shared/data-access';
import { ToastService } from '@shop/shared/ui';
import { CartProduct, CartStore, WishlistStore } from '@shop/state/contracts';

/** The "add to cart" / "toggle wishlist" behaviour shared by the home, catalog, product and wishlist pages. */
@Injectable({ providedIn: 'root' })
export class ProductActions {
  private readonly cart = inject(CartStore);
  private readonly wishlist = inject(WishlistStore);
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  addToCart(product: CartProduct, quantity = 1): void {
    this.cart.add(product, quantity);
    this.toasts.success(`${product.name} added to cart.`);
  }

  toggleWishlist(product: ProductSummary): void {
    if (!this.session.isAuthenticated()) {
      this.toasts.info('Sign in to save products to your wishlist.');
      void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    this.wishlist.toggle(product);
  }
}
