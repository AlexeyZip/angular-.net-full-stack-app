import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CartStore } from '@shop/state/contracts';
import { App } from './app';
import { provideAppState } from './state/state.providers';

describe('App shell', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAppState()],
    });
  });

  it('shows which state implementation is running and the live cart count', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="state-variant"]')?.textContent).toContain('Signals');
    expect(element.querySelector('[data-testid="cart-count"]')?.textContent?.trim()).toBe('0');

    TestBed.inject(CartStore).add({ id: 1, name: 'Lamp', slug: 'lamp', imageUrl: null, price: 20 }, 2);
    await fixture.whenStable();
    expect(element.querySelector('[data-testid="cart-count"]')?.textContent?.trim()).toBe('2');

    TestBed.inject(HttpTestingController)
      .match('/api/cart/quote')
      .forEach((request) => request.flush(null));
  });

  it('offers sign-in, but no account or admin links, to anonymous visitors', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('nav a')).map((a) => a.textContent?.trim());

    expect(links).toContain('Sign in');
    expect(links).not.toContain('Admin');
    expect(links.some((text) => text?.startsWith('Orders'))).toBe(false);
  });
});
