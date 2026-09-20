/**
 * Helpers shared by both sides of the shell/child iframe bridge.
 *
 * The child's initial path travels in the iframe `src` rather than over
 * postMessage so the app boots straight into the deep-linked page instead of
 * flashing its default route first. Every later navigation goes over
 * postMessage — the `src` must stay stable or the child remounts.
 */

export const EMBED_FLAG = 'embedded';
export const EMBED_PATH = 'embedPath';

export interface EmbedContext {
  embedded: boolean;
  initialPath: string;
}

/** Path the child router starts on: always absolute, defaults to the root. */
export const normalizeEmbedPath = (path?: string | null): string => {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
};

/** `/album` + `/albums/1?x=2` -> `/album/albums/1?x=2` (root path -> `/album`). */
export const joinShellPath = (appRoute: string, childPath: string): string => {
  const path = normalizeEmbedPath(childPath);
  return path === '/' ? appRoute : `${appRoute}${path}`;
};

/** Everything after the app prefix, e.g. `/album/albums/1` -> `/albums/1`. */
export const extractChildPath = (appRoute: string, shellPath: string, search = ''): string =>
  normalizeEmbedPath(shellPath.slice(appRoute.length) + search);

/** Config values are full URLs; postMessage needs a bare origin. */
export const toOrigin = (url?: string): string | undefined => {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
};

export const safeUrl = (url: string, base?: string): URL | undefined => {
  try {
    return new URL(url, base);
  } catch {
    return undefined;
  }
};

/** Iframe `src` for an app, carrying the embed flag and the deep-linked path. */
export const buildEmbeddedUrl = (appUrl: string, childPath: string): string => {
  const url = safeUrl(appUrl);
  if (!url) return appUrl;
  url.searchParams.set(EMBED_FLAG, '1');
  url.searchParams.set(EMBED_PATH, normalizeEmbedPath(childPath));
  return url.toString();
};

/**
 * Read on the child side. Embedded only when actually framed *and* flagged, so
 * a direct visit to album.tumbaland.eu always gets a real BrowserRouter even if
 * someone pastes the query params.
 */
export const readEmbedContext = (
  search: string = typeof window === 'undefined' ? '' : window.location.search,
  isFramed: boolean = typeof window !== 'undefined' && window.self !== window.top
): EmbedContext => {
  const params = new URLSearchParams(search);
  return {
    embedded: isFramed && params.get(EMBED_FLAG) === '1',
    initialPath: normalizeEmbedPath(params.get(EMBED_PATH))
  };
};
