import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApi, ApiError, Category, errorOf, LOADING, loadable, toApiError, valueOf } from '@shop/shared/data-access';
import { Button, ConfirmDialog, ErrorState, FieldError, Spinner, ToastService } from '@shop/shared/ui';
import { switchMap } from 'rxjs';

@Component({
  selector: 'shop-admin-categories-page',
  imports: [ReactiveFormsModule, Button, ConfirmDialog, ErrorState, FieldError, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Categories</h1>
    <div class="layout">
      <section>
        @switch (state().status) {
          @case ('loading') {
            <shop-spinner label="Loading categories" />
          }
          @case ('error') {
            <shop-error-state [message]="errorMessage()" (retry)="reload.update((n) => n + 1)" />
          }
          @case ('success') {
            <div class="shop-table-wrapper">
              <table class="shop-table">
                <thead>
                  <tr><th scope="col">Name</th><th scope="col">Slug</th><th scope="col" class="shop-table__number">Products</th><th scope="col"><span class="shop-visually-hidden">Actions</span></th></tr>
                </thead>
                <tbody>
                  @for (category of categories(); track category.id) {
                    <tr>
                      <td>{{ category.name }}</td>
                      <td><code>{{ category.slug }}</code></td>
                      <td class="shop-table__number">{{ category.productCount }}</td>
                      <td class="actions">
                        <button shopButton variant="ghost" size="sm" type="button" (click)="edit(category)">Edit</button>
                        <button shopButton variant="ghost" size="sm" type="button" (click)="pendingDelete.set(category)">Delete</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      </section>

      <form class="shop-card" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <h2>{{ editing() ? 'Edit category' : 'New category' }}</h2>
        @if (error(); as error) {
          <p class="shop-alert" role="alert">{{ error.message }}</p>
        }
        <div class="shop-field">
          <label for="category-name">Name</label>
          <input id="category-name" class="shop-input" formControlName="name" />
          <shop-field-error [control]="form.controls.name" />
        </div>
        <div class="shop-field">
          <label for="category-slug">Slug (optional)</label>
          <input id="category-slug" class="shop-input" formControlName="slug" />
        </div>
        <div class="shop-field">
          <label for="category-description">Description</label>
          <textarea id="category-description" class="shop-textarea" rows="3" formControlName="description"></textarea>
        </div>
        <div class="form-actions">
          <button shopButton type="submit" [loading]="saving()">{{ editing() ? 'Save' : 'Create' }}</button>
          @if (editing()) {
            <button shopButton variant="ghost" type="button" (click)="cancelEdit()">Cancel</button>
          }
        </div>
      </form>
    </div>

    <shop-confirm-dialog
      [open]="pendingDelete() !== null"
      (openChange)="!$event && pendingDelete.set(null)"
      title="Delete category?"
      [message]="'Delete ' + (pendingDelete()?.name ?? '') + '? Categories that still contain products cannot be deleted.'"
      confirmLabel="Delete"
      [danger]="true"
      (confirmed)="remove()"
    />
  `,
  styles: `
    .layout { display: grid; gap: var(--shop-space-6); grid-template-columns: 2fr 1fr; align-items: start; }
    .actions { white-space: nowrap; text-align: right; }
    .form-actions { display: flex; gap: var(--shop-space-2); }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
  `,
})
export class CategoriesPage {
  private readonly api = inject(AdminApi);
  private readonly toasts = inject(ToastService);
  protected readonly reload = signal(0);
  protected readonly editing = signal<Category | null>(null);
  protected readonly pendingDelete = signal<Category | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected readonly state = toSignal(toObservable(this.reload).pipe(switchMap(() => loadable(this.api.categories()))), { initialValue: LOADING });
  protected readonly categories = computed(() => valueOf(this.state()) ?? []);
  protected readonly errorMessage = computed(() => errorOf(this.state())?.message ?? '');

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    slug: ['', Validators.maxLength(120)],
    description: ['', Validators.maxLength(1000)],
  });

  protected edit(category: Category): void {
    this.editing.set(category);
    this.error.set(null);
    this.form.reset({ name: category.name, slug: category.slug, description: category.description });
  }

  protected cancelEdit(): void {
    this.editing.set(null);
    this.error.set(null);
    this.form.reset();
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const input = { name: raw.name.trim(), slug: raw.slug.trim() || null, description: raw.description.trim() };
    const editing = this.editing();
    this.saving.set(true);
    this.error.set(null);
    (editing ? this.api.updateCategory(editing.id, input) : this.api.createCategory(input)).subscribe({
      next: () => {
        this.saving.set(false);
        this.toasts.success(editing ? 'Category saved.' : 'Category created.');
        this.cancelEdit();
        this.reload.update((n) => n + 1);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(toApiError(error));
      },
    });
  }

  protected remove(): void {
    const category = this.pendingDelete();
    if (!category) {
      return;
    }

    this.api.deleteCategory(category.id).subscribe({
      next: () => {
        this.toasts.success('Category deleted.');
        this.reload.update((n) => n + 1);
      },
      error: (error: unknown) => this.toasts.error(toApiError(error).message),
    });
  }
}
