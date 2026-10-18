import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiError, AuthSession, toApiError } from '@shop/shared/data-access';
import { Button, FieldError } from '@shop/shared/ui';
import { matchingFields, passwordStrength, safeReturnUrl } from './validators';

@Component({
  selector: 'shop-register-page',
  imports: [ReactiveFormsModule, RouterLink, Button, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth shop-card">
      <h1>Create an account</h1>
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (error(); as error) {
          <p class="shop-alert" role="alert">{{ error.message }}</p>
        }
        <div class="shop-field">
          <label for="fullName">Full name</label>
          <input id="fullName" class="shop-input" formControlName="fullName" autocomplete="name" aria-describedby="name-error" />
          <shop-field-error [control]="form.controls.fullName" id="name-error" />
        </div>
        <div class="shop-field">
          <label for="email">Email</label>
          <input id="email" class="shop-input" type="email" formControlName="email" autocomplete="email" aria-describedby="email-error" />
          <shop-field-error [control]="form.controls.email" id="email-error" />
        </div>
        <div class="shop-field">
          <label for="password">Password</label>
          <input
            id="password"
            class="shop-input"
            type="password"
            formControlName="password"
            autocomplete="new-password"
            aria-describedby="password-hint password-error"
          />
          <p class="shop-field__hint" id="password-hint">At least 8 characters, with letters and digits.</p>
          <shop-field-error [control]="form.controls.password" id="password-error" [messages]="passwordMessages" />
        </div>
        <div class="shop-field">
          <label for="confirmPassword">Confirm password</label>
          <input
            id="confirmPassword"
            class="shop-input"
            type="password"
            formControlName="confirmPassword"
            autocomplete="new-password"
            aria-describedby="confirm-error"
          />
          <shop-field-error [control]="form.controls.confirmPassword" id="confirm-error" [messages]="passwordMessages" />
        </div>
        <button shopButton type="submit" [block]="true" [loading]="submitting()">Create account</button>
      </form>
      <p>Already have an account? <a routerLink="/login" [queryParams]="{ returnUrl: returnUrl() }">Sign in</a></p>
    </div>
  `,
  styles: `
    .auth { max-width: 420px; margin: var(--shop-space-8) auto; }
  `,
})
export class RegisterPage {
  readonly returnUrl = input<string>();

  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  protected readonly submitting = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly passwordMessages = {
    passwordStrength: 'Use both letters and digits.',
    mismatch: 'The passwords do not match.',
  };

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128), passwordStrength]],
      confirmPassword: ['', Validators.required],
    },
    { validators: matchingFields('password', 'confirmPassword') },
  );

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { fullName, email, password } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.session.register(email.trim(), password, fullName.trim()).subscribe({
      next: () => void this.router.navigateByUrl(safeReturnUrl(this.returnUrl())),
      error: (error: unknown) => {
        const apiError = toApiError(error);
        this.submitting.set(false);
        if (apiError.code === 'email_taken') {
          // Server-side errors are attached to the field they concern.
          this.form.controls.email.setErrors({ server: apiError.message });
          this.form.controls.email.markAsTouched();
        } else {
          this.error.set(apiError);
        }
      },
    });
  }
}
