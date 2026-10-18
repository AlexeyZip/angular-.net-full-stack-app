import { ComponentRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AssistantPanel } from './assistant-panel';
import { ASSISTANT_REMOTE, RemoteElementLoader } from './remote-element-loader';

describe('AssistantPanel', () => {
  const load = vi.fn<RemoteElementLoader['load']>();

  function render(open = true) {
    TestBed.configureTestingModule({
      imports: [AssistantPanel],
      providers: [
        provideRouter([]),
        { provide: RemoteElementLoader, useValue: { load } },
        { provide: ASSISTANT_REMOTE, useValue: { scriptUrl: '/mfe/assistant/main.js', tagName: 'shop-assistant', timeoutMs: 1_000 } },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AssistantPanel);
    const ref: ComponentRef<AssistantPanel> = fixture.componentRef;
    ref.setInput('open', open);
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    return { fixture, ref, element: fixture.nativeElement as HTMLElement, navigate, closed };
  }

  beforeEach(() => load.mockReset());

  it('does not download the remote until the panel is opened', async () => {
    load.mockResolvedValue(undefined);
    const { fixture, ref, element } = render(false);
    await fixture.whenStable();

    const aside = element.querySelector('aside') as HTMLElement;
    expect(load).not.toHaveBeenCalled();
    // Closed: slid out and inert, so nothing inside can take focus while it is invisible.
    expect(aside.classList.contains('panel--open')).toBe(false);
    expect(aside.hasAttribute('inert')).toBe(true);

    ref.setInput('open', true);
    await fixture.whenStable();

    expect(load).toHaveBeenCalledWith(expect.objectContaining({ scriptUrl: '/mfe/assistant/main.js', tagName: 'shop-assistant' }));
    expect(aside.classList.contains('panel--open')).toBe(true);
    expect(aside.hasAttribute('inert')).toBe(false);
    expect(element.querySelector('shop-assistant')?.hasAttribute('compact')).toBe(true);
  });

  it('keeps the remote element when it is closed and reopened, so the answer survives', async () => {
    load.mockResolvedValue(undefined);
    const { fixture, ref, element } = render();
    await fixture.whenStable();
    const remote = element.querySelector('shop-assistant');

    ref.setInput('open', false);
    await fixture.whenStable();
    ref.setInput('open', true);
    await fixture.whenStable();

    expect(element.querySelector('shop-assistant')).toBe(remote);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('moves focus into the panel and closes on Escape', async () => {
    load.mockResolvedValue(undefined);
    const { fixture, element, closed } = render();
    await fixture.whenStable();

    expect(document.activeElement).toBe(element.querySelector('h2'));

    element.querySelector('h2')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('opens the product the remote selects and ignores payloads that are not slugs', async () => {
    load.mockResolvedValue(undefined);
    const { fixture, element, navigate } = render();
    await fixture.whenStable();
    const remote = element.querySelector('shop-assistant');

    remote?.dispatchEvent(new CustomEvent('productSelected', { detail: '../admin' }));
    remote?.dispatchEvent(new CustomEvent('productSelected', { detail: { slug: 'x' } }));
    remote?.dispatchEvent(new CustomEvent('productSelected', { detail: 'sonora-buds-3' }));

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/products', 'sonora-buds-3']);
  });

  it('shows a recoverable error instead of breaking the page when the remote is down', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    load.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    const { fixture, element } = render();
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('The assistant is unavailable');
    expect(element.querySelector('shop-assistant')).toBeNull();

    element.querySelector<HTMLButtonElement>('[role="alert"] button')?.click();
    await fixture.whenStable();

    expect(load).toHaveBeenCalledTimes(2);
    expect(element.querySelector('shop-assistant')).not.toBeNull();
  });
});
