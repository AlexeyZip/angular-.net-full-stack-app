import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { AbstractControl } from '@angular/forms';

const DEFAULT_MESSAGES: Record<string, (error: unknown) => string> = {
  required: () => 'This field is required.',
  email: () => 'Enter a valid email address.',
  minlength: (e) => `Enter at least ${(e as { requiredLength: number }).requiredLength} characters.`,
  maxlength: (e) => `Enter at most ${(e as { requiredLength: number }).requiredLength} characters.`,
  min: (e) => `The minimum is ${(e as { min: number }).min}.`,
  max: (e) => `The maximum is ${(e as { max: number }).max}.`,
  pattern: () => 'The format is not valid.',
  server: (e) => String(e),
};

/**
 * Shows the first validation message of a control once the user has interacted with it.
 * Reactive-forms state is not a signal, so the component listens to control.events (Angular 18+)
 * and bumps a local signal - required for OnPush/zoneless rendering.
 *
 * Give the host element the id that the input's aria-describedby points to
 * (`<shop-field-error id="email-error" ...>`). There is deliberately no `id` input: Angular would keep the
 * static attribute on the host as well, producing two elements with the same id.
 */
@Component({
  selector: 'shop-field-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message(); as text) {
      <p class="shop-field__error">{{ text }}</p>
    }
  `,
})
export class FieldError {
  readonly control = input.required<AbstractControl>();
  /** Messages for custom validator keys, e.g. { passwordStrength: 'Use letters and digits.' }. */
  readonly messages = input<Record<string, string>>({});

  private readonly changes = signal(0);

  constructor() {
    effect((onCleanup) => {
      const subscription = this.control().events.subscribe(() => this.changes.update((n) => n + 1));
      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected readonly message = computed(() => {
    this.changes();
    const control = this.control();
    if (!control.errors || !(control.touched || control.dirty)) {
      return null;
    }

    const [key, value] = Object.entries(control.errors)[0];
    return this.messages()[key] ?? DEFAULT_MESSAGES[key]?.(value) ?? 'The value is not valid.';
  });
}
