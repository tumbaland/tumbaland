export interface CollageConfig {
  version: string;
  date: string;
  viewport: { width: number; height: number };
  theme: string;
  photos: Array<{
    filename: string;
    caption?: string;
    position: { left: number; top: number };
    width: number;
    height: number;
    rotation?: number;
    frameVisible?: boolean;
    scaleX?: string;
    scaleY?: string;
  }>;
  textSections?: Array<any>;
  title?: { text: string; subtitle?: string };
}

export interface Collage {
  _id: string;
  title: string;
  config: CollageConfig;
  albumId: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollageInput {
  title: string;
  config: CollageConfig;
  albumId: string;
  ownerId?: string;
}
