import { createApiClient } from '@tumbaland/frontend-core';
import { getGlobalConfig } from '../config/ConfigProvider';
import type {
  AlbumOption,
  Appearance,
  AlbumPlacement,
  Attachment,
  Conversation,
  CallSignalData,
  CallView,
  ConversationDetail,
  IceConfig,
  Message,
  MessageEffect,
  MessagePage,
  PhotoAlbum,
  PhotoAlbumChoice,
  UploadTicket
} from '../types';

const client = createApiClient({
  baseUrl: () => getGlobalConfig().CHAT_API_URL!,
  onUnauthorized: () => {
    const { AUTH_FRONT_URL } = getGlobalConfig();
    if (AUTH_FRONT_URL) {
      window.location.href = `${AUTH_FRONT_URL}?redirect_uri=${encodeURIComponent(window.location.href)}`;
    }
  }
});

/**
 * The idempotency key for a send.
 *
 * Generated once per composed message and reused on every retry, so a dropped
 * response cannot become a duplicate message. `randomUUID` needs a secure
 * context, which an installed PWA always has, but the fallback keeps the app
 * working on a plain-HTTP dev origin rather than throwing at the one moment
 * the user pressed send.
 */
export function newClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface SendPayload {
  clientId: string;
  body?: string;
  attachments?: Attachment[];
  replyTo?: string | null;
  effect?: MessageEffect;
  /** "Not this one": keep this send out of the album. */
  skipAlbum?: boolean;
  /** Some of its photos kept out of the album, the rest going in. */
  skipAlbumFileIds?: string[];
}

function attachmentRequest(attachment: Attachment) {
  const { fileId, posterFileId, thumbnailFileId, mimetype, name, sizeBytes, width, height, durationMs } = attachment;
  return {
    fileId,
    mimetype,
    sizeBytes,
    ...(name ? { name } : {}),
    ...(posterFileId != null ? { posterFileId } : {}),
    ...(thumbnailFileId != null ? { thumbnailFileId } : {}),
    ...(width != null ? { width } : {}),
    ...(height != null ? { height } : {}),
    ...(durationMs != null ? { durationMs } : {})
  };
}

