import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthSession } from '@shop/shared/data-access';
import { ThemeToggle, ToastOutlet, ToastService } from '@shop/shared/ui';
import { CartStore, STATE_VARIANT, WishlistStore } from '@shop/state/contracts';
import { AssistantPanel } from './features/assistant/assistant-panel';

@Component({
  selector: 'shop-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ThemeToggle, ToastOutlet, AssistantPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly session = inject(AuthSession);
  protected readonly cart = inject(CartStore);
  protected readonly wishlist = inject(WishlistStore);
  protected readonly stateVariant = inject(STATE_VARIANT);
  protected readonly menuOpen = signal(false);
  /** UI state of the shell only, so it lives here rather than in the shared state stores. */
  protected readonly assistantOpen = signal(false);
  protected readonly assistantRequested = signal(false);
  private readonly assistantToggle = viewChild.required<ElementRef<HTMLButtonElement>>('assistantToggle');
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected search(term: string): void {
    this.menuOpen.set(false);
    void this.router.navigate(['/products'], { queryParams: { search: term.trim() || null } });
  }

  protected toggleAssistant(): void {
    this.menuOpen.set(false);
    if (this.assistantOpen()) {
      this.closeAssistant();
      return;
    }
    this.assistantRequested.set(true);
    this.assistantOpen.set(true);
  }

  protected closeAssistant(): void {
    this.assistantOpen.set(false);
    this.assistantToggle().nativeElement.focus();
  }

  protected logout(): void {
    this.menuOpen.set(false);
    this.session.logout().subscribe(() => {
      this.toasts.info('You have been signed out.');
      void this.router.navigateByUrl('/');
    });
  }
}
