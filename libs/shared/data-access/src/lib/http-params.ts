import { HttpParams } from '@angular/common/http';

/** Builds query params, skipping null/undefined/empty values so the URL only carries real filters. */
export function toHttpParams(values: Readonly<Record<string, string | number | boolean | null | undefined>>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}
