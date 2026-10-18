import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from './button';

/** Content projection: callers decide which actions (links, buttons) an empty state offers. */
@Component({
  selector: 'shop-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'shop-state' },
  template: `
    <h2 class="shop-state__title">{{ title() }}</h2>
    @if (message()) {
      <p class="shop-state__message">{{ message() }}</p>
    }
    <div class="shop-state__actions"><ng-content /></div>
  `,
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly message = input<string>('');
}

@Component({
  selector: 'shop-error-state',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'shop-state shop-state--error', role: 'alert' },
  template: `
    <h2 class="shop-state__title">{{ title() }}</h2>
    <p class="shop-state__message">{{ message() }}</p>
    @if (retryable()) {
      <button shopButton variant="secondary" type="button" (click)="retry.emit()">Try again</button>
    }
  `,
})
export class ErrorState {
  readonly title = input('Something went wrong');
  readonly message = input.required<string>();
  readonly retryable = input(true);
  readonly retry = output<void>();
}
