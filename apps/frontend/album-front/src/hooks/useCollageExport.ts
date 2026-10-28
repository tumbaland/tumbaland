import { useCallback, useState } from 'react';
import { logger } from '@tumbaland/frontend-core';
import type { CollageDoc } from '@tumbaland/collage-core';
import type { ResolvedPhoto } from '../components/collage/CollageStage';
import { downloadBlob, exportCollageToPng, exportCollageToVideo } from '../components/collage/exportCollage';

interface Toast {
  message: string;
  severity: 'success' | 'error';
}

/** Saving the collage as a picture or a video, and telling the person how it went. */
export const useCollageExport = (
  doc: CollageDoc | null | undefined,
  title: string | undefined,
  resolvePhoto: (photoId: string) => ResolvedPhoto | undefined,
  notify: (toast: Toast) => void
) => {
  const [exportingVideo, setExportingVideo] = useState(false);
  const name = title || 'collage';

  const exportImage = useCallback(async () => {
    if (!doc) return;
    try {
      const blob = await exportCollageToPng(doc, resolvePhoto);
      downloadBlob(blob, `${name}.png`);
    } catch (e) {
      logger.error('Failed to export collage', e);
      notify({
        message: e instanceof Error ? e.message : 'Failed to export collage',
        severity: 'error'
      });
    }
  }, [doc, name, resolvePhoto, notify]);

  const exportVideo = useCallback(async () => {
    if (!doc || exportingVideo) return;
    setExportingVideo(true);
    notify({ message: 'Making the video. This takes as long as the clip.', severity: 'success' });
    try {
      const { blob, extension } = await exportCollageToVideo(doc, resolvePhoto);
      downloadBlob(blob, `${name}.${extension}`);
      notify({ message: 'Video downloaded', severity: 'success' });
    } catch (e) {
      logger.error('Failed to export collage video', e);
      notify({
        message: e instanceof Error ? e.message : 'Failed to make the video',
        severity: 'error'
      });
    } finally {
      setExportingVideo(false);
    }
  }, [doc, name, resolvePhoto, exportingVideo, notify]);

  return { exportImage, exportVideo, exportingVideo };
};
