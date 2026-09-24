import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearShare, isMedia, readShare, sharedMessage } from './sharedInbox';

/** Just enough of CacheStorage for one named cache, laid out the way sw.js writes it. */
function fakeCaches(entries: Record<string, Response>) {
  const store = new Map(Object.entries(entries));
  const cache = { match: async (key: string) => store.get(key)?.clone() };
  const storage = {
    open: vi.fn(async () => cache),
    delete: vi.fn(async () => {
      store.clear();
      return true;
    })
  };
  vi.stubGlobal('caches', storage);
  return storage;
}

const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('sharedMessage', () => {
  it('uses the text when the link is already in it, as YouTube sends it', () => {
    expect(sharedMessage({ title: 'Watch on YouTube', text: 'https://youtu.be/abc', url: '' })).toBe('https://youtu.be/abc');
  });

  it('adds the url under the text when the text does not carry it', () => {
    expect(sharedMessage({ title: '', text: 'Look at this', url: 'https://example.com' })).toBe(
      'Look at this\nhttps://example.com'
    );
  });

  it('does not repeat a link sent in both fields', () => {
    expect(sharedMessage({ title: '', text: 'https://example.com', url: 'https://example.com' })).toBe('https://example.com');
  });

  it('falls back to the title when nothing else came', () => {
    expect(sharedMessage({ title: 'A title', text: ' ', url: '' })).toBe('A title');
  });
});

describe('readShare', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('is null when nothing is waiting', async () => {
    fakeCaches({});
    expect(await readShare()).toBeNull();
  });

  it('reads the text and rebuilds each file with its name and type', async () => {
    fakeCaches({
      '/__share/meta': json({
        title: '',
        text: 'hello',
        url: '',
        files: [{ name: 'beach.jpg', type: 'image/jpeg' }],
        receivedAt: 1
      }),
      '/__share/file/0': new Response('bytes')
    });

    const share = await readShare();
    expect(share?.text).toBe('hello');
    expect(share?.files).toHaveLength(1);
    expect(share?.files[0]?.name).toBe('beach.jpg');
    expect(share?.files[0]?.type).toBe('image/jpeg');
  });

  it('is null for a share with nothing in it', async () => {
    fakeCaches({ '/__share/meta': json({ title: '', text: '', url: '', files: [] }) });
    expect(await readShare()).toBeNull();
  });

  it('is null where the browser has no cache storage', async () => {
    vi.stubGlobal('caches', undefined);
    expect(await readShare()).toBeNull();
  });
});

it('clearShare drops the whole cache', async () => {
  const storage = fakeCaches({ '/__share/meta': json({ text: 'x' }) });
  await clearShare();
  expect(storage.delete).toHaveBeenCalledWith('tumbaland-share');
});

it('isMedia takes photos and videos only', () => {
  expect(isMedia(new File([''], 'a.jpg', { type: 'image/jpeg' }))).toBe(true);
  expect(isMedia(new File([''], 'a.mp4', { type: 'video/mp4' }))).toBe(true);
  expect(isMedia(new File([''], 'a.pdf', { type: 'application/pdf' }))).toBe(false);
});
