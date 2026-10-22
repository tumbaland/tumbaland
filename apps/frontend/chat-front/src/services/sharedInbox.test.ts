import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { clearShare, isMedia, readShare, sharedMessage } from './sharedInbox';

/** The cache the shell's service worker writes a share into. */
function cacheWith(entries: Record<string, unknown>) {
  const cache = {
    match: vi.fn(async (key: string) => {
      const value = entries[key];
      if (value === undefined) return undefined;
      return {
        json: async () => value,
        blob: async () => new Blob([String(value)])
      };
    })
  };
  const caches = { open: vi.fn(async () => cache), delete: vi.fn(async () => true) };
  vi.stubGlobal('caches', caches);
  return caches;
}

afterEach(() => vi.unstubAllGlobals());

describe('readShare', () => {
  it('reads the words and files another app shared', async () => {
    cacheWith({
      '/__share/meta': { text: 'look', url: 'https://x.test', files: [{ name: 'a.jpg', type: 'image/jpeg' }], receivedAt: 5 },
      '/__share/file/0': 'bytes'
    });

    const share = await readShare();

    expect(share).toMatchObject({ text: 'look', url: 'https://x.test', title: '', receivedAt: 5 });
    expect(share?.files[0]).toMatchObject({ name: 'a.jpg', type: 'image/jpeg' });
  });

  it('is null with nothing waiting, an empty share, no cache, or a cache that cannot be read', async () => {
    cacheWith({});
    expect(await readShare()).toBeNull();

    cacheWith({ '/__share/meta': {} });
    expect(await readShare()).toBeNull();

    vi.stubGlobal('caches', { open: vi.fn(async () => Promise.reject(new Error('blocked'))) });
    expect(await readShare()).toBeNull();

    vi.stubGlobal('caches', undefined);
    expect(await readShare()).toBeNull();
  });
});

describe('clearShare', () => {
  it('empties the cache, and shrugs off one it cannot', async () => {
    const caches = cacheWith({});
    await clearShare();
    expect(caches.delete).toHaveBeenCalledWith('tumbaland-share');

    vi.stubGlobal('caches', { delete: vi.fn(async () => Promise.reject(new Error('blocked'))) });
    await expect(clearShare()).resolves.toBeUndefined();
    vi.stubGlobal('caches', undefined);
    await expect(clearShare()).resolves.toBeUndefined();
  });
});

describe('sharedMessage and isMedia', () => {
  it('puts the link in once, and falls back to the title', () => {
    expect(sharedMessage({ title: 'T', text: 'see https://x.test', url: 'https://x.test' })).toBe('see https://x.test');
    expect(sharedMessage({ title: 'T', text: 'see', url: 'https://x.test' })).toBe('see\nhttps://x.test');
    expect(sharedMessage({ title: ' Watch ', text: '', url: '' })).toBe('Watch');
    expect(isMedia(new File([], 'a.mp4', { type: 'video/mp4' }))).toBe(true);
    expect(isMedia(new File([], 'a.pdf', { type: 'application/pdf' }))).toBe(false);
  });
});
