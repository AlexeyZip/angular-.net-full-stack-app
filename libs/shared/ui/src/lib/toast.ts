import { ChangeDetectionStrategy, Component, inject, Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  readonly id: number;
  readonly kind: ToastKind;
  readonly message: string;
}

/** Tiny notification service: a signal holding the visible toasts. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly visible = signal<readonly Toast[]>([]);
  readonly toasts = this.visible.asReadonly();

  success(message: string): void {
    this.show('success', message);
  }

  error(message: string): void {
    this.show('error', message, 6000);
  }

  info(message: string): void {
    this.show('info', message);
  }

  dismiss(id: number): void {
    this.visible.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  private show(kind: ToastKind, message: string, durationMs = 3500): void {
    const toast: Toast = { id: this.nextId++, kind, message };
    this.visible.update((toasts) => [...toasts.slice(-3), toast]);
    setTimeout(() => this.dismiss(toast.id), durationMs);
  }
}

@Component({
  selector: 'shop-toast-outlet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // aria-live makes screen readers announce new toasts without moving focus.
  template: `
    <div class="shop-toasts" aria-live="polite" aria-atomic="false">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="shop-toast" [class]="'shop-toast shop-toast--' + toast.kind" [attr.role]="toast.kind === 'error' ? 'alert' : 'status'">
          <span>{{ toast.message }}</span>
          <button type="button" class="shop-toast__close" (click)="toasts.dismiss(toast.id)">
            <span aria-hidden="true">×</span><span class="shop-visually-hidden">Dismiss</span>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastOutlet {
  protected readonly toasts = inject(ToastService);
}
