import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { FieldError } from './field-error';

@Component({
  imports: [FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<input aria-describedby="name-error" /><shop-field-error [control]="control" id="name-error" />`,
})
class Host {
  readonly control = new FormControl('', { nonNullable: true, validators: [Validators.required] });
}

describe('FieldError', () => {
  it('stays silent until the user has interacted with the control', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('.shop-field__error')).toBeNull();
  });

  it('exposes exactly one element with the described-by id, containing the message', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.control.markAsTouched();
    fixture.componentInstance.control.updateValueAndValidity();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const described = element.querySelectorAll('#name-error');
    expect(described).toHaveLength(1);
    expect(described[0].textContent?.trim()).toBe('This field is required.');
  });
});
