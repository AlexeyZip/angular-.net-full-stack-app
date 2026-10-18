import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiError, AuthSession, ProductSummary, toApiError, WishlistApi } from '@shop/shared/data-access';
import { RequestStatus, WishlistStore } from '@shop/state/contracts';
import { catchError, EMPTY, map, of, Subject, switchMap } from 'rxjs';

interface WishlistState {
  readonly items: readonly ProductSummary[];
  readonly status: RequestStatus;
  readonly error: ApiError | null;
}

const INITIAL_STATE: WishlistState = { items: [], status: 'idle', error: null };

@Injectable()
export class SignalsWishlistStore extends WishlistStore {
  private readonly api = inject(WishlistApi);
  private readonly session = inject(AuthSession);
  private readonly state = signal<WishlistState>(INITIAL_STATE);
  private readonly loadRequests = new Subject<'load' | 'cancel'>();

  readonly items = computed(() => this.state().items);
  readonly count = computed(() => this.state().items.length);
  readonly status = computed(() => this.state().status);
  readonly error = computed(() => this.state().error);
  private readonly ids = computed(() => new Set(this.state().items.map((item) => item.id)));

  constructor() {
    super();

    // 'cancel' switches to EMPTY, which unsubscribes from an in-flight load. Without it, a load started
    // for the previous user could finish after logout and repopulate their wishlist.
    this.loadRequests
      .pipe(
        switchMap((request) =>
          request === 'cancel'
            ? EMPTY
            : this.api.get().pipe(
                map((items) => ({ items, error: null })),
                catchError((error: unknown) => of({ items: null, error: toApiError(error) })),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ items, error }) =>
        this.state.update((state) => (items ? { items, status: 'success', error: null } : { ...state, status: 'error', error })),
      );

    this.session.userIdChanges$.pipe(takeUntilDestroyed()).subscribe((userId) => {
      this.loadRequests.next('cancel');
      this.state.set(INITIAL_STATE); // user-specific state never leaks into the next session
      if (userId) {
        this.load();
      }
    });
  }

  /** Reading ids() inside makes has() reactive when called from templates or computed(). */
  has(productId: number): boolean {
    return this.ids().has(productId);
  }

  load(): void {
    this.state.update((state) => ({ ...state, status: 'loading', error: null }));
    this.loadRequests.next('load');
  }

  add(product: ProductSummary): void {
    if (this.has(product.id)) {
      return;
    }

    this.state.update((state) => ({ ...state, items: [product, ...state.items], error: null }));
    this.api.add(product.id).subscribe({
      error: (error: unknown) =>
        this.state.update((state) => ({ ...state, items: state.items.filter((i) => i.id !== product.id), error: toApiError(error) })),
    });
  }

  remove(productId: number): void {
    const removed = this.state().items.find((item) => item.id === productId);
    if (!removed) {
      return;
    }

    this.state.update((state) => ({ ...state, items: state.items.filter((i) => i.id !== productId), error: null }));
    this.api.remove(productId).subscribe({
      // Roll back only this item. Restoring a whole snapshot would undo other changes made meanwhile.
      error: (error: unknown) =>
        this.state.update((state) => ({
          ...state,
          items: state.items.some((i) => i.id === productId) ? state.items : [removed, ...state.items],
          error: toApiError(error),
        })),
    });
  }

  toggle(product: ProductSummary): void {
    if (this.has(product.id)) {
      this.remove(product.id);
    } else {
      this.add(product);
    }
  }
}
