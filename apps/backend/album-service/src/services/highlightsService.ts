import { Types } from 'mongoose';
import { assertMemberOf } from '@tumbaland/backend-core';
import Album from '../models/Album';
import Photo, { IPhoto } from '../models/Photo';
import photoService, { PhotoWithSignedUrls } from './photoService';

export interface HighlightsFilter {
  groupId?: string;
  /** how many photos to return */
  limit?: number;
}

export interface HighlightsContext {
  userId: string;
  userGroups: string[];
}

export interface HighlightPhoto extends PhotoWithSignedUrls {
  /** the album the photo lives in, so a tile can say where it came from */
  albumName: string;
  /** when this photo is dated: its capture date if it had one, else its upload */
  takenAt: string;
  /** 'taken' when the file carried a capture date, 'uploaded' when it did not */
  dateSource: 'taken' | 'uploaded';
}

export interface HighlightsResult {
  photos: HighlightPhoto[];
}

interface AlbumRow {
  _id: unknown;
  name: string;
}

/**
 * The two dashboard strips that are just "some photos": the newest arrivals,
 * and one picked at random to resurface.
 *
 * Scoped exactly as the statistics and the memories are — a group the caller
 * belongs to, or their own non-group albums — so a dashboard can never show a
 * photo from an album the viewer cannot open.
 */
class HighlightsService {
  /** The albums in scope, or null when the caller may not see the group. */
  private async albumsInScope(groupId: string | undefined, context: HighlightsContext): Promise<AlbumRow[]> {
    const { userId, userGroups } = context;

    assertMemberOf(groupId, userGroups, 'Access denied: Not a member of this group');

    const albumQuery = groupId ? { groupId } : { userId, groupId: { $exists: false } };
    return Album.find(albumQuery).select({ name: 1 }).lean<AlbumRow[]>();
  }

  /**
   * The most recently uploaded photos, newest first.
   *
   * Ordered by `createdAt` rather than the capture date on purpose: this strip
   * answers "what have we just added", and a holiday's worth of photos
   * imported today belongs at the top however old the pictures are.
   */
  async getRecentPhotos(filter: HighlightsFilter, context: HighlightsContext): Promise<HighlightsResult> {
    const { groupId, limit = 8 } = filter;
    const albums = await this.albumsInScope(groupId, context);
    if (albums.length === 0) return { photos: [] };

    const albumNames = new Map(albums.map((album) => [String(album._id), album.name]));
    const documents = await Photo.find({ albumId: { $in: albums.map((album) => String(album._id)) } })
      .sort({ createdAt: -1 })
      .limit(limit);

    const enriched = await photoService.attachSignedUrls(documents);
    return { photos: enriched.map((photo) => this.toHighlight(photo, albumNames)) };
  }

  /**
   * A photo picked at random from everything in scope.
   *
   * `$sample` rather than counting and skipping: a skip walks the collection
   * to the offset, so its cost grows with the library, and the whole point of
   * this strip is that it stays cheap on the library that has most to
   * resurface. Unlike the memories strip it does not exclude the current year
   * — an old photo is likelier simply because there are more of them.
   */
  async getRandomPhotos(filter: HighlightsFilter, context: HighlightsContext): Promise<HighlightsResult> {
    const { groupId, limit = 1 } = filter;
    const albums = await this.albumsInScope(groupId, context);
    if (albums.length === 0) return { photos: [] };

    const albumNames = new Map(albums.map((album) => [String(album._id), album.name]));
    // Cast, rather than the string form the name map is keyed by: Mongoose
    // casts a query against the schema but never an aggregation pipeline, so
    // a string here is compared to an ObjectId and matches nothing.
    const albumIds = albums.map((album) => new Types.ObjectId(String(album._id)));

    const sampled = await Photo.aggregate<{ _id: Types.ObjectId }>([
      { $match: { albumId: { $in: albumIds } } },
      { $sample: { size: limit } },
      { $project: { _id: 1 } }
    ]);
    if (sampled.length === 0) return { photos: [] };

    const documents = await Photo.find({ _id: { $in: sampled.map((row) => row._id) } });
    const enriched = await photoService.attachSignedUrls(documents);
    return { photos: enriched.map((photo) => this.toHighlight(photo, albumNames)) };
  }

  /**
   * Private helper: the album a photo came from, and the date to show against
   * it — with `dateSource` saying which date that is, so a tile never claims
   * to know when a picture was taken when all it has is when it arrived.
   */
  private toHighlight(photo: PhotoWithSignedUrls, albumNames: Map<string, string>): HighlightPhoto {
    const dateTaken = (photo.metadata as IPhoto['metadata'] | undefined)?.dateTaken;

    return {
      ...photo,
      albumName: albumNames.get(String(photo.albumId)) ?? 'Unknown album',
      takenAt: new Date(dateTaken ?? photo.createdAt).toISOString(),
      dateSource: dateTaken ? 'taken' : 'uploaded'
    };
  }
}

export default new HighlightsService();
