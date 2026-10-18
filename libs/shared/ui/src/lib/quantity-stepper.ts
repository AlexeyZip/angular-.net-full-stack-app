import { ChangeDetectionStrategy, Component, forwardRef, input, model, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * A reusable numeric control that works two ways:
 * - with Angular forms (formControlName / [formControl]) through ControlValueAccessor;
 * - standalone with two-way binding: <shop-quantity-stepper [(value)]="qty" />.
 * The value is always clamped to [min, max], so callers never receive an invalid quantity.
 */
@Component({
  selector: 'shop-quantity-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => QuantityStepper), multi: true }],
  host: { class: 'shop-stepper' },
  template: `
    <button type="button" class="shop-stepper__button" [disabled]="isDisabled() || value() <= min()" (click)="set(value() - 1)">
      <span aria-hidden="true">−</span><span class="shop-visually-hidden">Decrease {{ label() }}</span>
    </button>
    <input
      class="shop-stepper__input"
      type="number"
      inputmode="numeric"
      [attr.aria-label]="label()"
      [min]="min()"
      [max]="max()"
      [value]="value()"
      [disabled]="isDisabled()"
      (change)="onInput($event)"
      (blur)="onTouched()"
    />
    <button type="button" class="shop-stepper__button" [disabled]="isDisabled() || value() >= max()" (click)="set(value() + 1)">
      <span aria-hidden="true">+</span><span class="shop-visually-hidden">Increase {{ label() }}</span>
    </button>
  `,
})
export class QuantityStepper implements ControlValueAccessor {
  readonly value = model(1);
  readonly min = input(1);
  readonly max = input(99);
  readonly label = input('quantity');

  protected readonly isDisabled = signal(false);
  private onChange: (value: number) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: number | null): void {
    this.value.set(this.clamp(value ?? this.min()));
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  protected onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.set(Number(input.value));
    input.value = String(this.value()); // reflect clamping back into the field
  }

  protected set(raw: number): void {
    const next = this.clamp(raw);
    if (next !== this.value()) {
      this.value.set(next);
      this.onChange(next);
    }
    this.onTouched();
  }

  private clamp(raw: number): number {
    const value = Number.isFinite(raw) ? Math.trunc(raw) : this.min();
    return Math.min(this.max(), Math.max(this.min(), value));
  }
}
