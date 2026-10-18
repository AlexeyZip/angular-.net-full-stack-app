import { EnvironmentProviders, inject, makeEnvironmentProviders, provideEnvironmentInitializer } from '@angular/core';
import { CartStore, CatalogStore, STATE_VARIANT, WishlistStore } from '@shop/state/contracts';
import { SignalsCartStore } from './signals-cart.store';
import { SignalsCatalogStore } from './signals-catalog.store';
import { SignalsWishlistStore } from './signals-wishlist.store';

/** Registers the Signals implementation behind the shared state contracts. */
export function provideSignalsState(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: STATE_VARIANT, useValue: 'signals' },
    SignalsCatalogStore,
    SignalsCartStore,
    SignalsWishlistStore,
    { provide: CatalogStore, useExisting: SignalsCatalogStore },
    { provide: CartStore, useExisting: SignalsCartStore },
    { provide: WishlistStore, useExisting: SignalsWishlistStore },
    // Instantiate eagerly so they start following login/logout before any page asks for them.
    provideEnvironmentInitializer(() => {
      inject(CartStore);
      inject(WishlistStore);
    }),
  ]);
}
