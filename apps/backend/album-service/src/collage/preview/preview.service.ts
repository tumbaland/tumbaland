import { isValidObjectId } from 'mongoose';
import { NotFoundError } from '@tumbaland/backend-core';
import { CollageConfig, normalizeCollageConfig } from '@tumbaland/collage-core';
import Album from '../../models/Album';
import Photo from '../../models/Photo';
import { canReachAlbum, PhotoAccessContext, reachableAlbumIds } from '../../services/photoAccess';
import { getCollageById } from '../collage.service';
import { drawCollagePreview, drawContactSheet, DrawnImage } from './draw';
import { loadPictures, PICTURE_FIELDS, PicturedPhoto } from './pictures';

/** What goes over the wire: JSON, so it travels the same envelope as everything else. */
export interface EncodedImage {
  image: string;
  mimeType: DrawnImage['mimeType'];
  width: number;
  height: number;
}

const encoded = (drawn: DrawnImage): EncodedImage => ({
  image: drawn.image.toString('base64'),
  mimeType: drawn.mimeType,
  width: drawn.width,
  height: drawn.height
});

/**
 * A collage drawn as its export would draw it, for an assistant to look at.
 *
 * Only photos from the collage's own albums are drawn, and only from albums
 * the caller can still reach: the same rule the editor's photo list follows,
 * so a preview never shows a picture the editor would not.
 */
export const collagePreview = async (
  id: string,
  context: PhotoAccessContext,
  options: { width: number; outline: boolean }
): Promise<EncodedImage> => {
  const collage = await getCollageById(id, context.userId, context.userGroups);
  if (!collage) throw new NotFoundError('Collage not found');

  const doc = normalizeCollageConfig(collage.config as unknown as CollageConfig);
  const albums = await reachableAlbumIds(collage.albumIds, context, 'read');
  const photoIds = [...new Set(doc.photos.map((photo) => photo.photoId))].filter((photoId) => isValidObjectId(photoId));

  const photos =
    photoIds.length > 0 && albums.size > 0
      ? await Photo.find({ _id: { $in: photoIds }, albumId: { $in: [...albums] } })
          .select(PICTURE_FIELDS)
          .lean<PicturedPhoto[]>()
      : [];

  return encoded(await drawCollagePreview(doc, await loadPictures(photos), options));
};

/** The most photos one shapes request measures, about one batch of edits' worth. */
export const MAX_SHAPES = 60;

/**
 * Each photo's shape, width over height as the editor shows it, by photo id.
 *
 * Measured from the picture, as the sheet does, because older uploads have no
 * size recorded, and an assistant that keeps a photo's top has to know how tall
 * it is. Only photos from the collage's albums that the caller can reach; one
 * that cannot be measured is left out.
 */
export const collagePhotoShapes = async (
  id: string,
  photoIds: string[],
  context: PhotoAccessContext
): Promise<Record<string, number>> => {
  const collage = await getCollageById(id, context.userId, context.userGroups);
  if (!collage) throw new NotFoundError('Collage not found');

  const albums = await reachableAlbumIds(collage.albumIds, context, 'read');
  const wanted = [...new Set(photoIds)].filter((photoId) => isValidObjectId(photoId)).slice(0, MAX_SHAPES);
  if (wanted.length === 0 || albums.size === 0) return {};

  const rows = await Photo.find({ _id: { $in: wanted }, albumId: { $in: [...albums] } })
    .select(PICTURE_FIELDS)
    .lean<PicturedPhoto[]>();
  const pictures = await loadPictures(rows);

  const shapes: Record<string, number> = {};
  for (const row of rows) {
    const picture = pictures.get(String(row._id));
    const aspect = picture ? picture.width / picture.height : row.width && row.height ? row.width / row.height : undefined;
    if (aspect) shapes[String(row._id)] = aspect;
  }
  return shapes;
};

export interface SheetFilter {
  page: number;
  size: number;
  tag?: string;
  from?: Date;
  to?: Date;
}

export interface SheetPhoto {
  /** the number on the picture */
  n: number;
  id: string;
  name: string;
  dateTaken?: string;
  /** width over height, as drawn: above 1 is landscape */
  aspect?: number;
  mimetype: string;
  tags: string[];
}

export interface ContactSheet extends EncodedImage {
  photos: SheetPhoto[];
  page: number;
  pages: number;
  total: number;
}

type SheetRow = PicturedPhoto & {
  originalName: string;
  title?: string;
  tags?: string[];
  metadata?: PicturedPhoto['metadata'] & { dateTaken?: Date };
};

/**
 * One page of an album's photos as a numbered grid, with the list that says
 * which number is which photo.
 *
 * In the order they were taken, so neighbouring numbers are neighbouring
 * moments, which is how someone picking photos for a day would look at them.
 */
export const albumContactSheet = async (
  albumId: string,
  filter: SheetFilter,
  context: PhotoAccessContext
): Promise<ContactSheet> => {
  const album = isValidObjectId(albumId) ? await Album.findById(albumId) : null;
  if (!album || !canReachAlbum(album, context, 'read')) throw new NotFoundError('Album not found');

  const query: Record<string, unknown> = { albumId };
  if (filter.tag) query.tags = filter.tag;
  if (filter.from || filter.to) {
    query['metadata.dateTaken'] = {
      ...(filter.from ? { $gte: filter.from } : {}),
      ...(filter.to ? { $lte: filter.to } : {})
    };
  }

  const skip = (filter.page - 1) * filter.size;
  const [rows, total] = await Promise.all([
    Photo.find(query)
      .sort({ 'metadata.dateTaken': 1, createdAt: 1, _id: 1 })
      .skip(skip)
      .limit(filter.size)
      .select(`${PICTURE_FIELDS} originalName title tags metadata.dateTaken`)
      .lean<SheetRow[]>(),
    Photo.countDocuments(query)
  ]);

  const pictures = await loadPictures(rows);
  const photos = rows.map((row, index): SheetPhoto => {
    const picture = pictures.get(String(row._id));
    const aspect = picture ? picture.width / picture.height : row.width && row.height ? row.width / row.height : undefined;
    return {
      n: skip + index + 1,
      id: String(row._id),
      name: row.title || row.originalName,
      dateTaken: row.metadata?.dateTaken ? new Date(row.metadata.dateTaken).toISOString() : undefined,
      aspect: aspect ? Math.round(aspect * 100) / 100 : undefined,
      mimetype: row.mimetype,
      tags: row.tags ?? []
    };
  });

  const drawn = await drawContactSheet(photos.map((photo) => ({ n: photo.n, picture: pictures.get(photo.id) })));
  return {
    ...encoded(drawn),
    photos,
    page: filter.page,
    pages: Math.max(1, Math.ceil(total / filter.size)),
    total
  };
};
