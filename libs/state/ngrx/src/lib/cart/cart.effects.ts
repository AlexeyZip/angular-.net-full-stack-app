import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import { AuthSession, CartApi, toApiError } from '@shop/shared/data-access';
import { CART_QUOTE_DEBOUNCE_MS, cartForIdentityChange, CartPersistence } from '@shop/state/contracts';
import { catchError, EMPTY, map, of, scan, switchMap, tap, timer } from 'rxjs';
import { cartActions, cartApiActions, cartSessionActions } from './cart.actions';
import { cartFeature } from './cart.feature';

const lineChanges = [
  cartActions.itemAdded,
  cartActions.quantityUpdated,
  cartActions.itemRemoved,
  cartActions.cleared,
  cartActions.quoteRefreshRequested,
  cartSessionActions.restored,
];

/** Effects can start from any observable, not only actions: here, the session's identity stream. */
export const restoreCartOnIdentityChange = createEffect(
  (session = inject(AuthSession), persistence = inject(CartPersistence)) =>
    session.userIdChanges$.pipe(
      scan(
        (previous, userId) => ({ userId, lines: cartForIdentityChange(persistence, previous.userId, userId) }),
        { userId: null as string | null, lines: [] as ReturnType<typeof cartForIdentityChange> },
      ),
      map(({ userId, lines }) => cartSessionActions.restored({ userId, lines })),
    ),
  { functional: true },
);

/** Non-dispatching effect for a side effect: mirroring the cart to localStorage. */
export const persistCart = createEffect(
  (actions$ = inject(Actions), store = inject(Store), persistence = inject(CartPersistence)) =>
    actions$.pipe(
      ofType(...lineChanges),
      concatLatestFrom(() => [store.select(cartFeature.selectUserId), store.select(cartFeature.selectLines)]),
      tap(([, userId, lines]) => persistence.write(userId, lines)),
    ),
  { functional: true, dispatch: false },
);

/**
 * switchMap + timer is a debounce that ALSO cancels an in-flight request: every cart change (including
 * emptying the cart) restarts the pipeline, so a slow quote for an older cart can never be applied.
 * A plain debounceTime before switchMap would leave the old request running during the debounce window.
 */
export const quoteCart = createEffect(
  (actions$ = inject(Actions), store = inject(Store), api = inject(CartApi), debounce = inject(CART_QUOTE_DEBOUNCE_MS)) =>
    actions$.pipe(
      ofType(...lineChanges),
      concatLatestFrom(() => store.select(cartFeature.selectLines)),
      switchMap(([, lines]) =>
        lines.length === 0
          ? EMPTY
          : timer(debounce).pipe(
              switchMap(() => api.quote(lines.map(({ productId, quantity }) => ({ productId, quantity })))),
              map((quote) => cartApiActions.quoteLoaded({ quote })),
              catchError((error: unknown) => of(cartApiActions.quoteFailed({ error: toApiError(error) }))),
            ),
      ),
    ),
  { functional: true },
);
