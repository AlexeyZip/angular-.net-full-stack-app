import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CatalogApi, errorOf, LOADING, loadable, valueOf } from '@shop/shared/data-access';
import { Button, EmptyState, ErrorState, ProductImage, QuantityStepper, Rating, Spinner } from '@shop/shared/ui';
import { CartStore, MAX_QUANTITY_PER_LINE, WishlistStore } from '@shop/state/contracts';
import { Subject, merge, map, switchMap } from 'rxjs';
import { ProductActions } from '../../shared/product-actions';
import { ProductReviews } from './product-reviews';

@Component({
  selector: 'shop-product-page',
  imports: [CurrencyPipe, RouterLink, Button, EmptyState, ErrorState, ProductImage, QuantityStepper, Rating, Spinner, ProductReviews],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state().status) {
      @case ('loading') {
        <shop-spinner label="Loading product" />
      }
      @case ('error') {
        @if (notFound()) {
          <shop-empty-state title="Product not found" message="It may have been removed from the catalog.">
            <a shopButton routerLink="/products">Back to the catalog</a>
          </shop-empty-state>
        } @else {
          <shop-error-state [message]="errorMessage()" (retry)="retry$.next()" />
        }
      }
      @case ('success') {
        @if (product(); as product) {
          <nav aria-label="Breadcrumb" class="breadcrumb">
            <a routerLink="/products">Catalog</a> /
            <a [routerLink]="['/products']" [queryParams]="{ category: product.categorySlug }">{{ product.categoryName }}</a>
          </nav>
          <article class="product">
            <shop-product-image [src]="product.imageUrl" [alt]="product.name" [seed]="product.id" />
            <div>
              <p class="shop-muted">{{ product.brand }}</p>
              <h1>{{ product.name }}</h1>
              <shop-rating [value]="product.averageRating" [count]="product.reviewCount" />
              <p class="price">{{ product.price | currency: 'USD' }}</p>
              <p>{{ product.description }}</p>

              @if (maxQuantity() > 0) {
                <p class="shop-muted" data-testid="stock-status">
                  {{ product.availableQuantity <= 5 ? 'Only ' + product.availableQuantity + ' left in stock' : 'In stock' }}
                  @if (inCart() > 0) {
                    · {{ inCart() }} in your cart
                  }
                </p>
                <div class="buy">
                  <shop-quantity-stepper [(value)]="quantity" [max]="maxQuantity()" label="quantity" />
                  <button shopButton type="button" (click)="actions.addToCart(product, quantity())">Add to cart</button>
                  <button shopButton variant="secondary" type="button" [attr.aria-pressed]="wishlist.has(product.id)" (click)="actions.toggleWishlist(product)">
                    {{ wishlist.has(product.id) ? 'Saved ♥' : 'Save ♡' }}
                  </button>
                </div>
              } @else {
                <p class="out" data-testid="stock-status">
                  {{ product.availableQuantity === 0 ? 'Out of stock' : 'You already have the maximum quantity in your cart' }}
                </p>
              }
            </div>
          </article>

          <!-- Reviews are below the fold: their code and their HTTP request load only when scrolled into view. -->
          @defer (on viewport) {
            <shop-product-reviews [productId]="product.id" [productName]="product.name" />
          } @placeholder {
            <section class="reviews-placeholder" aria-hidden="true" data-testid="reviews-placeholder"></section>
          } @loading (minimum 200ms) {
            <shop-spinner label="Loading reviews" />
          }
        }
      }
    }
  `,
  styles: `
    .breadcrumb { margin-bottom: var(--shop-space-4); font-size: var(--shop-font-size-sm); }
    .product { display: grid; gap: var(--shop-space-8); grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); margin-bottom: var(--shop-space-8); }
    .price { font-size: var(--shop-font-size-xl); font-weight: 800; }
    .buy { display: flex; gap: var(--shop-space-3); flex-wrap: wrap; align-items: center; }
    .out { color: var(--shop-color-danger); font-weight: 600; }
    .reviews-placeholder { min-height: 200px; }
    @media (max-width: 768px) { .product { grid-template-columns: 1fr; } }
  `,
})
export class ProductPage {
  /** Bound from the :slug route parameter (withComponentInputBinding). */
  readonly slug = input.required<string>();

  private readonly api = inject(CatalogApi);
  private readonly cart = inject(CartStore);
  protected readonly wishlist = inject(WishlistStore);
  protected readonly actions = inject(ProductActions);
  protected readonly retry$ = new Subject<void>();

  // Signal -> Observable -> switchMap: navigating from one product to another cancels the previous request.
  protected readonly state = toSignal(
    merge(toObservable(this.slug), this.retry$.pipe(map(() => this.slug()))).pipe(switchMap((slug) => loadable(this.api.getProduct(slug)))),
    { initialValue: LOADING },
  );

  protected readonly product = computed(() => valueOf(this.state()));
  protected readonly notFound = computed(() => errorOf(this.state())?.status === 404);
  protected readonly errorMessage = computed(() => errorOf(this.state())?.message ?? '');

  protected readonly inCart = computed(() => this.cart.lines().find((line) => line.productId === this.product()?.id)?.quantity ?? 0);
  protected readonly maxQuantity = computed(() =>
    Math.max(0, Math.min(this.product()?.availableQuantity ?? 0, MAX_QUANTITY_PER_LINE) - this.inCart()),
  );

  // linkedSignal: a writable quantity that resets to 1 whenever a different product is shown.
  protected readonly quantity = linkedSignal({ source: () => this.product()?.id, computation: () => 1 });
}
