import { EnvironmentProviders } from '@angular/core';
import { provideNgrxState } from '@shop/state/ngrx';

/** Replaces state.providers.ts in the "*-ngrx" build configurations. */
export function provideAppState(): EnvironmentProviders {
  return provideNgrxState();
}
