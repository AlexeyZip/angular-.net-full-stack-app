import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CatalogApi, LOADING, loadable } from '@shop/shared/data-access';
import { Button, Spinner } from '@shop/shared/ui';
import { WishlistStore } from '@shop/state/contracts';
import { ProductActions } from '../../shared/product-actions';
import { ProductCard } from '../../shared/product-card';

@Component({
  selector: 'shop-home-page',
  imports: [RouterLink, Button, Spinner, ProductCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero">
      <h1>Everything you need, priced by the server.</h1>
      <p class="shop-muted">A reference storefront: browse the catalog, fill your cart and check out with the payment simulator.</p>
      <a shopButton routerLink="/products">Browse the catalog</a>
    </section>

    <section aria-labelledby="categories-heading">
      <h2 id="categories-heading">Shop by category</h2>
      @if (categories(); as state) {
        @switch (state.status) {
          @case ('loading') {
            <shop-spinner />
          }
          @case ('error') {
            <p class="shop-alert">{{ state.error.message }}</p>
          }
          @case ('success') {
            <ul class="categories">
              @for (category of state.value; track category.id) {
                <li>
                  <a class="shop-card category" [routerLink]="['/products']" [queryParams]="{ category: category.slug }">
                    <strong>{{ category.name }}</strong>
                    <span class="shop-muted">{{ category.productCount }} products</span>
                  </a>
                </li>
              }
            </ul>
          }
        }
      }
    </section>

    <section aria-labelledby="top-rated-heading">
      <h2 id="top-rated-heading">Top rated</h2>
      @if (topRated(); as state) {
        @if (state.status === 'success') {
          <div class="grid">
            @for (product of state.value.items; track product.id) {
              <shop-product-card
                [product]="product"
                [inWishlist]="wishlist.has(product.id)"
                (addToCart)="actions.addToCart($event)"
                (toggleWishlist)="actions.toggleWishlist($event)"
              />
            }
          </div>
        } @else if (state.status === 'loading') {
          <shop-spinner />
        }
      }
    </section>
  `,
  styles: `
    .hero { padding: var(--shop-space-8) 0; }
    .hero h1 { font-size: var(--shop-font-size-xl); }
    section { margin-bottom: var(--shop-space-8); }
    .categories { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--shop-space-3); grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
    .category { display: flex; flex-direction: column; text-decoration: none; color: var(--shop-color-text); }
    .grid { display: grid; gap: var(--shop-space-4); grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
  `,
})
export class HomePage {
  private readonly api = inject(CatalogApi);
  protected readonly wishlist = inject(WishlistStore);
  protected readonly actions = inject(ProductActions);

  // toSignal subscribes immediately and unsubscribes when the component is destroyed.
  protected readonly categories = toSignal(loadable(this.api.getCategories()), { initialValue: LOADING });
  protected readonly topRated = toSignal(loadable(this.api.getProducts({ sort: 'Rating', pageSize: 4 })), { initialValue: LOADING });
}
