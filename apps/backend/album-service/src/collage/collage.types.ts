import { CollageConfig } from './collage.model';

export interface CollageInput {
  title: string;
  config: CollageConfig;
  albumIds: string[];
  ownerId?: string;
}

export interface Collage extends CollageInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}
