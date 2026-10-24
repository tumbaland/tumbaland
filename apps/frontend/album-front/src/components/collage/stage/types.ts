export interface ResolvedPhoto {
  src?: string;
  thumbSrc?: string;
  /** A video's still, when there is one. */
  posterSrc?: string;
  /** The file's type: a video is drawn playing rather than as a still. */
  mimetype?: string;
  width?: number;
  height?: number;
  title?: string;
}

export type ResolvePhoto = (photoId: string) => ResolvedPhoto | undefined;
