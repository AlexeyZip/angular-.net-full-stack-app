import { EnvironmentProviders, isDevMode, makeEnvironmentProviders } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { provideState, provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { CartStore, CatalogStore, STATE_VARIANT, WishlistStore } from '@shop/state/contracts';
import * as cartEffects from './cart/cart.effects';
import { cartFeature } from './cart/cart.feature';
import { NgrxCartStore } from './cart/ngrx-cart.store';
import * as catalogEffects from './catalog/catalog.effects';
import { catalogFeature } from './catalog/catalog.feature';
import { NgrxCatalogStore } from './catalog/ngrx-catalog.store';
import { NgrxWishlistStore } from './wishlist/ngrx-wishlist.store';
import * as wishlistEffects from './wishlist/wishlist.effects';
import { wishlistFeature } from './wishlist/wishlist.feature';

/** Registers the classic NgRx implementation behind the shared state contracts. */
export function provideNgrxState(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: STATE_VARIANT, useValue: 'ngrx' },
    provideStore(
      {},
      {
        runtimeChecks: {
          // Fail fast in development if a reducer mutates state or an action carries a class instance.
          strictStateImmutability: true,
          strictActionImmutability: true,
          strictStateSerializability: true,
          strictActionSerializability: true,
        },
      },
    ),
    provideState(catalogFeature),
    provideState(cartFeature),
    provideState(wishlistFeature),
    provideEffects(catalogEffects, cartEffects, wishlistEffects),
    // Redux DevTools browser extension; in production builds it only logs (no time travel).
    provideStoreDevtools({ maxAge: 50, logOnly: !isDevMode() }),
    NgrxCatalogStore,
    NgrxCartStore,
    NgrxWishlistStore,
    { provide: CatalogStore, useExisting: NgrxCatalogStore },
    { provide: CartStore, useExisting: NgrxCartStore },
    { provide: WishlistStore, useExisting: NgrxWishlistStore },
    // No eager initializer needed (unlike the Signals variant): effects registered by provideEffects
    // subscribe at bootstrap, so the cart and wishlist already follow login/logout.
  ]);
}
