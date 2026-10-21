import {
  Box,
  cleanTextPatch,
  COLLAGE_FONTS,
  COLLAGE_SHAPES,
  CollageCrop,
  CollageDoc,
  CollagePhotoItem,
  CollageShape,
  CollageTextItem,
  CropFocus,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_SIZE,
  focusCrop,
  FRAME_PADDING,
  isQuarterTurned,
  newItemId,
  normalizeCrop,
  photoHasFrame,
  serializePhoto,
  serializeSettings,
  serializeText,
  shortIdsOf,
  TEXT_LINE_HEIGHT,
  TextAlign
} from '@tumbaland/collage-core';
import type { CollageChange } from '../collage';
import { TumbalandError } from '../http';
import type { PhotoInfo } from './collageText';

/**
 * Edits an assistant asks for, turned into the small changes the editor itself
 * saves. The assistant says "put this photo here, this big, keep its top"; the
 * crop fractions, the stored shape of an item and its legacy keys are worked
 * out here, by the same code the editor uses, so what it makes opens in the
 * editor like anything a person made.
 */

interface TextStyle {
  font?: string;
  size?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  align?: TextAlign;
  background?: string;
  outline?: string;
  shadow?: boolean;
}

/** A box tall enough for every line of a text at its size. */
const fittedHeight = (text: string, size: number): number =>
  Math.round(text.split('\n').length * size * TEXT_LINE_HEIGHT + size * 0.4);

export type EditOp =
  | ({
      op: 'place_photo';
      photo: string;
      fit?: 'fill' | 'whole';
      focus?: CropFocus;
      crop?: CollageCrop;
      frame?: boolean;
      caption?: string;
    } & Box)
  | ({
      op: 'edit';
      item: string;
      photo?: string;
      focus?: CropFocus;
      crop?: CollageCrop;
      frame?: boolean;
      caption?: string;
      text?: string;
      shape?: string;
    } & Partial<Box> &
      TextStyle)
  | { op: 'remove'; item: string }
  | ({ op: 'add_text'; text: string; x: number; y: number; width?: number; height?: number; rotation?: number } & TextStyle)
  | { op: 'add_sticker'; emoji: string; x: number; y: number; size: number; rotation?: number }
  | ({ op: 'add_shape'; shape: string; color: string; outline?: string; shadow?: boolean } & Box)
  | { op: 'to_front' | 'to_back'; items: string[] }
  | { op: 'settings'; background?: string; frame?: boolean; frameColor?: string; width?: number; height?: number };

const fail = (message: string): never => {
  throw new TumbalandError(message, 400);
};

/** A font by its id or by the name the editor shows ("Handwritten"). */
const fontId = (font: string): string => {
  const wanted = font.trim().toLowerCase();
  const match = COLLAGE_FONTS.find((entry) => entry.id === wanted || entry.label.toLowerCase() === wanted);
  return match ? match.id : fail(`No font called "${font}". The fonts are: ${COLLAGE_FONTS.map((entry) => entry.label).join(', ')}.`);
};

const shapeOf = (shape: string): CollageShape =>
  (COLLAGE_SHAPES as readonly string[]).includes(shape)
    ? (shape as CollageShape)
    : fail(`No shape called "${shape}". The shapes are: ${COLLAGE_SHAPES.join(', ')}.`);

const styleOf = (style: TextStyle): Partial<CollageTextItem> =>
  cleanTextPatch({
    ...(style.font !== undefined ? { fontFamily: fontId(style.font) } : {}),
    ...(style.size !== undefined ? { fontSize: style.size } : {}),
    ...(style.color !== undefined ? { color: style.color } : {}),
    ...(style.bold !== undefined ? { bold: style.bold } : {}),
    ...(style.italic !== undefined ? { italic: style.italic } : {}),
    ...(style.align !== undefined ? { align: style.align } : {}),
    ...(style.background !== undefined ? { background: style.background } : {}),
    ...(style.outline !== undefined ? { outline: style.outline } : {}),
    ...(style.shadow !== undefined ? { shadow: style.shadow } : {})
  });

/** Drops keys whose value is undefined, so a patch never writes "nothing" over a value. */
const defined = <T extends object>(patch: T): Partial<T> =>
  Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as Partial<T>;

/** The shape of the picture area: inside the frame when there is one. */
const pictureAspect = (doc: CollageDoc, item: CollagePhotoItem): number => {
  const inset = photoHasFrame(doc, item) ? FRAME_PADDING * 2 : 0;
  return Math.max(1, item.width - inset) / Math.max(1, item.height - inset);
};

/** Turns applied to the picture swap its shape. */
const shownAspect = (aspect: number, item: CollagePhotoItem): number =>
  isQuarterTurned(item.orientation) ? 1 / aspect : aspect;

export interface Plan {
  changes: CollageChange[];
  /** one line per edit, saying what happened, in the short names that hold afterwards */
  done: string[];
  /** the collage as it will be once the changes land */
  doc: CollageDoc;
}

