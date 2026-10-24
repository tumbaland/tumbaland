import { z } from 'zod';
import {
  COLLAGE_FONTS,
  COLLAGE_SHAPES,
  CROP_FOCUSES,
  STICKERS
} from '@tumbaland/collage-core';

export const collageArg = z.string().min(1).describe('The collage, by its title (or its id when two share a title)');

export const coordinate = z.number().min(-10_000).max(20_000);
export const length = z.number().positive().max(20_000);
export const rotation = z.number().min(-360).max(360).optional().describe('Degrees clockwise');
export const colour = z.string().min(1).max(40).describe('A CSS colour, e.g. #e91e63');
export const focus = z
  .enum(CROP_FOCUSES as [string, ...string[]])
  .optional()
  .describe('Which part of the photo to keep when the box is a different shape (default center)');
export const fit = z
  .enum(['fill', 'whole', 'inside'])
  .optional()
  .describe(
    'fill (default): the photo fills the box, cropped to fit. whole: the box takes the photo’s shape, keeping its width. ' +
      'inside: the box keeps its size and all of the photo shows inside it, on a blurred copy of itself; for a photo whose ' +
      'own edge cuts a face, or one that should not lose anything'
  );
export const crop = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().gt(0).max(1),
    height: z.number().gt(0).max(1)
  })
  .optional()
  .describe(
    'The part of the photo to show, as fractions of it from its top-left (0 to 1), like choosing it in the editor. ' +
      'It still fills the box, so give it the box’s shape to show exactly that part. Instead of focus'
  );

export const textStyle = {
  font: z.string().optional().describe(`One of: ${COLLAGE_FONTS.map((font) => font.label).join(', ')}`),
  size: z.number().min(4).max(1000).optional().describe('Font size in canvas units'),
  color: colour.optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  background: z.string().max(40).optional().describe('A band of colour behind the text; empty string for none'),
  outline: z.string().max(40).optional().describe('A stroke round the letters; empty string for none'),
  shadow: z.boolean().optional()
};

export const editSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('place_photo'),
    photo: z.string().describe('The photo id, from view_photos or get_collage'),
    x: coordinate,
    y: coordinate,
    width: length,
    height: length,
    rotation,
    fit,
    focus,
    crop,
    frame: z.boolean().optional().describe('Frame this photo; leave out to follow the collage'),
    caption: z.string().max(200).optional()
  }),
  z.object({
    op: z.literal('edit'),
    item: z.string().describe('p1, t2 ... as get_collage names them'),
    x: coordinate.optional(),
    y: coordinate.optional(),
    width: length.optional(),
    height: length.optional(),
    rotation,
    photo: z.string().optional().describe('Swap in another photo, keeping the box'),
    fit,
    focus,
    crop,
    frame: z.boolean().optional(),
    caption: z.string().max(200).optional(),
    text: z.string().max(500).optional().describe('New words for a text, or a new emoji for a sticker'),
    shape: z.string().optional(),
    ...textStyle
  }),
  z.object({ op: z.literal('remove'), item: z.string() }),
  z.object({
    op: z.literal('add_text'),
    text: z.string().min(1).max(500),
    x: coordinate,
    y: coordinate,
    width: length.optional().describe('Left out: wide enough for the text'),
    height: length.optional(),
    rotation,
    ...textStyle
  }),
  z.object({
    op: z.literal('add_sticker'),
    emoji: z.string().min(1).max(16).describe(`An emoji, e.g. one of ${STICKERS.slice(0, 12).join(' ')}`),
    x: coordinate,
    y: coordinate,
    size: length,
    rotation
  }),
  z.object({
    op: z.literal('add_shape'),
    shape: z.enum(COLLAGE_SHAPES),
    x: coordinate,
    y: coordinate,
    width: length,
    height: length,
    color: colour,
    outline: z.string().max(40).optional(),
    shadow: z.boolean().optional(),
    rotation
  }),
  z.object({
    op: z.literal('add_albums'),
    albums: z
      .array(z.string())
      .min(1)
      .max(20)
      .describe('Albums, by name, whose photos this collage may also use. Applied before the rest of the batch')
  }),
  z.object({ op: z.literal('to_front'), items: z.array(z.string()).min(1) }),
  z.object({ op: z.literal('to_back'), items: z.array(z.string()).min(1) }),
  z.object({
    op: z.literal('settings'),
    background: colour.optional(),
    frame: z.boolean().optional().describe('Frames on every photo that does not say otherwise'),
    frameColor: colour.optional(),
    width: z.number().int().min(200).max(8000).optional(),
    height: z.number().int().min(200).max(8000).optional()
  })
]);
