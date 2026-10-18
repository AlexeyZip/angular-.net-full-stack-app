import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminApi, errorOf, LOADING, Loadable, loadable, OrderDetail, OrderStatus, toApiError, valueOf } from '@shop/shared/data-access';
import { Button, ConfirmDialog, ErrorState, Spinner, ToastService } from '@shop/shared/ui';
import { switchMap } from 'rxjs';
import { OrderDetailView } from '../../shared/order-detail-view';

const ACTION_LABELS: Record<OrderStatus, string> = {
  Paid: 'Mark as paid',
  Shipped: 'Mark as shipped',
  Delivered: 'Mark as delivered',
  Cancelled: 'Cancel order',
};

@Component({
  selector: 'shop-admin-order-page',
  imports: [RouterLink, Button, ConfirmDialog, ErrorState, Spinner, OrderDetailView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p><a routerLink="/admin/orders">← All orders</a></p>
    @switch (state().status) {
      @case ('loading') {
        <shop-spinner label="Loading order" />
      }
      @case ('error') {
        <shop-error-state [message]="errorMessage()" [retryable]="false" />
      }
      @case ('success') {
        @if (order(); as order) {
          <shop-order-detail-view [order]="order" />
          <section aria-label="Status actions" class="actions">
            <!-- Only transitions the server's state machine allows are offered; the server re-validates anyway. -->
            @for (next of order.allowedNextStatuses; track next) {
              <button
                shopButton
                type="button"
                [variant]="next === 'Cancelled' ? 'danger' : 'primary'"
                [loading]="changing() === next"
                [disabled]="changing() !== null"
                (click)="next === 'Cancelled' ? confirmCancel.set(true) : changeStatus(order.id, next)"
              >
                {{ labels[next] }}
              </button>
            } @empty {
              <p class="shop-muted">This order is in a final state.</p>
            }
          </section>
          <shop-confirm-dialog
            [(open)]="confirmCancel"
            title="Cancel this order?"
            message="Stock will be returned to inventory. This cannot be undone."
            confirmLabel="Cancel order"
            cancelLabel="Keep order"
            [danger]="true"
            (confirmed)="changeStatus(order.id, 'Cancelled')"
          />
        }
      }
    }
  `,
  styles: `
    .actions { display: flex; gap: var(--shop-space-2); }
  `,
})
export class AdminOrderPage {
  readonly id = input.required<string>();

  private readonly api = inject(AdminApi);
  private readonly toasts = inject(ToastService);
  protected readonly labels = ACTION_LABELS;
  protected readonly changing = signal<OrderStatus | null>(null);
  protected readonly confirmCancel = signal(false);

  private readonly loaded = toSignal(toObservable(this.id).pipe(switchMap((id) => loadable(this.api.order(id)))), { initialValue: LOADING });
  protected readonly state = linkedSignal<Loadable<OrderDetail>>(() => this.loaded());
  protected readonly order = computed(() => valueOf(this.state()));
  protected readonly errorMessage = computed(() => errorOf(this.state())?.message ?? '');

  protected changeStatus(id: string, status: OrderStatus): void {
    this.changing.set(status);
    this.api.changeOrderStatus(id, status).subscribe({
      next: (order) => {
        this.changing.set(null);
        this.state.set({ status: 'success', value: order });
        this.toasts.success(`Order marked as ${order.status.toLowerCase()}.`);
      },
      error: (error: unknown) => {
        this.changing.set(null);
        this.toasts.error(toApiError(error).message);
      },
    });
  }
}
