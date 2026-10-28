import { CollageDoc, shortIdsOf } from '@tumbaland/collage-core';
import { album, resolveAlbum } from '../../album';
import { Collage, collages, docOf, EncodedImage, resolveCollage } from '../../collage';
import { EditOp } from '../collageEdit';
import { describeCollage, photoInfoOf, PhotoInfo } from '../collageText';
import { Caller, tenantFor } from '../module';

/**
 * Collages: reading and checking them, and making new ones from an album.
 *
 * Built around a loop the model can close on its own: read a collage, look at
 * the album's photos, make one, place photos, look at the result, fix what is
 * off. Every write answers with the collage as it now is and what looks wrong
 * with it, and can attach a picture of it, so one call is one round.
 *
 * What it makes is an ordinary collage that the people check and change in
 * the editor. It may change only collages an assistant made: theirs are theirs.
 */

export const image = (picture: EncodedImage) => ({ type: 'image' as const, data: picture.image, mimeType: picture.mimeType });

export const text = (value: string) => ({ type: 'text' as const, text: value });

export interface Loaded {
  collage: Collage;
  doc: CollageDoc;
  photos: Map<string, PhotoInfo>;
  groupId?: string;
}

/** A collage by its id, with everything a description needs. */
export async function fetchCollage(caller: Caller, id: string, groupId?: string): Promise<Loaded> {
  const { collage, photos } = await collages.get(caller.token, id);
  return {
    collage,
    doc: docOf(collage.config),
    photos: photoInfoOf(photos),
    groupId
  };
}

/** A collage by the name the model gave. */
export async function load(caller: Caller, name: string, journal?: string): Promise<Loaded> {
  const groupId = tenantFor(caller, journal);
  const target = resolveCollage(await collages.list(caller.token, { groupId }), name);
  return fetchCollage(caller, target._id, groupId);
}

/** The names of a collage's albums, for saying where its photos come from. */
export async function albumNames(caller: Caller, collage: Collage, groupId?: string): Promise<string[]> {
  const { albums } = await album.listAlbums(caller.token, { groupId, limit: 100 });
  return collage.albumIds.map((id) => albums.find((entry) => entry._id === id)?.name).filter((name): name is string => !!name);
}

/**
 * The collage's photos, with the shape of each one an edit needs to crop or
 * fit measured when no size was recorded for it. Older uploads have none, and
 * a focus on one of them would otherwise do nothing.
 */
export async function withShapes(caller: Caller, loaded: Loaded, edits: EditOp[]): Promise<Map<string, PhotoInfo>> {
  const itemIds = new Map([...shortIdsOf(loaded.doc)].map(([id, short]) => [short, id]));
  const photoOfItem = (ref: string) => {
    const id = itemIds.get(ref.trim()) ?? ref.trim();
    return loaded.doc.photos.find((item) => item.id === id)?.photoId;
  };
  const needed = edits.flatMap((edit) => {
    if (edit.op === 'place_photo') return edit.focus || edit.fit === 'whole' ? [edit.photo] : [];
    if (edit.op === 'edit' && (edit.focus || edit.fit === 'whole')) return [edit.photo ?? photoOfItem(edit.item)];
    return [];
  });
  const missing = [...new Set(needed)].filter((id): id is string => !!id && loaded.photos.has(id) && !loaded.photos.get(id)!.aspect);
  if (missing.length === 0) return loaded.photos;

  const shapes = await collages.shapes(caller.token, loaded.collage._id, missing);
  const photos = new Map(loaded.photos);
  for (const [id, aspect] of Object.entries(shapes)) {
    const info = photos.get(id);
    if (info) photos.set(id, { ...info, aspect });
  }
  return photos;
}

export type AlbumEntry = ReturnType<typeof resolveAlbum>;

/** Each album once, in the order first named. */
export const uniqueAlbums = (list: AlbumEntry[]): AlbumEntry[] =>
  list.filter((entry, index) => list.findIndex((other) => other._id === entry._id) === index);

export const describeSources = (sources: AlbumEntry[]): string =>
  sources.map((entry) => `${entry.name} (${entry.photoCount} photos)`).join(', ');

export const describe = async (caller: Caller, loaded: Loaded) =>
  describeCollage(loaded.collage, loaded.doc, loaded.photos, await albumNames(caller, loaded.collage, loaded.groupId));
