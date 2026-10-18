import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { AuthSession, toApiError, WishlistApi } from '@shop/shared/data-access';
import { catchError, map, mergeMap, of, switchMap, takeUntil } from 'rxjs';
import { wishlistActions, wishlistApiActions, wishlistSessionActions } from './wishlist.actions';

export const followIdentity = createEffect(
  (session = inject(AuthSession)) =>
    session.userIdChanges$.pipe(
      // Reset first so the previous user's items never stay visible, then load for the new user.
      mergeMap((userId) => (userId ? [wishlistSessionActions.reset(), wishlistActions.loadRequested()] : [wishlistSessionActions.reset()])),
    ),
  { functional: true },
);

export const loadWishlist = createEffect(
  (actions$ = inject(Actions), api = inject(WishlistApi)) =>
    actions$.pipe(
      ofType(wishlistActions.loadRequested),
      switchMap(() =>
        api.get().pipe(
          map((items) => wishlistApiActions.loaded({ items })),
          catchError((error: unknown) => of(wishlistApiActions.loadFailed({ error: toApiError(error) }))),
          // A reset (logout) cancels a load that is still in flight for the previous user.
          takeUntil(actions$.pipe(ofType(wishlistSessionActions.reset))),
        ),
      ),
    ),
  { functional: true },
);

/** mergeMap: independent add/remove calls for different products must all complete (none cancelled). */
export const addToWishlist = createEffect(
  (actions$ = inject(Actions), api = inject(WishlistApi)) =>
    actions$.pipe(
      ofType(wishlistActions.itemAdded),
      mergeMap(({ product }) =>
        api.add(product.id).pipe(
          map(() => wishlistApiActions.addConfirmed({ productId: product.id })),
          catchError((error: unknown) => of(wishlistApiActions.addFailed({ productId: product.id, error: toApiError(error) }))),
        ),
      ),
    ),
  { functional: true },
);

export const removeFromWishlist = createEffect(
  (actions$ = inject(Actions), api = inject(WishlistApi)) =>
    actions$.pipe(
      ofType(wishlistActions.itemRemoved),
      mergeMap(({ product }) =>
        api.remove(product.id).pipe(
          map(() => wishlistApiActions.removeConfirmed({ productId: product.id })),
          catchError((error: unknown) => of(wishlistApiActions.removeFailed({ product, error: toApiError(error) }))),
        ),
      ),
    ),
  { functional: true },
);
