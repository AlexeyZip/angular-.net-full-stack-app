import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { CartProduct, CartStore } from '@shop/state/contracts';
import { cartActions } from './cart.actions';
import { cartFeature } from './cart.feature';

@Injectable()
export class NgrxCartStore extends CartStore {
  private readonly store = inject(Store);

  readonly lines = this.store.selectSignal(cartFeature.selectLines);
  readonly itemCount = this.store.selectSignal(cartFeature.selectItemCount);
  readonly isEmpty = this.store.selectSignal(cartFeature.selectIsEmpty);
  readonly estimatedSubtotal = this.store.selectSignal(cartFeature.selectEstimatedSubtotal);
  readonly quote = this.store.selectSignal(cartFeature.selectQuote);
  readonly quoteStatus = this.store.selectSignal(cartFeature.selectQuoteStatus);
  readonly quoteError = this.store.selectSignal(cartFeature.selectQuoteError);
  readonly canCheckout = this.store.selectSignal(cartFeature.selectCanCheckout);

  add(product: CartProduct, quantity = 1): void {
    this.store.dispatch(cartActions.itemAdded({ product, quantity }));
  }

  updateQuantity(productId: number, quantity: number): void {
    this.store.dispatch(cartActions.quantityUpdated({ productId, quantity }));
  }

  remove(productId: number): void {
    this.store.dispatch(cartActions.itemRemoved({ productId }));
  }

  clear(): void {
    this.store.dispatch(cartActions.cleared());
  }

  refreshQuote(): void {
    this.store.dispatch(cartActions.quoteRefreshRequested());
  }
}
