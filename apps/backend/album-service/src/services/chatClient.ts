import { logger } from '@tumbaland/backend-core';

/**
 * chat-service's internal routes, for the one thing Album tells Chat: that
 * someone is working on a collage made from a chat.
 *
 * Prefers the container-network address and falls back to the public one, the
 * same convention chat's own album client follows.
 */
const baseUrl = (): string =>
  (process.env.CHAT_INTERNAL_URL || process.env.CHAT_API_URL || 'http://localhost:4004').replace(/\/$/, '');

const REQUEST_TIMEOUT_MS = 10_000;

export interface CollageActivity {
  conversationId: string;
  collageId: string;
  title: string;
  userId: string;
  name: string;
  /** Who has the collage open now, so they are not told about it. */
  presentUserIds: string[];
}

/** Never throws: a missed nudge costs a buzz, nothing else. */
export async function reportCollageActivity(activity: CollageActivity): Promise<void> {
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  if (!token) return;

  try {
    const response = await fetch(`${baseUrl()}/internal/collage-activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': token,
        'x-service-id': process.env.SERVICE_NAME || 'album-service'
      },
      body: JSON.stringify(activity),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    if (!response.ok) logger.warn('chat-service collage activity call failed', { status: response.status });
  } catch (error) {
    logger.warn('Could not reach chat-service about collage activity', { error: (error as Error).message });
  }
}
