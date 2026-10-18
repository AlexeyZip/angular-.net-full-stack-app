import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { OrderStatus } from '@shop/shared/data-access';

@Component({
  selector: 'shop-order-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="'shop-badge shop-badge--' + status()" data-testid="order-status">{{ status() }}</span>`,
})
export class OrderStatusBadge {
  readonly status = input.required<OrderStatus>();
}
