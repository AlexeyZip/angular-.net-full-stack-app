import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  AdminApi,
  AdminProduct,
  ApiError,
  Category,
  LOADING,
  Loadable,
  loadable,
  SaveProductInput,
  toApiError,
  valueOf,
} from '@shop/shared/data-access';
import { Button, ErrorState, FieldError, Spinner, ToastService } from '@shop/shared/ui';
import { catchError, map, Observable, of, switchMap } from 'rxjs';

@Component({
  selector: 'shop-admin-product-edit-page',
  imports: [ReactiveFormsModule, RouterLink, Button, ErrorState, FieldError, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p><a routerLink="/admin/products">← All products</a></p>
    <h1>{{ isNew() ? 'New product' : 'Edit product' }}</h1>

    @if (loadState().status === 'loading') {
      <shop-spinner label="Loading product" />
    } @else if (loadState().status === 'error') {
      <shop-error-state message="The product could not be loaded." [retryable]="false" />
    } @else {
      <div class="layout">
        <form class="shop-card" [formGroup]="form" (ngSubmit)="save()" novalidate>
          @if (error(); as error) {
            <div class="shop-alert" role="alert" data-testid="product-save-error">
              <p>{{ error.message }}</p>
              @if (error.code === 'concurrency_conflict') {
                <p>Another administrator saved this product after you opened it. Reload to see their changes, then re-apply yours.</p>
                <button shopButton variant="secondary" size="sm" type="button" (click)="reloadLatest()">Reload latest version</button>
              }
            </div>
          }

          <div class="shop-field">
            <label for="name">Name</label>
            <input id="name" class="shop-input" formControlName="name" aria-describedby="name-error" />
            <shop-field-error [control]="form.controls.name" id="name-error" />
          </div>
          <div class="shop-field">
            <label for="slug">Slug (optional)</label>
            <input id="slug" class="shop-input" formControlName="slug" aria-describedby="slug-hint slug-error" />
            <p class="shop-field__hint" id="slug-hint">Generated from the name when empty.</p>
            <shop-field-error [control]="form.controls.slug" id="slug-error" />
          </div>
          <div class="row">
            <div class="shop-field">
              <label for="brand">Brand</label>
              <input id="brand" class="shop-input" formControlName="brand" aria-describedby="brand-error" />
              <shop-field-error [control]="form.controls.brand" id="brand-error" />
            </div>
            <div class="shop-field">
              <label for="price">Price (USD)</label>
              <input id="price" class="shop-input" type="number" step="0.01" min="0.01" formControlName="price" aria-describedby="price-error" />
              <shop-field-error [control]="form.controls.price" id="price-error" [messages]="{ pattern: 'Use at most two decimal places.' }" />
            </div>
          </div>
          <div class="shop-field">
            <label for="category">Category</label>
            <select id="category" class="shop-select" formControlName="categoryId" aria-describedby="category-error">
              <option [ngValue]="0" disabled>Select a category</option>
              @for (category of categories(); track category.id) {
                <option [ngValue]="category.id">{{ category.name }}</option>
              }
            </select>
            <shop-field-error [control]="form.controls.categoryId" id="category-error" [messages]="{ min: 'Select a category.' }" />
          </div>
          <div class="shop-field">
            <label for="description">Description</label>
            <textarea id="description" class="shop-textarea" rows="4" formControlName="description"></textarea>
          </div>
          <div class="shop-field">
            <label for="imageUrl">Image URL (optional, https)</label>
            <input id="imageUrl" class="shop-input" formControlName="imageUrl" aria-describedby="image-error" />
            <shop-field-error [control]="form.controls.imageUrl" id="image-error" [messages]="{ pattern: 'Use an https:// URL or a path starting with /.' }" />
          </div>
          @if (isNew()) {
            <div class="shop-field">
              <label for="initialStock">Initial stock</label>
              <input id="initialStock" class="shop-input" type="number" min="0" step="1" formControlName="initialStock" />
              <shop-field-error [control]="form.controls.initialStock" />
            </div>
          }
          <label class="checkbox"><input type="checkbox" formControlName="isActive" /> Visible in the storefront</label>

          <button shopButton type="submit" [loading]="saving()">{{ isNew() ? 'Create product' : 'Save changes' }}</button>
        </form>

        @if (product(); as product) {
          <aside class="shop-card" aria-labelledby="stock-heading">
            <h2 id="stock-heading">Inventory</h2>
            <p>In stock: <strong data-testid="stock-quantity">{{ stock() }}</strong></p>
            <form [formGroup]="stockForm" (ngSubmit)="adjustStock(product.id)" novalidate>
              <div class="shop-field">
                <label for="delta">Adjustment (+ receive, − write off)</label>
                <input id="delta" class="shop-input" type="number" step="1" formControlName="delta" />
                <shop-field-error [control]="stockForm.controls.delta" [messages]="{ nonZero: 'Enter a non-zero amount.' }" />
              </div>
              <div class="shop-field">
                <label for="reason">Reason</label>
                <input id="reason" class="shop-input" formControlName="reason" placeholder="e.g. Delivery received" />
                <shop-field-error [control]="stockForm.controls.reason" />
              </div>
              @if (stockError(); as stockError) {
                <p class="shop-alert" role="alert">{{ stockError.message }}</p>
              }
              <button shopButton variant="secondary" type="submit" [loading]="adjusting()">Apply adjustment</button>
            </form>
            <p class="shop-muted hint">Adjustments are relative, so they never overwrite stock sold by concurrent checkouts.</p>
          </aside>
        }
      </div>
    }
  `,
  styles: `
    .layout { display: grid; gap: var(--shop-space-6); grid-template-columns: 2fr 1fr; align-items: start; }
    .row { display: grid; gap: var(--shop-space-4); grid-template-columns: 1fr 1fr; }
    .checkbox { display: flex; gap: var(--shop-space-2); align-items: center; margin-bottom: var(--shop-space-4); }
    .hint { font-size: var(--shop-font-size-sm); }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
  `,
})
export class ProductEditPage {
  /** Absent on /admin/products/new. */
  readonly id = input<string>();

  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly isNew = computed(() => !this.id());
  protected readonly saving = signal(false);
  protected readonly adjusting = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly stockError = signal<ApiError | null>(null);
  protected readonly product = signal<AdminProduct | null>(null);
  protected readonly stock = signal(0);
  private readonly reloadCounter = signal(0);

  protected readonly categories = toSignal(this.api.categories().pipe(catchError(() => of<Category[]>([]))), {
    initialValue: [] as Category[],
  });

  /** For a new product there is nothing to load: success with a null value. */
  protected readonly loadState = toSignal(
    toObservable(computed(() => ({ id: this.id(), reload: this.reloadCounter() }))).pipe(
      switchMap(({ id }): Observable<Loadable<AdminProduct | null>> => (id ? loadable(this.api.product(Number(id))) : of({ status: 'success', value: null }))),
    ),
    { initialValue: LOADING },
  );

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    slug: ['', [Validators.maxLength(220)]],
    brand: ['', [Validators.required, Validators.maxLength(100)]],
    price: [0, [Validators.required, Validators.min(0.01), Validators.max(1_000_000), Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    categoryId: [0, [Validators.required, Validators.min(1)]],
    description: ['', [Validators.maxLength(4000)]],
    imageUrl: ['', [Validators.maxLength(500), Validators.pattern(/^(https:\/\/\S+|\/\S*)?$/)]],
    initialStock: [0, [Validators.required, Validators.min(0), Validators.max(100_000)]],
    isActive: [true],
  });

  protected readonly stockForm = this.fb.group({
    delta: [0, [Validators.required, Validators.min(-100_000), Validators.max(100_000), (c: { value: number }) => (c.value === 0 ? { nonZero: true } : null)]],
    reason: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
  });

  constructor() {
    // Synchronizes the loaded entity into the (non-signal) reactive form.
    effect(() => {
      const loaded = valueOf(this.loadState());
      if (loaded) {
        this.applyLoaded(loaded);
      }
    });
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const input: SaveProductInput = {
      name: raw.name.trim(),
      slug: raw.slug.trim() || null,
      description: raw.description.trim(),
      brand: raw.brand.trim(),
      price: Number(raw.price),
      categoryId: raw.categoryId,
      imageUrl: raw.imageUrl.trim() || null,
      isActive: raw.isActive,
    };

    const current = this.product();
    const request = current ? this.api.updateProduct(current.id, input, current.version) : this.api.createProduct(input, raw.initialStock);

    this.saving.set(true);
    this.error.set(null);
    request.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.toasts.success(current ? 'Product saved.' : 'Product created.');
        if (current) {
          this.applyLoaded(saved);
        } else {
          void this.router.navigate(['/admin/products', saved.id]);
        }
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(toApiError(error));
      },
    });
  }

  protected reloadLatest(): void {
    this.error.set(null);
    this.reloadCounter.update((n) => n + 1);
  }

  protected adjustStock(productId: number): void {
    if (this.stockForm.invalid) {
      this.stockForm.markAllAsTouched();
      return;
    }

    const { delta, reason } = this.stockForm.getRawValue();
    this.adjusting.set(true);
    this.stockError.set(null);
    this.api
      .adjustStock(productId, delta, reason.trim())
      .pipe(map((result) => result.stockQuantity))
      .subscribe({
        next: (stock) => {
          this.adjusting.set(false);
          this.stock.set(stock);
          this.stockForm.reset();
          this.toasts.success('Stock updated.');
        },
        error: (error: unknown) => {
          this.adjusting.set(false);
          this.stockError.set(toApiError(error));
        },
      });
  }

  private applyLoaded(product: AdminProduct): void {
    this.product.set(product);
    this.stock.set(product.stockQuantity);
    this.form.reset({
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      price: product.price,
      categoryId: product.categoryId,
      description: product.description,
      imageUrl: product.imageUrl ?? '',
      initialStock: 0,
      isActive: product.isActive,
    });
  }
}
