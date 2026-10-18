import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/**
 * Shows the product image or, when there is none (seed data) or it fails to load, a deterministic
 * gradient placeholder. No external image service is needed for local development.
 */
@Component({
  selector: 'shop-product-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'shop-product-image' },
  template: `
    @if (src() && !failed()) {
      <img [src]="src()" [alt]="alt()" loading="lazy" decoding="async" (error)="failed.set(true)" />
    } @else {
      <div class="shop-product-image__placeholder" [style.background]="gradient()" role="img" [attr.aria-label]="alt()">
        <span aria-hidden="true">{{ initials() }}</span>
      </div>
    }
  `,
})
export class ProductImage {
  readonly src = input<string | null>(null);
  readonly alt = input.required<string>();
  readonly seed = input(0);

  protected readonly failed = signal(false);
  protected readonly gradient = computed(() => {
    const hue = (this.seed() * 47) % 360;
    return `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 75% 40%))`;
  });
  protected readonly initials = computed(() =>
    this.alt()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join(''),
  );
}
