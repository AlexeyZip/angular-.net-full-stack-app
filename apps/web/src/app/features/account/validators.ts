import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Mirrors the API's PasswordPolicy (the API remains the authority): 10+ chars with letters and digits. */
export const passwordStrength: ValidatorFn = (control: AbstractControl<string>): ValidationErrors | null => {
  const value = control.value ?? '';
  if (value.length === 0) {
    return null; // "required" reports empty values
  }
  return /[A-Za-z]/.test(value) && /\d/.test(value) ? null : { passwordStrength: true };
};

/** Group-level validator: cross-field rules belong on the common parent, not on one of the fields. */
export function matchingFields(field: string, confirmation: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const confirmControl = group.get(confirmation);
    const mismatch = group.get(field)?.value !== confirmControl?.value;
    const otherErrors = { ...confirmControl?.errors };
    delete otherErrors['mismatch'];

    // The error is also placed on the confirmation control, so its <shop-field-error> can show it.
    confirmControl?.setErrors(mismatch && confirmControl.value ? { ...otherErrors, mismatch: true } : Object.keys(otherErrors).length ? otherErrors : null);
    return mismatch ? { mismatch: true } : null;
  };
}

/**
 * Only same-origin, path-only return URLs are honoured. "//evil.example" and "https://..." are rejected,
 * otherwise ?returnUrl= would be an open redirect usable in phishing links.
 */
export function safeReturnUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return '/';
  }
  return value;
}
