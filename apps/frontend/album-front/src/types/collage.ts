// What a stored config looks like is shared with the server.
import type { CollageConfig } from '@tumbaland/collage-core';
export type { CollageConfig, CollageConfigPhoto, CollageTextBox } from '@tumbaland/collage-core';

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
  /** Set when a connected assistant made it, with the name of the connection. */
  madeBy?: { kind: 'assistant'; label: string };
  thumbnail?: string;
}

export interface CollageInput {
  title: string;
  config: CollageConfig;
  albumIds: string[];
  ownerId?: string;
  groupId?: string;
}
