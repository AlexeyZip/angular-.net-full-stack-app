import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { QuantityStepper } from './quantity-stepper';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [QuantityStepper, ReactiveFormsModule],
  template: `
    <shop-quantity-stepper id="bound" [(value)]="quantity" [max]="3" label="bound" />
    <shop-quantity-stepper id="form" [formControl]="control" [max]="10" label="form" />
  `,
})
class Host {
  readonly quantity = signal(2);
  readonly control = new FormControl(4, { nonNullable: true });
}

describe('QuantityStepper', () => {
  const setup = async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const find = <T extends Element>(selector: string): T => {
      const element = root.querySelector<T>(selector);
      if (!element) {
        throw new Error(`Missing ${selector}`);
      }
      return element;
    };
    const part = (id: string) => ({
      decrease: find<HTMLButtonElement>(`#${id} button:first-of-type`),
      increase: find<HTMLButtonElement>(`#${id} button:last-of-type`),
      input: find<HTMLInputElement>(`#${id} input`),
    });
    return { fixture, host: fixture.componentInstance, bound: part('bound'), form: part('form') };
  };

  it('supports two-way binding and stops at the maximum', async () => {
    const { fixture, host, bound } = await setup();

    bound.increase.click();
    await fixture.whenStable();
    expect(host.quantity()).toBe(3);
    expect(bound.increase.disabled).toBe(true);
  });

  it('clamps typed values into the allowed range', async () => {
    const { fixture, host, bound } = await setup();

    bound.input.value = '99';
    bound.input.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(host.quantity()).toBe(3);
    expect(bound.input.value).toBe('3');
  });

  it('works as a ControlValueAccessor', async () => {
    const { fixture, host, form } = await setup();
    expect(form.input.value).toBe('4');

    form.decrease.click();
    expect(host.control.value).toBe(3);

    host.control.disable();
    await fixture.whenStable();
    expect(form.input.disabled).toBe(true);
    expect(form.increase.disabled).toBe(true);
  });
});
