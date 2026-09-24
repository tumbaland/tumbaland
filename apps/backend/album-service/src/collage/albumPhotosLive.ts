import { logger } from '@tumbaland/backend-core';
import { CollageModel } from './collage.model';
import * as live from './collageLive';

/**
 * Tells anyone with a collage open that one of its albums gained or lost
 * photos, so the photo tray fetches again: a photo sent in the chat appears
 * while the collage made from that chat is being worked on.
 *
 * Only open collages are looked up, and nothing at all when none are open.
 * Never throws: the photo is saved either way, and the tray catches up on the
 * next load.
 */
export async function announceAlbumPhotos(albumIds: string[]): Promise<void> {
  const open = live.openCollageIds();
  if (open.length === 0 || albumIds.length === 0) return;

  try {
    const collages = await CollageModel.find({ _id: { $in: open }, albumIds: { $in: albumIds } }).select('_id');
    for (const collage of collages) live.publish(collage._id.toString(), 'photos', {});
  } catch (error) {
    logger.warn('Could not announce new album photos to open collages', { error: (error as Error).message });
  }
}
