import { beforeEach, expect, it, vi } from 'vite-plus/test';
import { ensureLeafletStyles } from './leafletStyles';

/**
 * The stylesheet's *content* is not asserted here: vitest does not run CSS
 * through Vite's pipeline, so `?inline` hands these tests an empty string
 * whatever the real build produces. What is worth pinning down is the part
 * this module owns — that something is put in the document, once, and that an
 * existing copy is left alone.
 */
async function freshEnsure() {
  // The module injects once per load and remembers it did.
  vi.resetModules();
  return (await import('./leafletStyles')).ensureLeafletStyles;
}

const injected = () => document.head.querySelectorAll('style[data-leaflet-styles]');

beforeEach(() => {
  injected().forEach((node) => node.remove());
});

it("puts Leaflet's stylesheet in the document", async () => {
  // Side-effect CSS imports never reach the shell: every front builds with
  // cssCodeSplit: false, so a remote's CSS is a file only its own index.html
  // links, and nothing fetches it when the shell loads the remote.
  const ensure = await freshEnsure();

  ensure();

  expect(injected()).toHaveLength(1);
});

it('adds nothing a second time, however many maps ask', async () => {
  const ensure = await freshEnsure();

  ensure();
  ensure();

  expect(injected()).toHaveLength(1);
});

it('leaves a copy already in the document alone', async () => {
  const existing = document.createElement('style');
  existing.setAttribute('data-leaflet-styles', '');
  existing.textContent = '/* from the app stylesheet */';
  document.head.appendChild(existing);

  const ensure = await freshEnsure();
  ensure();

  expect(injected()).toHaveLength(1);
  expect(injected()[0].textContent).toBe('/* from the app stylesheet */');
});

it('is exported for both maps to call', () => {
  expect(typeof ensureLeafletStyles).toBe('function');
});
