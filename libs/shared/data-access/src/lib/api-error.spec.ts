import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from './api-error';

describe('toApiError', () => {
  it('maps RFC 9457 problem details, including field errors', () => {
    const error = toApiError(
      new HttpErrorResponse({
        status: 400,
        error: { title: 'Validation failed', code: 'validation_failed', errors: { Email: ['Invalid email.'] } },
      }),
    );

    expect(error).toEqual({
      status: 400,
      code: 'validation_failed',
      message: 'Validation failed',
      fieldErrors: { Email: ['Invalid email.'] },
      details: null,
    });
  });

  it('treats status 0 as a network failure', () => {
    expect(toApiError(new HttpErrorResponse({ status: 0 })).code).toBe('network_error');
  });

  it('does not trust the shape of the error body', () => {
    const error = toApiError(new HttpErrorResponse({ status: 502, error: '<html>Bad gateway</html>' }));
    expect(error.code).toBe('http_502');
    expect(error.message).toMatch(/server/i);
    expect(error.fieldErrors).toEqual({});
  });

  it('wraps non-HTTP errors without leaking their internals', () => {
    expect(toApiError(new TypeError('x is undefined'))).toMatchObject({ status: -1, code: 'unexpected_error' });
  });
});
