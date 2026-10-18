import { FormControl, FormGroup } from '@angular/forms';
import { matchingFields, passwordStrength, safeReturnUrl } from './validators';

describe('account validators', () => {
  it.each([
    ['', null],
    ['onlyletters', { passwordStrength: true }],
    ['1234567890', { passwordStrength: true }],
    ['letters1234', null],
  ])('passwordStrength(%j)', (value, expected) => {
    expect(passwordStrength(new FormControl(value))).toEqual(expected);
  });

  it('reports a mismatch on the confirmation field', () => {
    const form = new FormGroup(
      { password: new FormControl('secret12345'), confirm: new FormControl('other') },
      { validators: matchingFields('password', 'confirm') },
    );
    expect(form.controls.confirm.hasError('mismatch')).toBe(true);

    form.controls.confirm.setValue('secret12345');
    expect(form.controls.confirm.errors).toBeNull();
    expect(form.valid).toBe(true);
  });
});

describe('safeReturnUrl', () => {
  it.each([
    ['/orders?page=2', '/orders?page=2'],
    [undefined, '/'],
    ['https://evil.example/login', '/'],
    ['//evil.example', '/'],
    ['/\\evil.example', '/'],
    ['javascript:alert(1)', '/'],
  ])('%j -> %j', (input, expected) => {
    expect(safeReturnUrl(input)).toBe(expected);
  });
});
