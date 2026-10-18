import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { ProductSummary } from '@shop/shared/data-access';
import { WishlistStore } from '@shop/state/contracts';
import { wishlistActions } from './wishlist.actions';
import { wishlistFeature } from './wishlist.feature';

@Injectable()
export class NgrxWishlistStore extends WishlistStore {
  private readonly store = inject(Store);
  private readonly state = this.store.selectSignal(wishlistFeature.selectWishlistState);

  readonly items = this.store.selectSignal(wishlistFeature.selectItems);
  readonly count = this.store.selectSignal(wishlistFeature.selectCount);
  readonly status = this.store.selectSignal(wishlistFeature.selectStatus);
  readonly error = this.store.selectSignal(wishlistFeature.selectError);

  has(productId: number): boolean {
    return this.state().entities[productId] !== undefined;
  }

  load(): void {
    this.store.dispatch(wishlistActions.loadRequested());
  }

  add(product: ProductSummary): void {
    if (!this.has(product.id)) {
      this.store.dispatch(wishlistActions.itemAdded({ product }));
    }
  }

  remove(productId: number): void {
    const product = this.state().entities[productId];
    if (product) {
      this.store.dispatch(wishlistActions.itemRemoved({ product }));
    }
  }

  toggle(product: ProductSummary): void {
    if (this.has(product.id)) {
      this.remove(product.id);
    } else {
      this.add(product);
    }
  }
}
