import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/** Returns page numbers to render, with null for an ellipsis gap: [1, null, 4, 5, 6, null, 10]. */
export function pageWindow(page: number, totalPages: number, radius = 1): (number | null)[] {
  const pages = new Set<number>([1, totalPages]);
  for (let p = page - radius; p <= page + radius; p++) {
    if (p >= 1 && p <= totalPages) {
      pages.add(p);
    }
  }

  const sorted = [...pages].filter((p) => p >= 1).sort((a, b) => a - b);
  const result: (number | null)[] = [];
  sorted.forEach((p, index) => {
    if (index > 0 && p - sorted[index - 1] > 1) {
      result.push(null);
    }
    result.push(p);
  });
  return result;
}

@Component({
  selector: 'shop-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (totalPages() > 1) {
      <nav class="shop-pagination" [attr.aria-label]="label()">
        <button type="button" class="shop-pagination__item" [disabled]="page() <= 1" (click)="go(page() - 1)">
          <span aria-hidden="true">‹</span><span class="shop-visually-hidden">Previous page</span>
        </button>
        @for (item of pages(); track $index) {
          @if (item === null) {
            <span class="shop-pagination__gap" aria-hidden="true">…</span>
          } @else {
            <button
              type="button"
              class="shop-pagination__item"
              [class.shop-pagination__item--active]="item === page()"
              [attr.aria-current]="item === page() ? 'page' : null"
              (click)="go(item)"
            >
              {{ item }}
            </button>
          }
        }
        <button type="button" class="shop-pagination__item" [disabled]="page() >= totalPages()" (click)="go(page() + 1)">
          <span aria-hidden="true">›</span><span class="shop-visually-hidden">Next page</span>
        </button>
      </nav>
    }
  `,
})
export class Pagination {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly label = input('Pagination');
  readonly pageChange = output<number>();

  protected readonly pages = computed(() => pageWindow(this.page(), this.totalPages()));

  protected go(page: number): void {
    if (page !== this.page() && page >= 1 && page <= this.totalPages()) {
      this.pageChange.emit(page);
    }
  }
}
