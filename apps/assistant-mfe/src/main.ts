import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { createCustomElement } from '@angular/elements';
import { createApplication } from '@angular/platform-browser';
import { AssistantWidget } from './app/assistant-widget';

/** Part of the public contract: hosts render this tag after loading the script. */
const TAG_NAME = 'shop-assistant';

// The bundle may be loaded twice (two hosts on one page, a retry after an error); define only once.
if (!customElements.get(TAG_NAME)) {
  createApplication({ providers: [provideBrowserGlobalErrorListeners(), provideHttpClient(withFetch())] })
    .then((app) => customElements.define(TAG_NAME, createCustomElement(AssistantWidget, { injector: app.injector })))
    .catch((error: unknown) => console.error('shop-assistant failed to start', error));
}
