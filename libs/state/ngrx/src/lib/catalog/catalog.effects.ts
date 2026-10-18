import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import { CatalogApi, toApiError } from '@shop/shared/data-access';
import { catchError, distinctUntilChanged, exhaustMap, filter, map, of, switchMap, take } from 'rxjs';
import { catalogApiActions, catalogPageActions } from './catalog.actions';
import { catalogFeature } from './catalog.feature';

const loadTriggers = [
  catalogPageActions.opened,
  catalogPageActions.filtersChanged,
  catalogPageActions.pageChanged,
  catalogPageActions.filtersReset,
  catalogPageActions.reloadRequested,
];

/** switchMap cancels the in-flight request when filters change again (stale-response protection). */
export const loadProducts = createEffect(
  (actions$ = inject(Actions), store = inject(Store), api = inject(CatalogApi)) =>
    actions$.pipe(
      ofType(...loadTriggers),
      concatLatestFrom(() => [store.select(catalogFeature.selectFilters), store.select(catalogFeature.selectStatus)]),
      filter(([, , status]) => status === 'loading'),
      switchMap(([, filters]) =>
        api.getProducts(filters).pipe(
          map((result) => catalogApiActions.productsLoaded({ result })),
          catchError((error: unknown) => of(catalogApiActions.productsLoadFailed({ error: toApiError(error) }))),
        ),
      ),
    ),
  { functional: true },
);

/** Reference data is loaded once; exhaustMap ignores repeated "opened" events while it is in flight. */
export const loadCategories = createEffect(
  (actions$ = inject(Actions), api = inject(CatalogApi)) =>
    actions$.pipe(
      ofType(catalogPageActions.opened),
      take(1),
      exhaustMap(() =>
        api.getCategories().pipe(
          map((categories) => catalogApiActions.categoriesLoaded({ categories })),
          catchError(() => of(catalogApiActions.categoriesLoaded({ categories: [] }))),
        ),
      ),
    ),
  { functional: true },
);

export const loadBrands = createEffect(
  (actions$ = inject(Actions), store = inject(Store), api = inject(CatalogApi)) =>
    actions$.pipe(
      ofType(...loadTriggers),
      concatLatestFrom(() => store.select(catalogFeature.selectFilters)),
      map(([, filters]) => filters.category),
      distinctUntilChanged(),
      switchMap((category) =>
        api.getBrands(category).pipe(
          map((brands) => catalogApiActions.brandsLoaded({ brands })),
          catchError(() => of(catalogApiActions.brandsLoaded({ brands: [] }))),
        ),
      ),
    ),
  { functional: true },
);
