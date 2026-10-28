import { useCallback, useEffect, useMemo, useRef } from 'react';
import { isVideoType } from '@tumbaland/collage-core';
import type { AlbumPhoto } from '../components/collage/CollagePhotoTray';
import type { ResolvedPhoto } from '../components/collage/CollageStage';

/** How long the tray waits for more new photos before fetching them all at once. */
const PHOTOS_REFETCH_DELAY_MS = 800;

/**
 * The photos a collage can use: the albums' photos, a way to turn a photo id
 * into what the canvas draws, and a debounced refetch for when more arrive.
 */
export const useCollagePhotos = (
  data: { albumPhotos?: unknown[] } | undefined,
  refetch: () => unknown,
  usedInDoc: { photoId: string }[] | undefined
) => {
  const albumPhotos = useMemo(() => (data?.albumPhotos ?? []) as AlbumPhoto[], [data]);

  const photoById = useMemo(() => {
    const map = new Map<string, AlbumPhoto>();
    for (const p of albumPhotos) map.set(p._id, p);
    return map;
  }, [albumPhotos]);

  const resolvePhoto = useCallback(
    (photoId: string): ResolvedPhoto | undefined => {
      const p = photoById.get(photoId);
      if (!p) return undefined;
      const video = isVideoType(p.mimetype);
      return {
        src: p.signedUrl,
        // A video's thumbnail link is the video itself; its still is the poster.
        thumbSrc: video ? p.posterSignedUrl : p.thumbnailSignedUrl,
        posterSrc: p.posterSignedUrl,
        mimetype: p.mimetype,
        width: p.width,
        height: p.height,
        title: p.title
      };
    },
    [photoById]
  );

  // Batched: a message with ten photos arrives as ten announcements in a second.
  const photosTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refetchPhotos = useCallback(() => {
    if (photosTimer.current) clearTimeout(photosTimer.current);
    photosTimer.current = setTimeout(() => {
      photosTimer.current = null;
      void refetch();
    }, PHOTOS_REFETCH_DELAY_MS);
  }, [refetch]);
  useEffect(
    () => () => {
      if (photosTimer.current) clearTimeout(photosTimer.current);
    },
    []
  );

  const usedPhotoIds = useMemo(() => new Set((usedInDoc ?? []).map((p) => p.photoId)), [usedInDoc]);

  return { albumPhotos, photoById, resolvePhoto, refetchPhotos, usedPhotoIds };
};
