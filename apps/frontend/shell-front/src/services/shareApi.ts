import { createApiClient } from '@tumbaland/frontend-core';
import { getGlobalConfig } from '../config/ConfigProvider';

/**
 * The two lists the share page offers as destinations.
 *
 * No `onUnauthorized`: the page sits behind the session gate, and a failed
 * list only hides its section.
 */
const chatApi = createApiClient({ baseUrl: () => getGlobalConfig().CHAT_API_URL ?? '' });
const albumApi = createApiClient({ baseUrl: () => getGlobalConfig().ALBUM_API_URL ?? '' });

interface Envelope<T> {
  data: T;
}

export interface ShareConversation {
  id: string;
  title: string;
  members: Array<{ userId: string; name: string; email: string }>;
}

export interface ShareAlbum {
  _id: string;
  name: string;
  photoCount: number;
}

/**
 * The same call chat opens with, which creates a group's conversation when it
 * is missing. Listing alone would offer nobody to someone who has never
 * opened chat.
 */
export const listConversations = async (): Promise<ShareConversation[]> => {
  const json = await chatApi.post<Envelope<ShareConversation[]>>('/api/chat/conversations/mine');
  return json?.data ?? [];
};

/** Most recently changed first, which is usually the album a new photo belongs in. */
export const listAlbums = async (groupId?: string): Promise<ShareAlbum[]> => {
  const json = await albumApi.get<Envelope<{ albums?: ShareAlbum[] }>>('/api/albums', {
    // No covers: signing a URL per album is wasted on a list of names.
    params: { ...(groupId ? { groupId } : {}), limit: 100, includeCover: false }
  });
  return json?.data?.albums ?? [];
};

/** A conversation with no title is named after whoever else is in it, as chat names it. */
export function conversationName(conversation: ShareConversation, currentUserId: string): string {
  if (conversation.title) return conversation.title;
  const others = conversation.members.filter((member) => member.userId !== currentUserId);
  if (others.length === 0) return 'Just you';
  return others.map((member) => member.name || member.email).join(', ');
}
