import { useCallback, type Dispatch } from 'react';
import { logger } from '@tumbaland/frontend-core';
import { chatApi } from '../services/chatApi';
import type { ThreadAction } from './threadReducer';
import type { AlbumPlacement, Appearance, PhotoAlbum, PhotoAlbumChoice } from '../types';

/**
 * Everything else a person can do to a message or to the conversation itself:
 * react, edit, unsend, move photos between albums, change the look, start a
 * collage. Each answers with the new state, shown straight away; the stream
 * brings the same change to everyone else.
 */
export function useThreadActions(
  conversationId: string | undefined,
  dispatch: Dispatch<ThreadAction>,
  setPhotoAlbumState: (album: PhotoAlbum) => void,
  setAppearanceState: (appearance: Appearance) => void
) {
  const react = useCallback(
    async (messageId: string, emoji: string) => {
      if (!conversationId) return;
      try {
        const updated = await chatApi.toggleReaction(conversationId, messageId, emoji);
        dispatch({ type: 'updated', message: updated });
      } catch (error) {
        logger.warn('Reaction failed', { error: (error as Error).message });
      }
    },
    [conversationId, dispatch]
  );

  const edit = useCallback(
    async (messageId: string, body: string) => {
      if (!conversationId) return;
      const updated = await chatApi.editMessage(conversationId, messageId, body);
      dispatch({ type: 'updated', message: updated });
    },
    [conversationId, dispatch]
  );

  const remove = useCallback(
    async (messageId: string) => {
      if (!conversationId) return;
      await chatApi.deleteMessage(conversationId, messageId);
      dispatch({ type: 'removed', id: messageId });
    },
    [conversationId, dispatch]
  );

  const setPhotoAlbum = useCallback(
    async (choice: PhotoAlbumChoice) => {
      if (!conversationId) return;
      setPhotoAlbumState(await chatApi.setPhotoAlbum(conversationId, choice));
    },
    [conversationId, setPhotoAlbumState]
  );

  const startCollage = useCallback(
    async (title: string, clientId: string) => {
      if (!conversationId) return null;
      const message = await chatApi.startCollage(conversationId, { clientId, title });
      dispatch({ type: 'received', message });
      return message;
    },
    [conversationId, dispatch]
  );

  const setAppearance = useCallback(
    async (change: { theme?: string; backgroundFileId?: string | null }) => {
      if (!conversationId) return;
      setAppearanceState(await chatApi.setAppearance(conversationId, change));
    },
    [conversationId, setAppearanceState]
  );

  const removeFromAlbum = useCallback(
    async (messageId: string, fileIds?: string[]) => {
      if (!conversationId) return;
      dispatch({ type: 'updated', message: await chatApi.removeFromAlbum(conversationId, messageId, fileIds) });
    },
    [conversationId, dispatch]
  );

  const placeInAlbum = useCallback(
    async (messageId: string, placement: AlbumPlacement, fileIds?: string[]) => {
      if (!conversationId) return;
      dispatch({ type: 'updated', message: await chatApi.placeInAlbum(conversationId, messageId, placement, fileIds) });
    },
    [conversationId, dispatch]
  );

  return { react, edit, remove, setPhotoAlbum, startCollage, setAppearance, removeFromAlbum, placeInAlbum };
}
