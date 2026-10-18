import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { CatalogFilters, CatalogStore } from '@shop/state/contracts';
import { catalogPageActions } from './catalog.actions';
import { catalogFeature } from './catalog.feature';

/**
 * Facade: adapts the NgRx store to the shared CatalogStore contract.
 * selectSignal turns memoized selectors into Signals, so components look identical in both variants.
 */
@Injectable()
export class NgrxCatalogStore extends CatalogStore {
  private readonly store = inject(Store);

  readonly filters = this.store.selectSignal(catalogFeature.selectFilters);
  readonly products = this.store.selectSignal(catalogFeature.selectProducts);
  readonly totalCount = this.store.selectSignal(catalogFeature.selectTotalCount);
  readonly totalPages = this.store.selectSignal(catalogFeature.selectTotalPages);
  readonly status = this.store.selectSignal(catalogFeature.selectStatus);
  readonly error = this.store.selectSignal(catalogFeature.selectError);
  readonly isEmpty = this.store.selectSignal(catalogFeature.selectIsEmpty);
  readonly categories = this.store.selectSignal(catalogFeature.selectCategories);
  readonly brands = this.store.selectSignal(catalogFeature.selectBrands);

  open(initial?: Partial<CatalogFilters>): void {
    this.store.dispatch(catalogPageActions.opened({ initial: initial ?? null }));
  }

  updateFilters(patch: Partial<CatalogFilters>): void {
    this.store.dispatch(catalogPageActions.filtersChanged({ patch }));
  }

  setPage(page: number): void {
    this.store.dispatch(catalogPageActions.pageChanged({ page }));
  }

  resetFilters(): void {
    this.store.dispatch(catalogPageActions.filtersReset());
  }

  reload(): void {
    this.store.dispatch(catalogPageActions.reloadRequested());
  }
}
