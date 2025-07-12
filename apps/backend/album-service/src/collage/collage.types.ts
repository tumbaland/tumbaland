
import { CollageConfig } from './collage.model';

export interface CollageInput {
  title: string;
  config: CollageConfig;
  albumId: string;
  ownerId?: string;
}

export interface Collage extends CollageInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}
