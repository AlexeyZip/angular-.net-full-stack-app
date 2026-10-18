import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiError, CatalogApi, Category, ProductSummary, toApiError } from '@shop/shared/data-access';
import {
  applyFilterPatch,
  CatalogFilters,
  CatalogStore,
  DEFAULT_CATALOG_FILTERS,
  RequestStatus,
} from '@shop/state/contracts';
import { catchError, distinctUntilChanged, map, of, Subject, switchMap } from 'rxjs';

interface CatalogState {
  readonly filters: CatalogFilters;
  readonly products: readonly ProductSummary[];
  readonly totalCount: number;
  readonly totalPages: number;
  readonly status: RequestStatus;
  readonly error: ApiError | null;
  readonly categories: readonly Category[];
  readonly brands: readonly string[];
}

const INITIAL_STATE: CatalogState = {
  filters: DEFAULT_CATALOG_FILTERS,
  products: [],
  totalCount: 0,
  totalPages: 0,
  status: 'idle',
  error: null,
  categories: [],
  brands: [],
};

/**
 * Signals variant of the catalog state.
 *
 * - One private writable signal owns the state; the public API is read-only computed slices.
 * - Mutations go through a handful of methods, so every state change is easy to find.
 * - HTTP is RxJS: a Subject of "load requests" piped through switchMap, which UNSUBSCRIBES from the
 *   previous request when a new one starts. A slow response for an old filter can never overwrite a
 *   newer one (stale-response protection) and the browser actually aborts the old request.
 */
@Injectable()
export class SignalsCatalogStore extends CatalogStore {
  private readonly api = inject(CatalogApi);
  private readonly state = signal<CatalogState>(INITIAL_STATE);
  private readonly loadRequests = new Subject<CatalogFilters>();
  private readonly brandRequests = new Subject<string | null>();
  private categoriesRequested = false;

  readonly filters = computed(() => this.state().filters);
  readonly products = computed(() => this.state().products);
  readonly totalCount = computed(() => this.state().totalCount);
  readonly totalPages = computed(() => this.state().totalPages);
  readonly status = computed(() => this.state().status);
  readonly error = computed(() => this.state().error);
  readonly isEmpty = computed(() => this.state().status === 'success' && this.state().products.length === 0);
  readonly categories = computed(() => this.state().categories);
  readonly brands = computed(() => this.state().brands);

  constructor() {
    super();

    this.loadRequests
      .pipe(
        switchMap((filters) =>
          this.api.getProducts(filters).pipe(
            map((result) => ({ result, error: null })),
            catchError((error: unknown) => of({ result: null, error: toApiError(error) })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ result, error }) =>
        this.patch(
          result
            ? { products: result.items, totalCount: result.totalCount, totalPages: result.totalPages, status: 'success', error: null }
            : { status: 'error', error },
        ),
      );

    this.brandRequests
      .pipe(
        distinctUntilChanged(),
        switchMap((category) => this.api.getBrands(category).pipe(catchError(() => of<string[]>([])))),
        takeUntilDestroyed(),
      )
      .subscribe((brands) => this.patch({ brands }));
  }

  open(initial?: Partial<CatalogFilters>): void {
    if (!this.categoriesRequested) {
      this.categoriesRequested = true;
      this.api
        .getCategories()
        .pipe(catchError(() => of<Category[]>([])))
        .subscribe((categories) => this.patch({ categories }));
    }

    if (initial && Object.keys(initial).length > 0) {
      this.setFilters(applyFilterPatch(DEFAULT_CATALOG_FILTERS, initial));
    } else if (this.state().status === 'idle') {
      this.setFilters(this.state().filters);
    }
  }

  updateFilters(patch: Partial<CatalogFilters>): void {
    this.setFilters(applyFilterPatch(this.state().filters, patch));
  }

  setPage(page: number): void {
    this.setFilters(applyFilterPatch(this.state().filters, { page }));
  }

  resetFilters(): void {
    this.setFilters(DEFAULT_CATALOG_FILTERS);
  }

  reload(): void {
    this.setFilters(this.state().filters);
  }

  private setFilters(filters: CatalogFilters): void {
    this.patch({ filters, status: 'loading', error: null });
    this.loadRequests.next(filters);
    this.brandRequests.next(filters.category);
  }

  private patch(changes: Partial<CatalogState>): void {
    this.state.update((state) => ({ ...state, ...changes }));
  }
}
