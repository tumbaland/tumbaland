import type { CollageConfig } from '@tumbaland/collage-core';

export interface CollageInput {
  title: string;
  config: CollageConfig;
  albumIds: string[];
  ownerId?: string;
  groupId?: string;
}

export interface Collage extends CollageInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}
