import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiError, AuthSession, toApiError } from '@shop/shared/data-access';
import { Button, FieldError, ToastService } from '@shop/shared/ui';

@Component({
  selector: 'shop-profile-page',
  imports: [ReactiveFormsModule, RouterLink, Button, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Your account</h1>
    @if (session.user(); as user) {
      <div class="layout">
        <section class="shop-card" aria-labelledby="profile-heading">
          <h2 id="profile-heading">Profile</h2>
          <dl>
            <dt>Email</dt>
            <dd>{{ user.email }}</dd>
            <dt>Role</dt>
            <dd>{{ user.role }}</dd>
          </dl>
          <form [formGroup]="form" (ngSubmit)="save()" novalidate>
            @if (error(); as error) {
              <p class="shop-alert" role="alert">{{ error.message }}</p>
            }
            <div class="shop-field">
              <label for="fullName">Full name</label>
              <input id="fullName" class="shop-input" formControlName="fullName" autocomplete="name" aria-describedby="name-error" />
              <shop-field-error [control]="form.controls.fullName" id="name-error" />
            </div>
            <button shopButton type="submit" [loading]="saving()" [disabled]="form.pristine">Save changes</button>
          </form>
        </section>
        <section class="shop-card" aria-labelledby="links-heading">
          <h2 id="links-heading">Shortcuts</h2>
          <ul>
            <li><a routerLink="/orders">Order history</a></li>
            <li><a routerLink="/wishlist">Wishlist</a></li>
          </ul>
        </section>
      </div>
    }
  `,
  styles: `
    .layout { display: grid; gap: var(--shop-space-4); grid-template-columns: 2fr 1fr; align-items: start; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: var(--shop-space-1) var(--shop-space-4); }
    dt { font-weight: 600; }
    dd { margin: 0; }
    @media (max-width: 768px) { .layout { grid-template-columns: 1fr; } }
  `,
})
export class ProfilePage {
  protected readonly session = inject(AuthSession);
  private readonly toasts = inject(ToastService);
  protected readonly saving = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    fullName: [this.session.user()?.fullName ?? '', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.session.updateProfile(this.form.getRawValue().fullName.trim()).subscribe({
      next: (user) => {
        this.saving.set(false);
        this.form.reset({ fullName: user.fullName });
        this.toasts.success('Profile updated.');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(toApiError(error));
      },
    });
  }
}
