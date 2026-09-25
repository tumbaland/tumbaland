/**
 * What a tile draws for a photo or a video.
 *
 * A video's "thumbnail" link is the video itself, which a tile can only draw
 * by asking the browser for a frame, and a browser that cannot decode the
 * clip (HEVC in Chrome) draws nothing. A video sent in the chat comes with a
 * still made on the phone that sent it, so that is used when there is one.
 */
export const mediaPreview = (
  photo: {
    mimetype?: string;
    signedUrl?: string;
    thumbnailSignedUrl?: string;
    posterSignedUrl?: string;
  },
  /** A tile wants the small copy; a single large picture wants the original. */
  prefer: 'thumbnail' | 'original' = 'thumbnail'
): { src?: string; mimetype?: string } => {
  if (photo.mimetype?.startsWith('video/') && photo.posterSignedUrl) {
    return { src: photo.posterSignedUrl, mimetype: 'image/jpeg' };
  }
  const src =
    prefer === 'original' ? photo.signedUrl || photo.thumbnailSignedUrl : photo.thumbnailSignedUrl || photo.signedUrl;
  return { src, mimetype: photo.mimetype };
};
