/**
 * Whatever another app shared into Tumbaland, waiting for a place to go.
 *
 * A copy of shell-front's sharedInbox.ts; change all three together. The
 * shell's service worker writes it (see `receiveShare` in shell-front's
 * public/sw.js) and the shell's /share page sends the person here with
 * `?shared=1`. This module runs inside the shell's page, on its origin, so it
 * reads the same cache. Standalone on its own origin it finds nothing.
 */

const SHARE_CACHE = 'tumbaland-share';

export interface SharedItem {
  title: string;
  text: string;
  url: string;
  files: File[];
  receivedAt: number;
}

interface SharedMeta {
  title?: string;
  text?: string;
  url?: string;
  files?: Array<{ name: string; type: string }>;
  receivedAt?: number;
}

/** The waiting share, or null when there is none or it cannot be read. */
export async function readShare(): Promise<SharedItem | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(SHARE_CACHE);
    const stored = await cache.match('/__share/meta');
    if (!stored) return null;
    const meta = (await stored.json()) as SharedMeta;

    const files: File[] = [];
    for (const [index, file] of (meta.files ?? []).entries()) {
      const body = await cache.match(`/__share/file/${index}`);
      if (body) files.push(new File([await body.blob()], file.name, { type: file.type }));
    }

    const share = {
      title: meta.title ?? '',
      text: meta.text ?? '',
      url: meta.url ?? '',
      files,
      receivedAt: meta.receivedAt ?? Date.now()
    };
    return share.text || share.url || share.title || files.length > 0 ? share : null;
  } catch {
    return null;
  }
}

export async function clearShare(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    await caches.delete(SHARE_CACHE);
  } catch {
    // Left behind, it is replaced by the next share anyway.
  }
}

/**
 * The words a share turns into in a message.
 *
 * Apps put the link in different fields: YouTube, Instagram and Facebook send
 * it as the text, others as the url, some in both. The link appears once
 * either way. The title only stands in when there is nothing else, because
 * next to a link it is usually boilerplate like "Watch this on YouTube".
 */
export function sharedMessage(share: Pick<SharedItem, 'title' | 'text' | 'url'>): string {
  let body = share.text.trim();
  const url = share.url.trim();
  if (url && !body.includes(url)) body = body ? `${body}\n${url}` : url;
  return body || share.title.trim();
}

/** The files chat and album can take. Anything else is left out, and said so. */
export function isMedia(file: File): boolean {
  return file.type.startsWith('image/') || file.type.startsWith('video/');
}
