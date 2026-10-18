import { DOCUMENT } from '@angular/common';
import { Injectable, InjectionToken, inject } from '@angular/core';

/** Where a microfrontend lives and which custom element it defines. */
export interface RemoteElementConfig {
  scriptUrl: string;
  tagName: string;
  /** How long to wait for the element to be defined after the script loaded. */
  timeoutMs: number;
}

export const ASSISTANT_REMOTE = new InjectionToken<RemoteElementConfig>('ASSISTANT_REMOTE');

/**
 * Loads a separately deployed microfrontend at runtime: injects its ES module script once and waits until it
 * has registered its custom element. The host has no build-time dependency on the remote; if the remote is
 * down, only this promise rejects and the rest of the shop keeps working.
 */
@Injectable({ providedIn: 'root' })
export class RemoteElementLoader {
  private readonly document = inject(DOCUMENT);
  private readonly pending = new Map<string, Promise<void>>();

  load(config: RemoteElementConfig): Promise<void> {
    const registry = this.document.defaultView?.customElements;
    if (!registry) {
      return Promise.reject(new Error('Custom elements are not supported in this environment.'));
    }
    if (registry.get(config.tagName)) {
      return Promise.resolve();
    }

    let loading = this.pending.get(config.scriptUrl);
    if (!loading) {
      loading = this.inject(config, registry);
      // A failed load may succeed later (remote redeployed), so failures are not cached.
      loading.catch(() => this.pending.delete(config.scriptUrl));
      this.pending.set(config.scriptUrl, loading);
    }
    return loading;
  }

  private inject(config: RemoteElementConfig, registry: CustomElementRegistry): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const script = this.document.createElement('script');
      script.type = 'module';
      script.src = config.scriptUrl;
      script.onerror = () => {
        script.remove();
        reject(new Error(`Could not load ${config.scriptUrl}`));
      };
      const timer = setTimeout(
        () => reject(new Error(`${config.tagName} was not defined within ${config.timeoutMs} ms`)),
        config.timeoutMs,
      );
      registry.whenDefined(config.tagName).then(() => {
        clearTimeout(timer);
        resolve();
      });
      this.document.head.appendChild(script);
    });
  }
}
