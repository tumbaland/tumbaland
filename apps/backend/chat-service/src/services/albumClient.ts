import { logger } from '@tumbaland/backend-core';

/**
 * album-service's internal routes, which is how chat photos reach Album.
 *
 * Prefers the container-network address and falls back to the public one, the
 * same convention the group and payment clients follow; local dev only sets the
 * public one.
 */
const baseUrl = (): string =>
  (process.env.ALBUM_INTERNAL_URL || process.env.ALBUM_API_URL || 'http://localhost:4002').replace(/\/$/, '');

const REQUEST_TIMEOUT_MS = 10_000;

/** The album was deleted, or is not in this group any more. */
export class AlbumGoneError extends Error {
  constructor() {
    super('That album no longer exists');
    this.name = 'AlbumGoneError';
  }
}

export interface AlbumOption {
  id: string;
  name: string;
  photoCount: number;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  if (!token) throw new Error('INTERNAL_SERVICE_TOKEN is not configured');

  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-internal-token': token,
      'x-service-id': process.env.SERVICE_NAME || 'chat-service'
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (response.status === 404) throw new AlbumGoneError();
  if (!response.ok) {
    logger.warn('album-service call failed', { method, path, status: response.status });
    throw new Error(`album-service ${method} ${path} -> ${response.status}`);
  }
  const json = (await response.json()) as { data: T };
  return json.data;
}

const group = (groupId: string) => `/internal/groups/${encodeURIComponent(groupId)}/albums`;

export const listAlbums = (groupId: string) => call<AlbumOption[]>('GET', group(groupId));

/** The album, or null when it is gone or belongs to another group. */
export async function getAlbum(groupId: string, albumId: string): Promise<AlbumOption | null> {
  try {
    return await call<AlbumOption>('GET', `${group(groupId)}/${encodeURIComponent(albumId)}`);
  } catch (error) {
    if (error instanceof AlbumGoneError) return null;
    throw error;
  }
}

export const createAlbum = (groupId: string, userId: string, name: string) =>
  call<AlbumOption>('POST', group(groupId), { name, userId });

export interface ChatPhotoInput {
  groupId: string;
  albumId: string;
  conversationId: string;
  messageId: string;
  fileId: string;
  thumbnailFileId?: string | null;
  mimetype: string;
  size: number;
  width?: number | null;
  height?: number | null;
  takenAt: string;
}

/** Throws AlbumGoneError when the chosen album has been deleted. */
export const addChatPhoto = (input: ChatPhotoInput) =>
  call<{ photoId: string; albumId: string; albumName: string }>('POST', '/internal/chat-photos', input);

/** Moves already-saved files to another album; throws AlbumGoneError when it is gone. */
export const moveChatPhotos = (messageId: string, input: { groupId: string; albumId: string; fileIds?: string[] }) =>
  call<{ moved: number; albumId: string; albumName: string }>(
    'POST',
    `/internal/chat-photos/${encodeURIComponent(messageId)}/move`,
    input
  );

export const removeChatPhotos = (messageId: string, fileId?: string) =>
  call<{ removed: number }>(
    'DELETE',
    `/internal/chat-photos/${encodeURIComponent(messageId)}${fileId ? `?fileId=${encodeURIComponent(fileId)}` : ''}`
  );

export interface ChatCollageInput {
  clientId: string;
  userId: string;
  albumId: string;
  conversationId: string;
  title: string;
}

/** A collage on the chat's album; throws AlbumGoneError when that album has been deleted. */
export const createCollage = (groupId: string, input: ChatCollageInput) =>
  call<{ id: string; title: string }>('POST', `/internal/groups/${encodeURIComponent(groupId)}/collages`, input);
