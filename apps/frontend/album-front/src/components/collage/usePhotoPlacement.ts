import { useCallback } from 'react';
import { CollageDoc, isVideoType } from '@tumbaland/collage-core';
import type { CollageEditor } from '../../hooks/useCollageEditor';
import type { AlbumPhoto } from './CollagePhotoTray';

/**
 * Longest edge of a newly placed photo, as a fraction of the canvas' shorter
 * side. Small enough that several photos fit before anyone has to resize.
 */
const PLACED_PHOTO_SCALE = 0.22;

/** A video's own size, read from the file when the album never stored it. */
const readVideoSize = (src: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight });
    video.onerror = () => reject(new Error('Could not read the video'));
    video.src = src;
  });

/**
 * Puts an album photo on the canvas, sized by its own proportions: where it
 * was dropped, or in the middle. A photo with no stored size is measured from
 * the file first.
 */
export const usePhotoPlacement = (doc: CollageDoc | null | undefined, editor: CollageEditor) =>
  useCallback(
    (photo: AlbumPhoto, at?: { x: number; y: number }) => {
      if (!doc) return;
      const place = (naturalW: number, naturalH: number) => {
        const target = Math.min(doc.canvas.width, doc.canvas.height) * PLACED_PHOTO_SCALE;
        const ratio = naturalW > 0 && naturalH > 0 ? naturalW / naturalH : 4 / 3;
        const width = ratio >= 1 ? target : target * ratio;
        const height = ratio >= 1 ? target / ratio : target;
        const x = at ? at.x - width / 2 : doc.canvas.width / 2 - width / 2;
        const y = at ? at.y - height / 2 : doc.canvas.height / 2 - height / 2;
        editor.addPhoto({ photoId: photo._id, x, y, width, height, rotation: 0, caption: '' });
      };
      if (photo.width && photo.height) {
        place(photo.width, photo.height);
      } else if (isVideoType(photo.mimetype) && photo.signedUrl) {
        readVideoSize(photo.signedUrl)
          .then(({ width, height }) => place(width, height))
          .catch(() => place(16, 9));
      } else if (photo.signedUrl || photo.thumbnailSignedUrl) {
        // older photos have no stored dimensions; read them from the image itself
        const img = new Image();
        img.onload = () => place(img.naturalWidth, img.naturalHeight);
        img.onerror = () => place(4, 3);
        img.src = (photo.signedUrl || photo.thumbnailSignedUrl) as string;
      } else {
        place(4, 3);
      }
    },
    [doc, editor]
  );