/**
 * Work out the changes for a batch of edits.
 *
 * Items are named as the description named them when it was read (p2, t1),
 * all resolved before anything is applied, so removing p1 does not make p2
 * mean something else halfway through the batch. Edits apply in order, and a
 * later edit to the same item builds on the earlier one.
 */
export function planChanges(start: CollageDoc, ops: EditOp[], photos: Map<string, PhotoInfo>): Plan {
  const byShortId = new Map([...shortIdsOf(start)].map(([id, short]) => [short, id]));
  const resolve = (ref: string): string => {
    const wanted = ref.trim();
    if (byShortId.has(wanted)) return byShortId.get(wanted)!;
    if ([...start.photos, ...start.texts].some((item) => item.id === wanted)) return wanted;
    return fail(`There is no ${wanted} on this collage. Read it again with get_collage for the current names.`);
  };
  const photoIdOf = (ref: string): string =>
    photos.has(ref)
      ? ref
      : fail(
          `Photo ${ref} is not in this collage's albums. Add its album with an add_albums edit, ` +
            'or use view_photos to see the photos it can use, and their ids.'
        );

  let doc: CollageDoc = { ...start, photos: start.photos.slice(), texts: start.texts.slice() };
  const changes: CollageChange[] = [];
  const done: string[] = [];
  const added: Array<{ id: string; what: string }> = [];

  const findPhoto = (id: string) => doc.photos.find((item) => item.id === id);
  const findText = (id: string) => doc.texts.find((item) => item.id === id);
  const putPhoto = (item: CollagePhotoItem) => {
    const at = doc.photos.findIndex((entry) => entry.id === item.id);
    doc = { ...doc, photos: at === -1 ? [...doc.photos, item] : doc.photos.map((entry) => (entry.id === item.id ? item : entry)) };
    changes.push({ type: 'put', layer: 'photos', item: serializePhoto(item, doc.frameEnabled) as never });
  };
  const putText = (item: CollageTextItem) => {
    const at = doc.texts.findIndex((entry) => entry.id === item.id);
    doc = { ...doc, texts: at === -1 ? [...doc.texts, item] : doc.texts.map((entry) => (entry.id === item.id ? item : entry)) };
    changes.push({ type: 'put', layer: 'texts', item: serializeText(item) as never });
  };
  // Without its shape a photo cannot be cropped to an edge or fitted to its
  // box, so say so rather than leave it as it was and report it changed.
  const aspectOf = (photoId: string, purpose: string): number =>
    photos.get(photoId)?.aspect ??
    fail(`The shape of ${photos.get(photoId)?.name ?? photoId} is not known, so it cannot ${purpose}. Give it a crop instead.`);
  const cropFor = (item: CollagePhotoItem, focus: CropFocus | undefined) =>
    !focus || focus === 'center'
      ? undefined
      : focusCrop(shownAspect(aspectOf(item.photoId, `keep its ${focus}`), item), pictureAspect(doc, item), focus);
  // The part to show, as the model chose it. A whole-photo crop is no crop.
  const chosenCrop = (crop: CollageCrop | undefined, focus: CropFocus | undefined) => {
    if (crop && focus) fail('Give a photo a crop or a focus, not both.');
    if (crop && (crop.x + crop.width > 1.001 || crop.y + crop.height > 1.001)) {
      fail('A crop has to stay inside the photo: x + width and y + height are at most 1.');
    }
    return crop ? normalizeCrop(crop) : undefined;
  };

  for (const op of ops) {
    switch (op.op) {
      case 'place_photo': {
        const photoId = photoIdOf(op.photo);
        let item: CollagePhotoItem = {
          id: newItemId(),
          photoId,
          x: op.x,
          y: op.y,
          width: op.width,
          height: op.height,
          rotation: op.rotation ?? 0,
          caption: op.caption ?? '',
          frame: op.frame
        };
        if (op.fit === 'whole') {
          // Keep the width and the top-left corner; the height follows the picture.
          const inset = photoHasFrame(doc, item) ? FRAME_PADDING * 2 : 0;
          item = { ...item, height: Math.round((op.width - inset) / aspectOf(photoId, 'be fitted whole') + inset) };
        }
        const crop = chosenCrop(op.crop, op.focus);
        item = { ...item, crop: op.fit === 'whole' ? undefined : (crop ?? cropFor(item, op.focus)) };
        putPhoto(item);
        added.push({ id: item.id, what: `placed ${photos.get(photoId)!.name}` });
        break;
      }

      case 'edit': {
        const id = resolve(op.item);
        const box = defined({ x: op.x, y: op.y, width: op.width, height: op.height, rotation: op.rotation });
        const photo = findPhoto(id);
        if (photo) {
          let item: CollagePhotoItem = { ...photo, ...box, ...defined({ frame: op.frame, caption: op.caption }) };
          if (op.photo !== undefined) item = { ...item, photoId: photoIdOf(op.photo), crop: undefined, orientation: undefined };
          if (op.crop !== undefined) item = { ...item, crop: chosenCrop(op.crop, op.focus) };
          else if (op.focus !== undefined) item = { ...item, crop: cropFor(item, op.focus) };
          putPhoto(item);
          done.push(`changed ${op.item}`);
          break;
        }
        const text = findText(id);
        if (!text) return fail(`${op.item} was removed earlier in this batch.`);
        // New words or a new size keep the box's top and width but not its
        // height, which was measured for the old text: a second line would
        // otherwise spill out of it and over whatever sits below.
        const refit =
          !text.kind && op.height === undefined && (op.text !== undefined || op.size !== undefined)
            ? { height: fittedHeight(op.text ?? text.text, op.size ?? text.fontSize) }
            : {};
        putText({
          ...text,
          ...box,
          ...refit,
          ...defined({ text: op.text, shape: op.shape !== undefined ? shapeOf(op.shape) : undefined }),
          ...styleOf(op)
        });
        done.push(`changed ${op.item}`);
        break;
      }

      case 'remove': {
        const id = resolve(op.item);
        const layer = findPhoto(id) ? 'photos' : findText(id) ? 'texts' : fail(`${op.item} was removed earlier in this batch.`);
        doc = { ...doc, [layer]: (doc[layer] as Array<{ id: string }>).filter((item) => item.id !== id) };
        changes.push({ type: 'remove', layer, id });
        done.push(`removed ${op.item}`);
        break;
      }

      case 'add_text': {
        const size = op.size ?? DEFAULT_TEXT_SIZE;
        const lines = op.text.split('\n');
        const longest = Math.max(...lines.map((line) => line.length));
        const item: CollageTextItem = {
          id: newItemId(),
          text: op.text,
          x: op.x,
          y: op.y,
          // A box the text fits, when none was given: wide enough for its
          // longest line at an average character width, tall enough for its lines.
          width: op.width ?? Math.min(doc.canvas.width, Math.round(longest * size * 0.6 + size)),
          height: op.height ?? fittedHeight(op.text, size),
          fontSize: size,
          color: op.color ?? DEFAULT_TEXT_COLOR,
          ...(op.rotation ? { rotation: op.rotation } : {}),
          ...styleOf({ ...op, size: undefined, color: undefined })
        };
        putText(item);
        added.push({ id: item.id, what: `added text "${op.text}"` });
        break;
      }

      case 'add_sticker': {
        const item: CollageTextItem = {
          id: newItemId(),
          text: op.emoji,
          kind: 'sticker',
          x: op.x,
          y: op.y,
          width: op.size,
          height: op.size,
          fontSize: DEFAULT_TEXT_SIZE,
          color: DEFAULT_TEXT_COLOR,
          ...(op.rotation ? { rotation: op.rotation } : {})
        };
        putText(item);
        added.push({ id: item.id, what: `added sticker ${op.emoji}` });
        break;
      }

      case 'add_shape': {
        const item: CollageTextItem = {
          id: newItemId(),
          text: '',
          kind: 'shape',
          shape: shapeOf(op.shape),
          x: op.x,
          y: op.y,
          width: op.width,
          height: op.height,
          fontSize: DEFAULT_TEXT_SIZE,
          color: op.color,
          ...defined({ outline: op.outline || undefined, shadow: op.shadow || undefined }),
          ...(op.rotation ? { rotation: op.rotation } : {})
        };
        putText(item);
        added.push({ id: item.id, what: `added a ${op.shape}` });
        break;
      }

      case 'to_front':
      case 'to_back': {
        const ids = op.items.map(resolve);
        for (const layer of ['photos', 'texts'] as const) {
          const current = (doc[layer] as Array<{ id: string }>).map((item) => item.id);
          const moving = current.filter((id) => ids.includes(id));
          if (moving.length === 0) continue;
          const rest = current.filter((id) => !ids.includes(id));
          const order = op.op === 'to_front' ? [...rest, ...moving] : [...moving, ...rest];
          const byId = new Map((doc[layer] as Array<{ id: string }>).map((item) => [item.id, item]));
          doc = { ...doc, [layer]: order.map((id) => byId.get(id)!) };
          changes.push({ type: 'order', layer, ids: order });
        }
        done.push(`moved ${op.items.join(', ')} to the ${op.op === 'to_front' ? 'front' : 'back'}`);
        break;
      }

      case 'settings': {
        doc = {
          ...doc,
          ...defined({ background: op.background, frameEnabled: op.frame, frameColor: op.frameColor }),
          canvas: { width: op.width ?? doc.canvas.width, height: op.height ?? doc.canvas.height }
        };
        changes.push({ type: 'settings', values: serializeSettings(doc) });
        done.push('changed the settings');
        break;
      }
    }
  }

  // New items are named once everything has landed, since that is the name
  // the next description will give them.
  const names = shortIdsOf(doc);
  for (const entry of added) {
    if (names.has(entry.id)) done.push(`${entry.what} as ${names.get(entry.id)}`);
  }

  return { changes, done, doc };
}
