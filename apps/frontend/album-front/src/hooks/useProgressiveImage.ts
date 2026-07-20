import { useEffect, useState } from 'react';

/**
 * Preloads `fullSrc` in the background and reports `thumbnailSrc` as the
 * display source until it's ready, so navigating between photos shows the
 * (already-loaded) thumbnail immediately instead of a blank/loading gap
 * while the full-resolution image downloads.
 */
export const useProgressiveImage = (fullSrc?: string, thumbnailSrc?: string) => {
  const [isFullLoaded, setIsFullLoaded] = useState(false);

  useEffect(() => {
    setIsFullLoaded(false);
    if (!fullSrc) return;

    const img = new Image();
    img.onload = () => setIsFullLoaded(true);
    img.src = fullSrc;
    if (img.complete) {
      setIsFullLoaded(true);
    }

    return () => {
      img.onload = null;
    };
  }, [fullSrc]);

  return {
    displaySrc: isFullLoaded || !thumbnailSrc ? fullSrc : thumbnailSrc,
    isFullLoaded
  };
};
