export interface CollageTextBox {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CollageConfig {
  version: string;
  date: string;
  viewport: { width: number; height: number };
  theme: string;
  photos: Array<{
    photoId: string;
    filename: string;
    caption?: string;
    position: { left: number; top: number };
    width: number;
    height: number;
    rotation?: number;
    frameVisible?: boolean;
    scaleX?: string;
    scaleY?: string;
    transparentBackground?: boolean;
  }>;
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
  createdAt: string;
  updatedAt: string;
}

export interface CollageInput {
  title: string;
  config: CollageConfig;
  albumIds: string[];
  ownerId?: string;
  groupId?: string;
}
