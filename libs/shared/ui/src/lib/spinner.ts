import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'shop-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'shop-spinner',
    '[class.shop-spinner--sm]': "size() === 'sm'",
    '[attr.role]': "label() ? 'status' : null",
  },
  template: `
    <span class="shop-spinner__circle" aria-hidden="true"></span>
    @if (label(); as text) {
      <span class="shop-visually-hidden">{{ text }}</span>
    }
  `,
})
export class Spinner {
  readonly size = input<'sm' | 'md'>('md');
  /** Announced to screen readers. Pass null when the spinner sits inside an element with its own label. */
  readonly label = input<string | null>('Loading');
}
