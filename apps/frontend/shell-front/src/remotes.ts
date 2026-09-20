import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { loadRemote, registerRemotes } from '@module-federation/runtime';
import { TUMBALAND_REMOTE_ENTRY, TUMBALAND_REMOTE_MODULE } from '@tumbaland/frontend-core/federation';
import { getGlobalConfig } from './config/ConfigProvider';
import { EMBEDDABLE_APPS, type RemoteApp } from './config/apps';

const stripTrailingSlash = (url: string): string => url.replace(/\/$/, '');

let registered = false;

/**
 * Tells the federation runtime where each configured app lives.
 *
 * Done on first use rather than at build time because the addresses are
 * deployment config, read from config.json — the same image serves every
 * environment.
 */
function ensureRemotesRegistered(): void {
  if (registered) return;

  const config = getGlobalConfig();
  registerRemotes(
    EMBEDDABLE_APPS.flatMap((app) => {
      const baseUrl = app.urlKey ? config[app.urlKey] : undefined;
      return baseUrl
        ? [{ name: app.remote, entry: `${stripTrailingSlash(baseUrl)}/${TUMBALAND_REMOTE_ENTRY}`, type: 'module' }]
        : [];
    })
  );
  registered = true;
}

const components = new Map<string, LazyExoticComponent<ComponentType>>();

/**
 * An app's exposed root as a lazy component.
 *
 * Created once per app and kept, so after the first visit its code is already
 * loaded and moving back into it renders with no loader and no reboot. That is
 * the whole difference from the iframe this replaced: an iframe threw the app's
 * JS context away on every switch, so each visit re-checked the session and
 * re-fetched everything the previous visit had already read.
 */
export function remoteComponent(app: RemoteApp): LazyExoticComponent<ComponentType> {
  let component = components.get(app.remote);
  if (!component) {
    component = lazy(async () => {
      const baseUrl = app.urlKey ? getGlobalConfig()[app.urlKey] : undefined;
      if (!baseUrl) {
        throw new Error(`${app.urlKey} is not configured for this deployment.`);
      }
      ensureRemotesRegistered();

      let loaded: { default: ComponentType } | null;
      try {
        loaded = await loadRemote<{ default: ComponentType }>(
          `${app.remote}/${TUMBALAND_REMOTE_MODULE.replace(/^\.\//, '')}`
        );
      } catch (cause) {
        // The runtime's own message is a paragraph of diagnostics and a docs
        // link: the console's business, not the page's.
        console.error(`Loading ${app.name} failed`, cause);
        throw new Error(`Could not reach ${app.name} at ${baseUrl}.`, { cause });
      }
      if (!loaded) {
        throw new Error(`${app.name} did not provide its pages.`);
      }
      return loaded;
    });
    components.set(app.remote, component);
  }
  return component;
}

/**
 * Drops a failed load so the next render tries again. React caches a lazy
 * component's rejection for good, so a retry needs a new one.
 */
export function forgetRemote(app: RemoteApp): void {
  components.delete(app.remote);
}
