import { EnvironmentProviders } from '@angular/core';
import { provideSignalsState } from '@shop/state/signals';

/**
 * Build-time switch between the two state-management implementations.
 * This file is the default (Signals). The "*-ngrx" build configurations in apps/web/project.json use
 * fileReplacements to swap in state.providers.ngrx.ts, so exactly one implementation is bundled and
 * running in any application instance.
 */
export function provideAppState(): EnvironmentProviders {
  return provideSignalsState();
}
