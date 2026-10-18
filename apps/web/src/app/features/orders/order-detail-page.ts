import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { errorOf, LOADING, Loadable, loadable, OrderDetail, OrdersApi, toApiError, valueOf } from '@shop/shared/data-access';
import { Button, ConfirmDialog, EmptyState, ErrorState, Spinner, ToastService } from '@shop/shared/ui';
import { switchMap } from 'rxjs';
import { OrderDetailView } from '../../shared/order-detail-view';

@Component({
  selector: 'shop-order-detail-page',
  imports: [RouterLink, Button, ConfirmDialog, EmptyState, ErrorState, Spinner, OrderDetailView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p><a routerLink="/orders">← All orders</a></p>
    @switch (state().status) {
      @case ('loading') {
        <shop-spinner label="Loading order" />
      }
      @case ('error') {
        @if (notFound()) {
          <!-- Another customer's order also answers 404: the API does not reveal that it exists. -->
          <shop-empty-state title="Order not found">
            <a shopButton routerLink="/orders">Back to your orders</a>
          </shop-empty-state>
        } @else {
          <shop-error-state [message]="errorMessage()" [retryable]="false" />
        }
      }
      @case ('success') {
        @if (order(); as order) {
          @if (placed()) {
            <div class="shop-alert shop-alert--info" role="status" data-testid="order-placed">Thank you! Your order has been placed.</div>
          }
          <shop-order-detail-view [order]="order" />
          @if (order.allowedNextStatuses.includes('Cancelled')) {
            <button shopButton variant="danger" type="button" [loading]="cancelling()" (click)="confirmCancel.set(true)">Cancel order</button>
            <shop-confirm-dialog
              [(open)]="confirmCancel"
              title="Cancel this order?"
              message="The items will be returned to stock and the order cannot be reopened."
              confirmLabel="Cancel order"
              cancelLabel="Keep order"
              [danger]="true"
              (confirmed)="cancel(order.id)"
            />
          }
        }
      }
    }
  `,
})
export class OrderDetailPage {
  readonly id = input.required<string>();
  /** ?placed=1 after a successful checkout. */
  readonly placed = input(false, { transform: (value: unknown) => value === '1' || value === true });

  private readonly api = inject(OrdersApi);
  private readonly toasts = inject(ToastService);
  protected readonly confirmCancel = signal(false);
  protected readonly cancelling = signal(false);

  private readonly loaded = toSignal(toObservable(this.id).pipe(switchMap((id) => loadable(this.api.get(id)))), { initialValue: LOADING });
  /** linkedSignal: follows each load, but can also be overwritten locally after a successful cancel. */
  protected readonly state = linkedSignal<Loadable<OrderDetail>>(() => this.loaded());

  protected readonly order = computed(() => valueOf(this.state()));
  protected readonly notFound = computed(() => errorOf(this.state())?.status === 404);
  protected readonly errorMessage = computed(() => errorOf(this.state())?.message ?? '');

  protected cancel(id: string): void {
    this.cancelling.set(true);
    this.api.cancel(id).subscribe({
      next: (order) => {
        this.cancelling.set(false);
        this.state.set({ status: 'success', value: order });
        this.toasts.success('Order cancelled.');
      },
      error: (error: unknown) => {
        this.cancelling.set(false);
        this.toasts.error(toApiError(error).message);
      },
    });
  }
}
