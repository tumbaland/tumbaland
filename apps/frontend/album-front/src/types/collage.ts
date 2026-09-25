export interface CollageConfigPhoto {
  photoId: string;
  /** legacy alias for photoId kept for very old configs */
  filename?: string;
  caption?: string;
  /** v2 flat coordinates */
  x?: number;
  y?: number;
  /** v1 coordinates */
  position?: { left: number; top: number };
  width: number;
  height: number;
  rotation?: number;
  /** v2: quarter turns baked into the image itself, in degrees (0/90/180/270) */
  orientation?: number;
  /** v2: explicit per-photo frame override (undefined = inherit) */
  id?: string;
  frame?: boolean;
  /** v2: sub-region of the source image to show, as fractions of its natural size */
  crop?: { x: number; y: number; width: number; height: number };
  /** v1 frame fields */
  frameVisible?: boolean;
  transparentBackground?: boolean;
  scaleX?: string;
  scaleY?: string;
}

export interface CollageTextBox {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** v2 styling; absent on v1 configs */
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  background?: string;
  outline?: string;
  shadow?: boolean;
  rotation?: number;
  /** What the item is; absent means text. */
  kind?: 'text' | 'sticker' | 'shape';
  shape?: string;
}

export interface CollageConfig {
  version: string;
  date: string;
  viewport: { width: number; height: number };
  theme: string;
  photos: CollageConfigPhoto[];
  texts?: CollageTextBox[];
  /** unknown legacy shape; kept opaque so it survives a normalize/serialize round-trip */
  textSections?: unknown[];
  title?: { text: string; subtitle?: string };
  backgroundColor?: string;
  photoTransparencyMode?: boolean;
  borderColor?: string;
}

export interface Collage {
  _id: string;
  title: string;
  config: CollageConfig;
  albumIds: string[];
  ownerId: string;
  groupId?: string;
  createdAt: string;
  updatedAt: string;
  /** Counts every save; absent on a collage from before revisions existed. */
  revision?: number;
  thumbnail?: string;
}

export interface CollageInput {
  title: string;
  config: CollageConfig;
  albumIds: string[];
  ownerId?: string;
  groupId?: string;
}
