import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@tumbaland/frontend-core';
import { chatApi, newClientId } from '../services/chatApi';
import { captureVideoPoster, downscaleImage } from '../services/mediaPrep';
import type { Attachment, PendingUpload } from '../types';

/**
 * Files the composer is holding, and their journey to storage.
 *
 * The bytes never touch chat-service. Each file is prepared in the browser,
 * then PUT straight to file-service with a short-lived signed URL, and only the
 * resulting `fileId` travels with the message. That keeps a 95 MB video off
 * the service's heap and means an upload can be in flight while the person
 * keeps typing.
 *
 * Upload uses `XMLHttpRequest` rather than `fetch` for one reason: progress.
 * `fetch` cannot report how far a request body has been sent, and a phone
 * uploading a clip over mobile data with no progress bar looks broken.
 */

export interface UseAttachmentUploadsResult {
  uploads: PendingUpload[];
  /** True while anything is still preparing or uploading. */
  busy: boolean;
  add: (files: FileList | File[]) => Promise<void>;
  remove: (id: string) => void;
  /** The finished attachments, for sending. Clears the queue. */
  take: () => Attachment[];
  clear: () => void;
}

function putWithProgress(url: string, blob: Blob, mimetype: string, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    request.setRequestHeader('Content-Type', mimetype);

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${request.status})`));
    request.onerror = () => reject(new Error('Upload failed'));
    request.onabort = () => reject(new Error('Upload cancelled'));

    request.send(blob);
  });
}

export function useAttachmentUploads(conversationId: string | undefined): UseAttachmentUploadsResult {
  const [uploads, setUploads] = useState<PendingUpload[]>([]);

  // Object URLs are revoked on unmount rather than per-upload, because the
  // preview stays on screen until the message is sent. A leaked one holds the
  // whole file in memory.
  const previews = useRef(new Set<string>());
  useEffect(
    () => () => {
      for (const url of previews.current) URL.revokeObjectURL(url);
      previews.current.clear();
    },
    []
  );

  const patch = useCallback((id: string, changes: Partial<PendingUpload>) => {
    setUploads((current) => current.map((upload) => (upload.id === id ? { ...upload, ...changes } : upload)));
  }, []);

  const add = useCallback(
    async (files: FileList | File[]) => {
      if (!conversationId) return;

      for (const file of Array.from(files)) {
        const id = newClientId();
        const previewUrl = URL.createObjectURL(file);
        previews.current.add(previewUrl);

        setUploads((current) => [
          ...current,
          { id, name: file.name, mimetype: file.type, previewUrl, progress: 0, status: 'preparing' }
        ]);

        try {
          const isVideo = file.type.startsWith('video/');

          // Shrink a phone photo, or take a still from a clip. Both are
          // deliberately the browser's job; see mediaPrep.
          const prepared = isVideo
            ? { blob: file, filename: file.name, mimetype: file.type }
            : await downscaleImage(file);
          const poster = isVideo ? await captureVideoPoster(file) : null;

          const ticket = await chatApi.attachmentUploadUrl(conversationId, {
            filename: prepared.filename,
            mimetype: prepared.mimetype,
            sizeBytes: prepared.blob.size
          });

          patch(id, { status: 'uploading' });
          await putWithProgress(ticket.uploadUrl, prepared.blob, prepared.mimetype, (progress) =>
            patch(id, { progress })
          );

          // The poster is a second, separate upload into the same folder.
          let posterFileId: string | null = null;
          if (poster?.blob && ticket.posterUploadFileId) {
            try {
              const posterTicket = await chatApi.attachmentUploadUrl(conversationId, {
                filename: 'poster.jpg',
                mimetype: 'image/jpeg',
                sizeBytes: poster.blob.size
              });
              await putWithProgress(posterTicket.uploadUrl, poster.blob, 'image/jpeg', () => {});
              posterFileId = posterTicket.fileId;
            } catch (error) {
              // A clip without a poster still plays.
              logger.warn('Video poster upload failed', { error: (error as Error).message });
            }
          }

          // The display copy. Also what converts an iPhone's HEIC into
          // something Android can render, so it is requested before sending.
          const thumbnailFileId = isVideo
            ? null
            : await chatApi.requestThumbnail(conversationId, ticket.fileId, prepared.mimetype);

          const attachment: Attachment = {
            fileId: ticket.fileId,
            thumbnailFileId,
            posterFileId,
            mimetype: prepared.mimetype,
            sizeBytes: prepared.blob.size,
            width: poster?.width ?? prepared.width ?? null,
            height: poster?.height ?? prepared.height ?? null,
            durationMs: poster?.durationMs ?? null
          };

          patch(id, { status: 'done', progress: 100, attachment });
        } catch (error) {
          logger.warn('Chat attachment upload failed', { error: (error as Error).message });
          patch(id, { status: 'failed', error: (error as Error).message });
        }
      }
    },
    [conversationId, patch]
  );

  const remove = useCallback((id: string) => {
    setUploads((current) => {
      const going = current.find((upload) => upload.id === id);
      if (going) {
        URL.revokeObjectURL(going.previewUrl);
        previews.current.delete(going.previewUrl);
      }
      return current.filter((upload) => upload.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    setUploads((current) => {
      for (const upload of current) {
        URL.revokeObjectURL(upload.previewUrl);
        previews.current.delete(upload.previewUrl);
      }
      return [];
    });
  }, []);

  /**
   * Hands over the finished attachments and empties the queue.
   *
   * Anything still uploading or failed is dropped rather than sent: a message
   * carrying a fileId whose bytes never arrived would render as a permanently
   * broken image.
   */
  const take = useCallback((): Attachment[] => {
    const ready = uploads
      .filter((upload) => upload.status === 'done' && upload.attachment)
      .map((upload) => upload.attachment!);
    clear();
    return ready;
  }, [uploads, clear]);

  return {
    uploads,
    busy: uploads.some((upload) => upload.status === 'preparing' || upload.status === 'uploading'),
    add,
    remove,
    take,
    clear
  };
}
