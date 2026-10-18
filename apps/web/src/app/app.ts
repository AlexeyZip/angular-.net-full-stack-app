import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthSession } from '@shop/shared/data-access';
import { ThemeToggle, ToastOutlet, ToastService } from '@shop/shared/ui';
import { CartStore, STATE_VARIANT, WishlistStore } from '@shop/state/contracts';

@Component({
  selector: 'shop-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ThemeToggle, ToastOutlet],
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
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected search(term: string): void {
    this.menuOpen.set(false);
    void this.router.navigate(['/products'], { queryParams: { search: term.trim() || null } });
  }

  protected logout(): void {
    this.menuOpen.set(false);
    this.session.logout().subscribe(() => {
      this.toasts.info('You have been signed out.');
      void this.router.navigateByUrl('/');
    });
  }
}
