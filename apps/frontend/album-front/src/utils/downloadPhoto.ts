import { downloadBlob, logger } from '@tumbaland/frontend-core';
import { Photo } from '../types';

/**
 * The classic blob-URL + `<a download>` trick doesn't trigger a "Save to
 * Photos" prompt on iOS Safari (or most mobile browsers) — it either does
 * nothing visible or opens a bare blob viewer. Where the Web Share API can
 * share files, use the native share sheet instead: it has a real "Save
 * Image"/"Save Video" action that saves straight to the camera roll. Falls
 * back to the classic download link where file sharing isn't supported
 * (desktop browsers, older mobile browsers).
 */
export async function downloadPhoto(
  photo: Pick<Photo, 'signedUrl' | 'originalName' | '_id' | 'mimetype'>
): Promise<void> {
  if (!photo.signedUrl) return;

  const filename = photo.originalName || `photo-${photo._id}`;

  try {
    const response = await fetch(photo.signedUrl);
    const blob = await response.blob();
    const file = new File([blob], filename, { type: blob.type || photo.mimetype });

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (shareError) {
        // User closed the share sheet without picking anything — not a failure.
        if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
        throw shareError;
      }
    }

    downloadBlob(blob, filename);
  } catch (error) {
    logger.error('Download failed', error);
    window.open(photo.signedUrl, '_blank');
  }
}
