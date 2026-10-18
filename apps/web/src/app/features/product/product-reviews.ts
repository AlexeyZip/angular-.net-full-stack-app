import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiError, AuthSession, CatalogApi, LOADING, loadable, toApiError, valueOf } from '@shop/shared/data-access';
import { Button, FieldError, Pagination, Rating, Spinner, ToastService } from '@shop/shared/ui';
import { combineLatest, switchMap } from 'rxjs';

@Component({
  selector: 'shop-product-reviews',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, Button, FieldError, Pagination, Rating, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="reviews-heading" class="reviews">
      <h2 id="reviews-heading">Customer reviews</h2>

      @if (session.isAuthenticated()) {
        <form class="shop-card review-form" [formGroup]="form" (ngSubmit)="submit()" aria-labelledby="review-form-heading">
          <h3 id="review-form-heading">Review {{ productName() }}</h3>
          @if (submitError(); as error) {
            <p class="shop-alert" role="alert">{{ error.message }}</p>
          }
          <div class="shop-field">
            <label for="review-rating">Rating</label>
            <select id="review-rating" class="shop-select" formControlName="rating">
              @for (value of [5, 4, 3, 2, 1]; track value) {
                <option [ngValue]="value">{{ value }} star{{ value === 1 ? '' : 's' }}</option>
              }
            </select>
          </div>
          <div class="shop-field">
            <label for="review-comment">Comment</label>
            <textarea
              id="review-comment"
              class="shop-textarea"
              rows="3"
              formControlName="comment"
              aria-describedby="review-comment-error"
            ></textarea>
            <shop-field-error [control]="form.controls.comment" id="review-comment-error" />
          </div>
          <button shopButton type="submit" [loading]="submitting()">Submit review</button>
        </form>
      } @else {
        <p><a routerLink="/login">Sign in</a> to review products you have purchased.</p>
      }

      @switch (reviews().status) {
        @case ('loading') {
          <shop-spinner label="Loading reviews" />
        }
        @case ('error') {
          <p class="shop-alert">Reviews could not be loaded.</p>
        }
        @case ('success') {
          @if (reviewPage(); as result) {
            @for (review of result.items; track review.id) {
              <article class="review">
                <shop-rating [value]="review.rating" />
                <p>{{ review.comment }}</p>
                <p class="shop-muted">{{ review.authorName }} · {{ review.createdAt | date: 'mediumDate' }}</p>
              </article>
            } @empty {
              <p class="shop-muted">No reviews yet.</p>
            }
            <shop-pagination label="Review pages" [page]="page()" [totalPages]="result.totalPages" (pageChange)="page.set($event)" />
          }
        }
      }
    </section>
  `,
  styles: `
    .reviews { max-width: 760px; }
    .review-form { margin-bottom: var(--shop-space-6); }
    .review { border-bottom: 1px solid var(--shop-color-border); padding: var(--shop-space-3) 0; }
    .review p { margin: var(--shop-space-1) 0; }
  `,
})
export class ProductReviews {
  readonly productId = input.required<number>();
  readonly productName = input.required<string>();

  private readonly api = inject(CatalogApi);
  private readonly toasts = inject(ToastService);
  protected readonly session = inject(AuthSession);
  protected readonly page = signal(1);
  private readonly reload = signal(0);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<ApiError | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    comment: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(2000)]],
  });

  protected readonly reviews = toSignal(
    combineLatest([toObservable(this.productId), toObservable(this.page), toObservable(this.reload)]).pipe(
      switchMap(([productId, page]) => loadable(this.api.getReviews(productId, page))),
    ),
    { initialValue: LOADING },
  );

  protected readonly reviewPage = computed(() => valueOf(this.reviews()));

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { rating, comment } = this.form.getRawValue();
    this.submitting.set(true);
    this.submitError.set(null);
    this.api.createReview(this.productId(), rating, comment.trim()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.form.reset();
        this.toasts.success('Thank you for your review.');
        this.page.set(1);
        this.reload.update((n) => n + 1);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.submitError.set(toApiError(error));
      },
    });
  }
}
