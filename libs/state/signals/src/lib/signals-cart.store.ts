import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiError, AuthSession, CartApi, CartQuote, toApiError } from '@shop/shared/data-access';
import {
  addCartLine,
  CART_QUOTE_DEBOUNCE_MS,
  CartLine,
  CartPersistence,
  CartProduct,
  CartStore,
  cartForIdentityChange,
  cartItemCount,
  clampQuantity,
  estimateSubtotal,
  RequestStatus,
} from '@shop/state/contracts';
import { catchError, EMPTY, map, of, Subject, switchMap, timer } from 'rxjs';

interface CartState {
  readonly lines: readonly CartLine[];
  readonly quote: CartQuote | null;
  readonly quoteStatus: RequestStatus;
  readonly quoteError: ApiError | null;
}

@Injectable()
export class SignalsCartStore extends CartStore {
  private readonly api = inject(CartApi);
  private readonly persistence = inject(CartPersistence);
  private readonly session = inject(AuthSession);
  private readonly state = signal<CartState>({ lines: [], quote: null, quoteStatus: 'idle', quoteError: null });
  private readonly quoteRequests = new Subject<readonly CartLine[]>();
  private userId: string | null = null;

  readonly lines = computed(() => this.state().lines);
  readonly itemCount = computed(() => cartItemCount(this.lines()));
  readonly isEmpty = computed(() => this.lines().length === 0);
  readonly estimatedSubtotal = computed(() => estimateSubtotal(this.lines()));
  readonly quote = computed(() => this.state().quote);
  readonly quoteStatus = computed(() => this.state().quoteStatus);
  readonly quoteError = computed(() => this.state().quoteError);
  readonly canCheckout = computed(() => !this.isEmpty() && this.quoteStatus() === 'success' && this.quote()?.canCheckout === true);

  constructor() {
    super();

    // Subscribed first: the identity stream below emits synchronously and immediately requests a quote.
    // switchMap + timer = debounce that also cancels the in-flight request on every change, including
    // emptying the cart, so a slow quote for an older cart is never applied.
    const debounce = inject(CART_QUOTE_DEBOUNCE_MS);
    this.quoteRequests
      .pipe(
        switchMap((lines) =>
          lines.length === 0
            ? EMPTY
            : timer(debounce).pipe(
                switchMap(() => this.api.quote(lines.map(({ productId, quantity }) => ({ productId, quantity })))),
                map((quote) => ({ quote, error: null })),
                catchError((error: unknown) => of({ quote: null, error: toApiError(error) })),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ quote, error }) =>
        this.state.update((state) => ({ ...state, quote, quoteStatus: error ? 'error' : 'success', quoteError: error })),
      );

    // Identity changes (login/logout/expiry) swap the whole cart; see cartForIdentityChange.
    this.session.userIdChanges$.pipe(takeUntilDestroyed()).subscribe((nextUserId) => {
      const lines = cartForIdentityChange(this.persistence, this.userId, nextUserId);
      this.userId = nextUserId;
      this.setLines(lines);
    });

    // A genuine side effect - mirroring state into localStorage - which is what effect() is for.
    // It is NOT used to derive state; derived values above are computed().
    effect(() => this.persistence.write(this.userId, this.lines()));
  }

  add(product: CartProduct, quantity = 1): void {
    this.setLines(addCartLine(this.lines(), product, quantity));
  }

  updateQuantity(productId: number, quantity: number): void {
    this.setLines(this.lines().map((line) => (line.productId === productId ? { ...line, quantity: clampQuantity(quantity) } : line)));
  }

  remove(productId: number): void {
    this.setLines(this.lines().filter((line) => line.productId !== productId));
  }

  clear(): void {
    this.setLines([]);
  }

  refreshQuote(): void {
    this.setLines(this.lines());
  }

  private setLines(lines: readonly CartLine[]): void {
    const empty = lines.length === 0;
    this.state.update((state) => ({
      ...state,
      lines,
      quote: empty ? null : state.quote,
      quoteStatus: empty ? 'idle' : 'loading',
      quoteError: null,
    }));

    this.quoteRequests.next(lines);
  }
}
