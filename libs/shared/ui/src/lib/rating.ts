import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'shop-rating',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'shop-rating' },
  template: `
    <span class="shop-rating__stars" aria-hidden="true">
      @for (star of stars(); track $index) {
        <span [class.shop-rating__star--on]="star">★</span>
      }
    </span>
    <span class="shop-visually-hidden">{{ label() }}</span>
    @if (count() !== null) {
      <span class="shop-rating__count" aria-hidden="true">({{ count() }})</span>
    }
  `,
})
export class Rating {
  readonly value = input.required<number>();
  readonly count = input<number | null>(null);

  protected readonly stars = computed(() => [1, 2, 3, 4, 5].map((n) => n <= Math.round(this.value())));
  protected readonly label = computed(() =>
    this.count() === 0 ? 'No reviews yet' : `Rated ${this.value().toFixed(1)} out of 5${this.count() ? ` from ${this.count()} reviews` : ''}`,
  );
}
