import { DOCUMENT } from '@angular/common';
import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { ErrorState, Spinner } from '@shop/shared/ui';
import { ASSISTANT_REMOTE, RemoteElementLoader } from './remote-element-loader';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Below this width the panel covers most of the page, so it closes when it sends the user to a product. */
const OVERLAY_QUERY = '(max-width: 1199px)';

/**
 * Side panel hosting the assistant microfrontend (`apps/assistant-mfe`) on every page. The remote is a custom
 * element, so the host talks to it only through the DOM: it renders `<shop-assistant>` and listens for its
 * `productSelected` event. Closing only hides the panel, so the conversation survives navigation.
 */
@Component({
  selector: 'shop-assistant-panel',
  imports: [Spinner, ErrorState],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Keyboard events from the remote's shadow DOM are composed, so Escape inside the widget reaches the host.
  host: { '(keydown.escape)': 'closed.emit()' },
  template: `
    <!-- Closed = visibility: hidden + inert (not [hidden]): the slide-out can animate, and nothing inside is focusable. -->
    <aside
      id="assistant-panel"
      class="panel"
      [class.panel--open]="open()"
      [attr.inert]="open() ? null : ''"
      aria-labelledby="assistant-panel-title"
    >
      <div class="panel__header">
        <h2 #title id="assistant-panel-title" tabindex="-1">Shopping assistant</h2>
        <button type="button" class="shop-icon-button" aria-label="Close the assistant" (click)="closed.emit()">
          <span aria-hidden="true">✕</span>
        </button>
      </div>
      <div class="panel__body">
        @switch (status()) {
          @case ('loading') {
            <div class="panel__state"><shop-spinner label="Loading the assistant" /></div>
          }
          @case ('failed') {
            <div class="panel__state">
              <shop-error-state
                title="The assistant is unavailable"
                message="The rest of the shop works as usual. Try again later."
                (retry)="load()"
              />
            </div>
          }
          @case ('ready') {
            <shop-assistant compact (productSelected)="openProduct($event)" />
          }
        }
      </div>
    </aside>
  `,
  styles: `
    /*
     * An overlay on every screen size: position fixed takes it out of the flow, so opening it never moves the page.
     * Only transform and opacity are animated (compositor-only, no layout per frame). On close, visibility flips
     * after the slide-out has finished; on open it flips at once, so focus can move in immediately.
     */
    .panel {
      position: fixed;
      inset: 0 0 0 auto;
      z-index: 6;
      display: flex;
      flex-direction: column;
      width: min(420px, 100vw);
      background: var(--shop-color-surface);
      border-left: 1px solid var(--shop-color-border);
      box-shadow: -8px 0 24px rgb(16 24 40 / 12%);
      transform: translateX(100%);
      opacity: 0;
      visibility: hidden;
      transition:
        transform 280ms cubic-bezier(0.4, 0, 1, 1),
        opacity 200ms ease-in 80ms,
        visibility 0s linear 280ms;
    }
    .panel--open {
      transform: none;
      opacity: 1;
      visibility: visible;
      transition:
        transform 320ms cubic-bezier(0.16, 1, 0.3, 1),
        opacity 200ms ease-out,
        visibility 0s;
    }
    @media (prefers-reduced-motion: reduce) {
      .panel,
      .panel--open {
        transition: none;
      }
    }
    .panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 64px;
      padding: 0 var(--shop-space-4);
      border-bottom: 1px solid var(--shop-color-border);
    }
    h2 {
      margin: 0;
      font-size: 1.1rem;
      outline: none;
    }
    /* The chat scrolls its own message list and keeps its input at the bottom, so the body only passes on height. */
    .panel__body {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .panel__state {
      padding: var(--shop-space-4);
      overflow-y: auto;
    }
    shop-assistant {
      flex: 1;
      min-height: 0;
    }
  `,
})
export class AssistantPanel {
  private readonly loader = inject(RemoteElementLoader);
  private readonly remote = inject(ASSISTANT_REMOTE);
  private readonly router = inject(Router);
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly title = viewChild.required<ElementRef<HTMLElement>>('title');

  readonly open = input.required<boolean>();
  readonly closed = output<void>();

  protected readonly status = signal<'idle' | 'loading' | 'ready' | 'failed'>('idle');

  constructor() {
    // The remote bundle is fetched the first time the panel opens, not with the shell.
    effect(() => {
      if (this.open() && untracked(this.status) === 'idle') {
        untracked(() => this.load());
      }
    });
    // Move focus into the panel when it opens, after the DOM shows it.
    afterRenderEffect(() => {
      if (this.open()) {
        this.title().nativeElement.focus();
      }
    });
  }

  protected load(): void {
    this.status.set('loading');
    this.loader.load(this.remote).then(
      () => this.status.set('ready'),
      (error: unknown) => {
        console.error('Assistant microfrontend failed to load', error);
        this.status.set('failed');
      },
    );
  }

  /** Event payloads come from another deployable, so they are validated like any external input. */
  protected openProduct(event: Event): void {
    const slug = (event as CustomEvent<unknown>).detail;
    if (typeof slug !== 'string' || !SLUG.test(slug)) {
      return;
    }
    void this.router.navigate(['/products', slug]);
    if (this.window?.matchMedia?.(OVERLAY_QUERY).matches) {
      this.closed.emit();
    }
  }
}
