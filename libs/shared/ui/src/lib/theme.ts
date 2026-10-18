import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, Injectable, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'shop.theme';

/**
 * Runtime theme switching: sets data-theme on <html>; the design tokens in _tokens.scss switch
 * their CSS custom properties based on it. 'system' follows prefers-color-scheme.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly preference = signal<ThemePreference>(this.readPreference());

  constructor() {
    effect(() => {
      const preference = this.preference();
      const root = this.document.documentElement;
      if (preference === 'system') {
        root.removeAttribute('data-theme');
      } else {
        root.setAttribute('data-theme', preference);
      }
      try {
        localStorage.setItem(STORAGE_KEY, preference);
      } catch {
        // storage unavailable: preference lasts for this page only
      }
    });
  }

  cycle(): void {
    const order: ThemePreference[] = ['system', 'light', 'dark'];
    this.preference.update((current) => order[(order.indexOf(current) + 1) % order.length]);
  }

  private readPreference(): ThemePreference {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    } catch {
      return 'system';
    }
  }
}

@Component({
  selector: 'shop-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="shop-icon-button" (click)="theme.cycle()" [attr.aria-label]="'Theme: ' + theme.preference() + '. Change theme'">
      <span aria-hidden="true">{{ icons[theme.preference()] }}</span>
    </button>
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
  protected readonly icons: Record<ThemePreference, string> = { system: '◐', light: '☀', dark: '☾' };
}
