import { useCallback, useState } from 'react';
import type { AlbumPickerProps } from '../components/thread/AlbumPicker';
import type { ChoosePhotosDialogProps } from '../components/thread/ChoosePhotosDialog';
import type { LightboxProps } from '../components/thread/Lightbox';
import { chatApi } from '../services/chatApi';
import { isVisualType } from '../services/voice';
import type { UseChatThreadResult } from './useChatThread';
import type { PhotoAlbum, PhotoAlbumChoice, ThreadMessage } from '../types';

interface Options {
  conversationId: string | undefined;
  thread: Pick<UseChatThreadResult, 'messages' | 'removeFromAlbum' | 'placeInAlbum' | 'setAppearance'>;
  onError: (message: string) => void;
}

/** Viewing sent media, choosing photos, and changing their album or the chat background. */
export function useThreadMedia({ conversationId, thread, onError }: Options) {
  const [viewing, setViewing] = useState<{ messageId: string; index: number } | null>(null);
  const [placing, setPlacing] = useState<{ messageId: string; fileIds?: string[] } | null>(null);
  const [choosing, setChoosing] = useState<{ messageId: string; mode: 'move' | 'remove' } | null>(null);
  // Keep IDs rather than attachment copies, so edits from other devices stay visible.
  const find = (id?: string) => thread.messages.find((message) => message.id === id);
  const photosOf = (id?: string) => (find(id)?.attachments ?? []).filter((photo) => isVisualType(photo.mimetype));
  const loadAlbums = useCallback(
    () => (conversationId ? chatApi.listAlbums(conversationId) : Promise.resolve([])),
    [conversationId]
  );

  const editAlbum = (messageId: string) => {
    if (photosOf(messageId).length > 1) setChoosing({ messageId, mode: 'move' });
    else setPlacing({ messageId });
  };
  const removeAlbum = (messageId: string) => {
    if (photosOf(messageId).filter((photo) => photo.albumId).length > 1) setChoosing({ messageId, mode: 'remove' });
    else void thread.removeFromAlbum(messageId).catch(() => onError('Could not remove it from the album. Try again.'));
  };

  const choosingPhotos =
    choosing?.mode === 'remove'
      ? photosOf(choosing.messageId).filter((photo) => photo.albumId)
      : photosOf(choosing?.messageId);
  const photoSelection: ChoosePhotosDialogProps = {
    open: Boolean(choosing && choosingPhotos.length > 0),
    title: choosing?.mode === 'remove' ? 'Take which photos out?' : 'Which photos?',
    photos: choosingPhotos,
    initial: choosingPhotos.map((photo) => photo.fileId),
    confirmLabel: (count) =>
      choosing?.mode === 'remove' ? `Take ${count} out of the album` : count === 1 ? 'Next' : `Next (${count})`,
    onConfirm: async (fileIds) => {
      if (!choosing) return;
      const some = fileIds.length < choosingPhotos.length ? fileIds : undefined;
      if (choosing.mode === 'remove') await thread.removeFromAlbum(choosing.messageId, some);
      else setPlacing({ messageId: choosing.messageId, fileIds: some });
      setChoosing(null);
    },
    onClose: () => setChoosing(null)
  };

  const placingFile = find(placing?.messageId)?.attachments.find((photo) =>
    placing?.fileIds ? placing.fileIds.includes(photo.fileId) : photo.albumId
  );
  const current: PhotoAlbum = placingFile?.albumId
    ? { mode: 'album', albumId: placingFile.albumId, albumName: placingFile.albumName ?? null }
    : { mode: 'off', albumId: null, albumName: null };
  const place = async (choice: PhotoAlbumChoice) => {
    if (!placing) return;
    if (choice.mode === 'off') await thread.removeFromAlbum(placing.messageId, placing.fileIds);
    else
      await thread.placeInAlbum(
        placing.messageId,
        'albumId' in choice ? { albumId: choice.albumId } : { newAlbumName: choice.newAlbumName },
        placing.fileIds
      );
  };
  const albumPicker: AlbumPickerProps = {
    open: Boolean(placing),
    onClose: () => setPlacing(null),
    purpose: 'photo',
    current,
    loadAlbums,
    onChoose: place
  };

  const viewingMessage = find(viewing?.messageId);
  const media = photosOf(viewing?.messageId);
  const index = viewingMessage && viewing ? media.indexOf(viewingMessage.attachments[viewing.index]!) : -1;
  const stored =
    viewingMessage &&
    !viewingMessage.deletedAt &&
    viewingMessage.delivery !== 'pending' &&
    viewingMessage.delivery !== 'failed';
  const makeBackground = async (fileId: string) => {
    try {
      await thread.setAppearance({ backgroundFileId: fileId });
      setViewing(null);
    } catch {
      onError('Could not set that as the background. Try again.');
    }
  };
  const lightbox: LightboxProps = {
    attachments: media,
    index: viewingMessage && index >= 0 ? index : null,
    onClose: () => setViewing(null),
    onEditAlbum: stored
      ? (at) => {
          const fileId = media[at]?.fileId;
          if (fileId) setPlacing({ messageId: viewingMessage.id, fileIds: [fileId] });
        }
      : undefined,
    onUseAsBackground: stored
      ? (at) => {
          const fileId = media[at]?.fileId;
          if (fileId) void makeBackground(fileId);
        }
      : undefined
  };

  return {
    openMedia: (message: ThreadMessage, at: number) => setViewing({ messageId: message.id, index: at }),
    editAlbum,
    removeAlbum,
    photoSelection,
    albumPicker,
    lightbox
  };
}