export const chatApi = {
  async listConversations(): Promise<Conversation[]> {
    const json = await client.get<{ data: Conversation[] }>('/api/chat/conversations');
    return json?.data ?? [];
  },

  /**
   * The caller's conversations, creating any that are missing.
   *
   * What the app opens with. Chat is group-scoped and a group does not create
   * a conversation by itself, so listing alone would show an empty screen with
   * no way forward. The groups come from the session on the server, so this
   * takes no body and cannot reach a group the caller is not in.
   */
  async ensureMyConversations(): Promise<Conversation[]> {
    const json = await client.post<{ data: Conversation[] }>('/api/chat/conversations/mine');
    return json?.data ?? [];
  },

  async ensureConversation(groupId: string, title?: string): Promise<Conversation> {
    const json = await client.post<{ data: Conversation }>('/api/chat/conversations', { groupId, title });
    return json.data;
  },

  /** Members with their pictures, and how far each of the others has read. */
  async getConversation(conversationId: string): Promise<ConversationDetail> {
    const json = await client.get<{ data: ConversationDetail }>(`/api/chat/conversations/${conversationId}`);
    return json.data;
  },

  async unreadCount(): Promise<number> {
    const json = await client.get<{ data: { unread: number } }>('/api/chat/unread');
    return json?.data?.unread ?? 0;
  },

  async listMessages(
    conversationId: string,
    params: { before?: string; limit?: number } = {}
  ): Promise<MessagePage> {
    const json = await client.get<{ data: MessagePage }>(
      `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
      { params }
    );
    return json?.data ?? { messages: [], nextCursor: null };
  },

  async sendMessage(conversationId: string, payload: SendPayload): Promise<Message> {
    const json = await client.post<{ data: Message }>(
      `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        ...payload,
        attachments: payload.attachments?.map(attachmentRequest)
      }
    );
    return json.data;
  },

  /** "Make a collage together": makes it on the chat's album and posts its card. */
  async startCollage(conversationId: string, payload: { clientId: string; title: string }): Promise<Message> {
    const json = await client.post<{ data: Message }>(
      `/api/chat/conversations/${encodeURIComponent(conversationId)}/collages`,
      payload
    );
    return json.data;
  },

  async editMessage(conversationId: string, messageId: string, body: string): Promise<Message> {
    const json = await client.patch<{ data: Message }>(
      `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
      { body }
    );
    return json.data;
  },

  async deleteMessage(conversationId: string, messageId: string): Promise<void> {
    await client.delete(
      `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`
    );
  },

  async toggleReaction(conversationId: string, messageId: string, emoji: string): Promise<Message> {
    const json = await client.put<{ data: Message }>(
      `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(
        messageId
      )}/reactions`,
      { emoji }
    );
    return json.data;
  },

  /** Changes the theme or the background photo (null removes it), for everyone in the conversation. */
  async setAppearance(
    conversationId: string,
    change: { theme?: string; backgroundFileId?: string | null }
  ): Promise<Appearance> {
    const json = await client.put<{ data: Appearance }>(
      `/api/chat/conversations/${encodeURIComponent(conversationId)}/appearance`,
      change
    );
    return json.data;
  },

  /** The group's albums, for the "photos go to" picker. */
  async listAlbums(conversationId: string): Promise<AlbumOption[]> {
    const json = await client.get<{ data: AlbumOption[] }>(
      `/api/chat/conversations/${encodeURIComponent(conversationId)}/albums`
    );
    return json?.data ?? [];
  },

  /** Where this conversation's photos go, for everyone in it. */
  async setPhotoAlbum(conversationId: string, choice: PhotoAlbumChoice): Promise<PhotoAlbum> {
    const json = await client.put<{ data: PhotoAlbum }>(
      `/api/chat/conversations/${encodeURIComponent(conversationId)}/photo-album`,
      choice
    );
    return json.data;
  },

  /** Takes a message's files, or some of them, back out of their album. They stay in chat. */
  async removeFromAlbum(conversationId: string, messageId: string, fileIds?: string[]): Promise<Message> {
    const query = fileIds?.length
      ? `?${fileIds.map((fileId) => `fileId=${encodeURIComponent(fileId)}`).join('&')}`
      : '';
    const json = await client.delete<{ data: Message }>(
      `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/album${query}`
    );
    return json.data;
  },

  /** Puts a message's files, or some of them, in another album. */
  async placeInAlbum(
    conversationId: string,
    messageId: string,
    placement: AlbumPlacement,
    fileIds?: string[]
  ): Promise<Message> {
    const json = await client.put<{ data: Message }>(
      `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/album`,
      { ...placement, ...(fileIds?.length ? { fileIds } : {}) }
    );
    return json.data;
  },

  async markRead(conversationId: string, lastReadMessageId?: string): Promise<void> {
    await client.post(`/api/chat/conversations/${encodeURIComponent(conversationId)}/read`, {
      lastReadMessageId
    });
  },

  /**
   * Fire and forget. A failed typing notice is not worth surfacing, and
   * throwing would put an error in the console on every keystroke burst.
   */
  async sendTyping(conversationId: string): Promise<void> {
    try {
      await client.post(`/api/chat/conversations/${encodeURIComponent(conversationId)}/typing`);
    } catch {
      // Ignored on purpose.
    }
  },

  async search(term: string, conversationId?: string): Promise<Message[]> {
    const json = await client.get<{ data: Message[] }>('/api/chat/search', {
      params: { q: term, conversationId }
    });
    return json?.data ?? [];
  },

  async attachmentUploadUrl(
    conversationId: string,
    file: { filename: string; mimetype: string; sizeBytes: number }
  ): Promise<UploadTicket> {
    const json = await client.post<{ data: UploadTicket }>(
      `/api/chat/conversations/${encodeURIComponent(conversationId)}/attachments/upload-url`,
      file
    );
    return json.data;
  },

  /**
   * Asks the service to make the display copy of an uploaded image.
   *
   * Never allowed to block a send: a failure comes back as a null id and the
   * client falls back to showing the original.
   */
  async requestThumbnail(conversationId: string, fileId: string, mimetype: string): Promise<string | null> {
    try {
      const json = await client.post<{ data: { thumbnailFileId: string | null } }>(
        `/api/chat/conversations/${encodeURIComponent(conversationId)}/attachments/thumbnail`,
        { fileId, mimetype }
      );
      return json.data.thumbnailFileId;
    } catch {
      return null;
    }
  },

  /** STUN and TURN servers for a call. Fresh relay credentials every time, so never cached. */
  async iceServers(): Promise<IceConfig> {
    const json = await client.get<{ data: IceConfig }>('/api/chat/calls/ice-servers');
    return json.data;
  },

  /** The call ringing or running for the signed-in person, if any. */
  async currentCall(): Promise<CallView | null> {
    const json = await client.get<{ data: CallView | null }>('/api/chat/calls/current');
    return json?.data ?? null;
  },

  async startCall(conversationId: string, deviceId: string): Promise<CallView> {
    const json = await client.post<{ data: CallView }>(
      `/api/chat/conversations/${encodeURIComponent(conversationId)}/calls`,
      { deviceId }
    );
    return json.data;
  },

  async acceptCall(callId: string, deviceId: string): Promise<CallView> {
    const json = await client.post<{ data: CallView }>(`/api/chat/calls/${encodeURIComponent(callId)}/accept`, {
      deviceId
    });
    return json.data;
  },

  async declineCall(callId: string): Promise<void> {
    await client.post(`/api/chat/calls/${encodeURIComponent(callId)}/decline`, {});
  },

  async endCall(callId: string): Promise<void> {
    await client.post(`/api/chat/calls/${encodeURIComponent(callId)}/end`, {});
  },

  async sendSignal(callId: string, deviceId: string, data: CallSignalData): Promise<void> {
    await client.post(`/api/chat/calls/${encodeURIComponent(callId)}/signal`, { deviceId, data });
  },

  /** The URL the EventSource opens. Absolute, since the API is another origin. */
  streamUrl(): string {
    return `${getGlobalConfig().CHAT_API_URL}/api/chat/stream`;
  }
};
