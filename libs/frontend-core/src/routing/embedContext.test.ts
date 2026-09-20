import { describe, it, expect } from 'vitest';
import {
  buildEmbeddedUrl,
  extractChildPath,
  joinShellPath,
  normalizeEmbedPath,
  readEmbedContext,
  safeUrl,
  toOrigin
} from './embedContext';

describe('normalizeEmbedPath', () => {
  it('defaults empty input to the root path', () => {
    expect(normalizeEmbedPath()).toBe('/');
    expect(normalizeEmbedPath(null)).toBe('/');
    expect(normalizeEmbedPath('')).toBe('/');
  });

  it('makes relative paths absolute and leaves absolute ones alone', () => {
    expect(normalizeEmbedPath('albums/1')).toBe('/albums/1');
    expect(normalizeEmbedPath('/albums/1')).toBe('/albums/1');
  });
});

describe('joinShellPath', () => {
  it('prefixes the child path with the app route', () => {
    expect(joinShellPath('/album', '/albums/1?page=2')).toBe('/album/albums/1?page=2');
  });

  it('collapses the child root onto the bare app route', () => {
    expect(joinShellPath('/album', '/')).toBe('/album');
    expect(joinShellPath('/album', '')).toBe('/album');
  });
});

describe('extractChildPath', () => {
  it('strips the app prefix and keeps the query string', () => {
    expect(extractChildPath('/album', '/album/albums/1', '?page=2')).toBe('/albums/1?page=2');
  });

  it('returns the root for the bare app route', () => {
    expect(extractChildPath('/album', '/album')).toBe('/');
  });
});

describe('toOrigin', () => {
  it('reduces a config URL to its origin', () => {
    expect(toOrigin('https://album.tumbaland.eu/some/path')).toBe('https://album.tumbaland.eu');
    expect(toOrigin('http://localhost:3002')).toBe('http://localhost:3002');
  });

  it('returns undefined for missing or unparseable URLs', () => {
    expect(toOrigin()).toBeUndefined();
    expect(toOrigin('')).toBeUndefined();
    expect(toOrigin('not a url')).toBeUndefined();
  });
});

describe('safeUrl', () => {
  it('resolves against a base and swallows parse errors', () => {
    expect(safeUrl('/x', 'https://a.example')?.href).toBe('https://a.example/x');
    expect(safeUrl('::::')).toBeUndefined();
  });
});

describe('buildEmbeddedUrl', () => {
  it('carries the embed flag and deep-linked path in the query string', () => {
    const url = new URL(buildEmbeddedUrl('https://album.tumbaland.eu', '/albums/1'));
    expect(url.origin).toBe('https://album.tumbaland.eu');
    expect(url.searchParams.get('embedded')).toBe('1');
    expect(url.searchParams.get('embedPath')).toBe('/albums/1');
  });

  it('falls back to the raw value when the app URL is unparseable', () => {
    expect(buildEmbeddedUrl('nonsense', '/x')).toBe('nonsense');
  });
});

describe('readEmbedContext', () => {
  it('is embedded only when framed and flagged', () => {
    expect(readEmbedContext('?embedded=1&embedPath=/albums/1', true)).toEqual({
      embedded: true,
      initialPath: '/albums/1'
    });
  });

  it('is not embedded when the params are present but the page is top-level', () => {
    expect(readEmbedContext('?embedded=1&embedPath=/albums/1', false).embedded).toBe(false);
  });

  it('is not embedded when framed without the flag', () => {
    expect(readEmbedContext('?embedPath=/albums/1', true).embedded).toBe(false);
  });

  it('defaults the initial path to the root', () => {
    expect(readEmbedContext('?embedded=1', true).initialPath).toBe('/');
  });
});
