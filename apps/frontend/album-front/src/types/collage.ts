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
  /** v2: explicit per-photo frame override (undefined = inherit) */
  id?: string;
  frame?: boolean;
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
}

export interface CollageConfig {
  version: string;
  date: string;
  viewport: { width: number; height: number };
  theme: string;
  photos: CollageConfigPhoto[];
  texts?: CollageTextBox[];
  textSections?: Array<any>;
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
  thumbnail?: string;
}

export interface CollageInput {
  title: string;
  config: CollageConfig;
  albumIds: string[];
  ownerId?: string;
  groupId?: string;
}
