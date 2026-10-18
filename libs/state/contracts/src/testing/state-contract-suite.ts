/// <reference types="vitest/globals" />
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { EnvironmentProviders } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthSession, User } from '@shop/shared/data-access';
import { CART_QUOTE_DEBOUNCE_MS, CartStore, CatalogStore, STATE_VARIANT, StateVariant, WishlistStore } from '../lib/state-contracts';
import { ALICE, authResponse, BOB, page, product, quoteFor } from './test-data';

/**
 * ONE behavioural specification, executed against BOTH implementations (Signals and NgRx).
 * Components only depend on the contracts, so if both variants pass this suite they are interchangeable.
 * Tests go through the public contract and a mocked HTTP backend - never through implementation details.
 */
export function runStateContractSuite(variant: StateVariant, provideState: () => EnvironmentProviders): void {
  describe(`${variant} implementation of the state contracts`, () => {
    let http: HttpTestingController;
    let session: AuthSession;

    /** Lets timers (the quote debounce, 0 ms in tests) fire, then runs pending effects. */
    const settle = async (): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      TestBed.tick();
    };

    const flushAll = (url: string, body: unknown): TestRequest[] => {
      const requests = http.match((request) => request.url === url);
      requests.forEach((request) => request.flush(body));
      return requests;
    };

    const signIn = async (user: User, wishlist: unknown[] = []): Promise<void> => {
      session.login(user.email, 'irrelevant').subscribe();
      http.expectOne('/api/auth/login').flush(authResponse(user));
      flushAll('/api/wishlist', wishlist);
      await settle();
      flushAll('/api/cart/quote', quoteFor([]));
    };

    const signOut = async (): Promise<void> => {
      session.logout().subscribe();
      http.expectOne('/api/auth/logout').flush(null);
      await settle();
    };

    beforeEach(() => {
      localStorage.clear();
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting(), { provide: CART_QUOTE_DEBOUNCE_MS, useValue: 0 }, provideState()],
      });
      http = TestBed.inject(HttpTestingController);
      session = TestBed.inject(AuthSession);
    });

    afterEach(() => http.verify());

    it('reports which implementation is active', () => {
      expect(TestBed.inject(STATE_VARIANT)).toBe(variant);
    });

    describe('catalog', () => {
      let catalog: CatalogStore;
      const flushReferenceData = (): void => {
        flushAll('/api/catalog/categories', []);
        flushAll('/api/catalog/brands', []);
      };

      beforeEach(() => (catalog = TestBed.inject(CatalogStore)));

      it('loads the first page with the default filters', () => {
        catalog.open();
        expect(catalog.status()).toBe('loading');

        const request = http.expectOne((r) => r.url === '/api/catalog/products');
        expect(request.request.params.get('page')).toBe('1');
        expect(request.request.params.get('pageSize')).toBe('12');
        expect(request.request.params.get('sort')).toBe('Newest');
        request.flush(page([product(1), product(2)], 30));
        flushReferenceData();

        expect(catalog.status()).toBe('success');
        expect(catalog.products().map((p) => p.id)).toEqual([1, 2]);
        expect(catalog.totalCount()).toBe(30);
        expect(catalog.totalPages()).toBe(3);
        expect(catalog.isEmpty()).toBe(false);
      });

      it('resets to page 1 on a filter change and never applies the stale response', () => {
        catalog.open();
        http.expectOne((r) => r.url === '/api/catalog/products').flush(page([product(1)], 30));
        flushReferenceData();

        catalog.setPage(3);
        const stale = http.expectOne((r) => r.url === '/api/catalog/products');
        expect(stale.request.params.get('page')).toBe('3');

        catalog.updateFilters({ search: 'lamp' });
        expect(stale.cancelled).toBe(true); // switchMap unsubscribed -> the browser aborts the request
        const latest = http.expectOne((r) => r.url === '/api/catalog/products');
        expect(latest.request.params.get('page')).toBe('1');
        expect(latest.request.params.get('search')).toBe('lamp');
        latest.flush(page([product(7)]));
        flushReferenceData();

        expect(catalog.filters().page).toBe(1);
        expect(catalog.products().map((p) => p.id)).toEqual([7]);
      });

      it('distinguishes an empty result from loading', () => {
        catalog.open({ search: 'nothing-matches' });
        http.expectOne((r) => r.url === '/api/catalog/products').flush(page([]));
        flushReferenceData();

        expect(catalog.status()).toBe('success');
        expect(catalog.isEmpty()).toBe(true);
      });

      it('exposes failures as a normalized, serializable ApiError and recovers on reload', () => {
        catalog.open();
        http
          .expectOne((r) => r.url === '/api/catalog/products')
          .flush({ title: 'Database unavailable', code: 'server_error' }, { status: 503, statusText: 'Service Unavailable' });
        flushReferenceData();

        expect(catalog.status()).toBe('error');
        expect(catalog.error()).toMatchObject({ status: 503, code: 'server_error', message: 'Database unavailable' });

        catalog.reload();
        http.expectOne((r) => r.url === '/api/catalog/products').flush(page([product(1)]));
        flushAll('/api/catalog/brands', []);
        expect(catalog.status()).toBe('success');
        expect(catalog.error()).toBeNull();
      });
    });

    describe('cart', () => {
      let cart: CartStore;
      beforeEach(() => (cart = TestBed.inject(CartStore)));

      it('derives the item count and an exact (integer-cent) estimate, and clamps quantities', async () => {
        cart.add(product(1, { price: 0.1 }));
        cart.add(product(2, { price: 0.2 }));
        expect(cart.estimatedSubtotal()).toBe(0.3); // not 0.30000000000000004

        cart.updateQuantity(1, 50);
        expect(cart.lines().find((l) => l.productId === 1)?.quantity).toBe(20);
        expect(cart.itemCount()).toBe(21);

        await settle();
        flushAll('/api/cart/quote', quoteFor(cart.lines()));
      });

      it('asks the server for prices, sending only product ids and quantities', async () => {
        cart.add(product(1), 2);
        cart.add(product(2), 1);
        expect(cart.quoteStatus()).toBe('loading');
        expect(cart.canCheckout()).toBe(false);

        await settle();
        const request = http.expectOne('/api/cart/quote'); // several changes, one debounced request
        expect(request.request.body).toEqual({
          items: [
            { productId: 1, quantity: 2 },
            { productId: 2, quantity: 1 },
          ],
        });
        request.flush(quoteFor(cart.lines()));

        expect(cart.quoteStatus()).toBe('success');
        expect(cart.quote()?.total).toBe(39.99);
        expect(cart.canCheckout()).toBe(true);
      });

      it('never applies a quote for an older cart: emptying the cart cancels it', async () => {
        cart.add(product(1));
        await settle();
        const inFlight = http.expectOne('/api/cart/quote');

        cart.clear();
        expect(inFlight.cancelled).toBe(true);
        expect(cart.isEmpty()).toBe(true);
        expect(cart.quote()).toBeNull();
        expect(cart.quoteStatus()).toBe('idle');
        expect(cart.canCheckout()).toBe(false);
      });

      it('blocks checkout when the quote fails', async () => {
        cart.add(product(1));
        await settle();
        http.expectOne('/api/cart/quote').flush({ title: 'Down', code: 'server_error' }, { status: 500, statusText: 'Error' });

        expect(cart.quoteStatus()).toBe('error');
        expect(cart.quoteError()?.code).toBe('server_error');
        expect(cart.canCheckout()).toBe(false);
      });

      it('merges the guest cart into the user cart on sign-in and isolates users on a shared device', async () => {
        localStorage.setItem(
          `shop.cart.v1:${ALICE.id}`,
          JSON.stringify({ version: 1, owner: ALICE.id, lines: [{ productId: 1, quantity: 2, name: 'P1', slug: 'p1', imageUrl: null, unitPriceSnapshot: 11 }] }),
        );

        cart.add(product(1), 1);
        cart.add(product(3), 1);
        await settle();
        flushAll('/api/cart/quote', quoteFor(cart.lines()));
        expect(localStorage.getItem('shop.cart.v1:guest')).not.toBeNull();

        await signIn(ALICE);
        expect(cart.lines().map((l) => [l.productId, l.quantity])).toEqual([
          [1, 3],
          [3, 1],
        ]);
        expect(localStorage.getItem('shop.cart.v1:guest')).toBeNull();
        expect(localStorage.getItem(`shop.cart.v1:${ALICE.id}`)).not.toBeNull();

        await signOut();
        expect(cart.isEmpty()).toBe(true);
        expect(localStorage.getItem(`shop.cart.v1:${ALICE.id}`)).toBeNull();

        await signIn(BOB);
        expect(cart.isEmpty()).toBe(true);
      });
    });

    describe('wishlist', () => {
      let wishlist: WishlistStore;
      beforeEach(() => (wishlist = TestBed.inject(WishlistStore)));

      it('loads for the signed-in user and resets on sign-out', async () => {
        await signIn(ALICE, [product(1), product(2)]);
        expect(wishlist.status()).toBe('success');
        expect(wishlist.count()).toBe(2);
        expect(wishlist.has(1)).toBe(true);

        await signOut();
        expect(wishlist.count()).toBe(0);
        expect(wishlist.has(1)).toBe(false);
      });

      it('adds optimistically and rolls back when the server rejects', async () => {
        await signIn(ALICE);

        wishlist.add(product(5));
        expect(wishlist.has(5)).toBe(true); // visible before the server answers

        http.expectOne({ method: 'PUT', url: '/api/wishlist/5' }).flush({ title: 'Not found', code: 'not_found' }, { status: 404, statusText: 'Not Found' });
        expect(wishlist.has(5)).toBe(false);
        expect(wishlist.error()?.code).toBe('not_found');
      });

      it('rolls back only the failed removal when several are in flight', async () => {
        await signIn(ALICE, [product(1), product(2)]);

        wishlist.remove(1);
        wishlist.remove(2);
        expect(wishlist.count()).toBe(0);

        http.expectOne({ method: 'DELETE', url: '/api/wishlist/1' }).flush(null, { status: 500, statusText: 'Error' });
        http.expectOne({ method: 'DELETE', url: '/api/wishlist/2' }).flush(null);

        expect(wishlist.items().map((p) => p.id)).toEqual([1]);
      });

      it('keeps the newest item first, like the API', async () => {
        await signIn(ALICE, [product(1)]);

        wishlist.toggle(product(9));
        http.expectOne({ method: 'PUT', url: '/api/wishlist/9' }).flush(null);

        expect(wishlist.items().map((p) => p.id)).toEqual([9, 1]);
      });

      it('never lets a load started before sign-out repopulate the next session', async () => {
        session.login(ALICE.email, 'irrelevant').subscribe();
        http.expectOne('/api/auth/login').flush(authResponse(ALICE));
        const slowLoad = http.expectOne('/api/wishlist');
        await settle();
        flushAll('/api/cart/quote', quoteFor([]));

        await signOut();
        expect(slowLoad.cancelled).toBe(true);
        expect(wishlist.count()).toBe(0);
      });
    });
  });
}
