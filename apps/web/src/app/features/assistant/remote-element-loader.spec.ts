import { TestBed } from '@angular/core/testing';
import { RemoteElementConfig, RemoteElementLoader } from './remote-element-loader';

let counter = 0;

function config(timeoutMs = 5_000): RemoteElementConfig {
  counter++;
  return { scriptUrl: `/mfe/test-${counter}/main.js`, tagName: `shop-test-remote-${counter}`, timeoutMs };
}

function scriptsFor(url: string): HTMLScriptElement[] {
  return Array.from(document.head.querySelectorAll<HTMLScriptElement>('script')).filter((s) => s.getAttribute('src') === url);
}

describe('RemoteElementLoader', () => {
  let loader: RemoteElementLoader;

  beforeEach(() => {
    loader = TestBed.inject(RemoteElementLoader);
  });

  it('injects the remote module script once and resolves when the remote defines its element', async () => {
    const remote = config();

    const first = loader.load(remote);
    const second = loader.load(remote);

    const scripts = scriptsFor(remote.scriptUrl);
    expect(scripts).toHaveLength(1);
    expect(scripts[0].type).toBe('module');

    customElements.define(remote.tagName, class extends HTMLElement {});
    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
  });

  it('does not load anything when the element is already defined', async () => {
    const remote = config();
    customElements.define(remote.tagName, class extends HTMLElement {});

    await loader.load(remote);

    expect(scriptsFor(remote.scriptUrl)).toHaveLength(0);
  });

  it('rejects when the remote cannot be downloaded and tries again on the next load', async () => {
    const remote = config();

    const failed = loader.load(remote);
    scriptsFor(remote.scriptUrl)[0].dispatchEvent(new Event('error'));
    await expect(failed).rejects.toThrow(`Could not load ${remote.scriptUrl}`);
    expect(scriptsFor(remote.scriptUrl)).toHaveLength(0);

    void loader.load(remote).catch(() => undefined);
    expect(scriptsFor(remote.scriptUrl)).toHaveLength(1);
  });

  it('rejects when the script loads but never defines the element', async () => {
    const remote = config(20);

    await expect(loader.load(remote)).rejects.toThrow(`${remote.tagName} was not defined within 20 ms`);
  });
});
