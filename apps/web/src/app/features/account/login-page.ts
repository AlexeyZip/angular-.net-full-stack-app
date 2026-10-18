import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiError, AuthSession, toApiError } from '@shop/shared/data-access';
import { Button, FieldError } from '@shop/shared/ui';
import { safeReturnUrl } from './validators';

@Component({
  selector: 'shop-login-page',
  imports: [ReactiveFormsModule, RouterLink, Button, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth shop-card">
      <h1>Sign in</h1>
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (error(); as error) {
          <p class="shop-alert" role="alert" data-testid="login-error">{{ error.message }}</p>
        }
        <div class="shop-field">
          <label for="email">Email</label>
          <input id="email" class="shop-input" type="email" formControlName="email" autocomplete="email" aria-describedby="email-error" />
          <shop-field-error [control]="form.controls.email" id="email-error" />
        </div>
        <div class="shop-field">
          <label for="password">Password</label>
          <input id="password" class="shop-input" type="password" formControlName="password" autocomplete="current-password" aria-describedby="password-error" />
          <shop-field-error [control]="form.controls.password" id="password-error" />
        </div>
        <button shopButton type="submit" [block]="true" [loading]="submitting()">Sign in</button>
      </form>
      <p>New here? <a routerLink="/register" [queryParams]="{ returnUrl: returnUrl() }">Create an account</a></p>
      <details class="shop-muted">
        <summary>Development accounts</summary>
        <p>Seeded only in the Development environment: <code>alice&#64;shop.local</code> / <code>DevOnly-Customer-2026</code>,
          <code>admin&#64;shop.local</code> / <code>DevOnly-Admin-2026</code>.</p>
      </details>
    </div>
  `,
  styles: `
    .auth { max-width: 420px; margin: var(--shop-space-8) auto; }
  `,
})
export class LoginPage {
  readonly returnUrl = input<string>();

  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  protected readonly submitting = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
    password: ['', [Validators.required, Validators.maxLength(128)]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.session.login(email.trim(), password).subscribe({
      next: () => void this.router.navigateByUrl(safeReturnUrl(this.returnUrl())),
      error: (error: unknown) => {
        this.submitting.set(false);
        this.error.set(toApiError(error));
        this.form.controls.password.reset();
      },
    });
  }
}
