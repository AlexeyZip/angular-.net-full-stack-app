import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Spinner } from './spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * Attribute selector keeps native <button>/<a> semantics (keyboard, focus, form submit, href)
 * instead of wrapping them in a custom element that would have to re-implement accessibility.
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector -- attribute selector on native elements, by design (see above)
  selector: 'button[shopButton], a[shopButton]',
  imports: [Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'shop-button',
    '[class.shop-button--primary]': "variant() === 'primary'",
    '[class.shop-button--secondary]': "variant() === 'secondary'",
    '[class.shop-button--ghost]': "variant() === 'ghost'",
    '[class.shop-button--danger]': "variant() === 'danger'",
    '[class.shop-button--sm]': "size() === 'sm'",
    '[class.shop-button--block]': 'block()',
    '[attr.aria-busy]': 'loading() || null',
    '[attr.disabled]': 'loading() || disabled() ? true : null',
  },
  template: `
    @if (loading()) {
      <shop-spinner size="sm" [label]="null" />
    }
    <ng-content />
  `,
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<'sm' | 'md'>('md');
  readonly loading = input(false);
  readonly disabled = input(false);
  readonly block = input(false);
}
