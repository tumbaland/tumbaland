import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  CollageConfig,
  CollageDoc,
  COLLAGE_FONTS,
  COLLAGE_SHAPES,
  CROP_FOCUSES,
  normalizeCollageConfig,
  serializeCollageDoc,
  shortIdsOf,
  STICKERS
} from '@tumbaland/collage-core';
import { album, resolveAlbum } from '../album';
import { Collage, collages, EncodedImage, resolveCollage } from '../collage';
import { TumbalandError } from '../http';
import { EditOp, planChanges } from './collageEdit';
import { describeCollage, describeLayout, describeSettings, photoInfoOf, PhotoInfo } from './collageText';
import { Caller, ToolModule, explain, journalSchema, ok, tenantFor } from './module';

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

const image = (picture: EncodedImage) => ({ type: 'image' as const, data: picture.image, mimeType: picture.mimeType });

const text = (value: string) => ({ type: 'text' as const, text: value });

interface Loaded {
  collage: Collage;
  doc: CollageDoc;
  photos: Map<string, PhotoInfo>;
  groupId?: string;
}

/** A collage by its id, with everything a description needs. */
async function fetchCollage(caller: Caller, id: string, groupId?: string): Promise<Loaded> {
  const { collage, photos } = await collages.get(caller.token, id);
  return {
    collage,
    doc: normalizeCollageConfig(collage.config as unknown as CollageConfig),
    photos: photoInfoOf(photos),
    groupId
  };
}

/** A collage by the name the model gave. */
async function load(caller: Caller, name: string, journal?: string): Promise<Loaded> {
  const groupId = tenantFor(caller, journal);
  const target = resolveCollage(await collages.list(caller.token, { groupId }), name);
  return fetchCollage(caller, target._id, groupId);
}

/** The names of a collage's albums, for saying where its photos come from. */
async function albumNames(caller: Caller, collage: Collage, groupId?: string): Promise<string[]> {
  const { albums } = await album.listAlbums(caller.token, { groupId, limit: 100 });
  return collage.albumIds.map((id) => albums.find((entry) => entry._id === id)?.name).filter((name): name is string => !!name);
}

/**
 * The collage's photos, with the shape of each one an edit needs to crop or
 * fit measured when no size was recorded for it. Older uploads have none, and
 * a focus on one of them would otherwise do nothing.
 */
async function withShapes(caller: Caller, loaded: Loaded, edits: EditOp[]): Promise<Map<string, PhotoInfo>> {
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

type AlbumEntry = ReturnType<typeof resolveAlbum>;

/** Each album once, in the order first named. */
const uniqueAlbums = (list: AlbumEntry[]): AlbumEntry[] =>
  list.filter((entry, index) => list.findIndex((other) => other._id === entry._id) === index);

const describeSources = (sources: AlbumEntry[]): string =>
  sources.map((entry) => `${entry.name} (${entry.photoCount} photos)`).join(', ');

const describe = async (caller: Caller, loaded: Loaded) =>
  describeCollage(loaded.collage, loaded.doc, loaded.photos, await albumNames(caller, loaded.collage, loaded.groupId));

const collageArg = z.string().min(1).describe('The collage, by its title (or its id when two share a title)');

const coordinate = z.number().min(-10_000).max(20_000);
const length = z.number().positive().max(20_000);
const rotation = z.number().min(-360).max(360).optional().describe('Degrees clockwise');
const colour = z.string().min(1).max(40).describe('A CSS colour, e.g. #e91e63');
const focus = z
  .enum(CROP_FOCUSES as [string, ...string[]])
  .optional()
  .describe('Which part of the photo to keep when the box is a different shape (default center)');
const fit = z
  .enum(['fill', 'whole', 'inside'])
  .optional()
  .describe(
    'fill (default): the photo fills the box, cropped to fit. whole: the box takes the photo’s shape, keeping its width. ' +
      'inside: the box keeps its size and all of the photo shows inside it, on a blurred copy of itself; for a photo whose ' +
      'own edge cuts a face, or one that should not lose anything'
  );
const crop = z
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

const textStyle = {
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

const editSchema = z.discriminatedUnion('op', [
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

function registerReadTools(server: McpServer, caller: Caller): void {
  server.registerTool(
    'list_collages',
    {
      title: 'List collages',
      description:
        'Every collage, with how many photos and texts it has and who made it. Collages an ' +
        'assistant made can be changed with update_collage; the ones people made cannot.',
      inputSchema: { ...journalSchema(caller) }
    },
    async ({ journal }) => {
      try {
        const groupId = tenantFor(caller, journal);
        const [list, { albums }] = await Promise.all([
          collages.list(caller.token, { groupId }),
          album.listAlbums(caller.token, { groupId, limit: 100 })
        ]);
        if (list.length === 0) return ok('There are no collages yet.');

        const lines = list.map((entry) => {
          const doc = normalizeCollageConfig(entry.config as unknown as CollageConfig);
          const from = entry.albumIds
            .map((id) => albums.find((candidate) => candidate._id === id)?.name)
            .filter((name): name is string => !!name);
          const changed = entry.updatedAt ? `, changed ${entry.updatedAt.slice(0, 10)}` : '';
          const maker = entry.madeBy ? `made by ${entry.madeBy.label}` : 'made by a person';
          return (
            `- "${entry.title}": ${doc.photos.length} photos, ${doc.texts.length} texts, ` +
            `${doc.canvas.width}×${doc.canvas.height}${from.length ? `, from ${from.join(', ')}` : ''}${changed}, ${maker}  [id ${entry._id}]`
          );
        });
        return ok(`${list.length} collage${list.length === 1 ? '' : 's'}:\n${lines.join('\n')}`);
      } catch (error) {
        return explain(error);
      }
    }
  );

  server.registerTool(
    'get_collage',
    {
      title: 'Read a collage',
      description:
        'A collage in words: its size and colours, every photo, text, sticker and shape with its ' +
        'position and short name (p1, t1), and a list of what looks wrong with it. The short names ' +
        'are what update_collage takes. Read this before changing a collage, and before making one ' +
        'like it.',
      inputSchema: { collage: collageArg, ...journalSchema(caller) }
    },
    async ({ collage, journal }) => {
      try {
        return ok(await describe(caller, await load(caller, collage, journal)));
      } catch (error) {
        return explain(error);
      }
    }
  );

  server.registerTool(
    'view_collage',
    {
      title: 'Look at a collage',
      description:
        'A picture of the collage, drawn the way its export is. With outline, each item is boxed ' +
        'and labelled with its short name, so you can tell which is which. Photos are drawn from ' +
        'their thumbnails, so they look softer than they will in the app.',
      inputSchema: {
        collage: collageArg,
        width: z.number().int().min(256).max(2048).optional().describe('Pixels across (default 1024)'),
        outline: z.boolean().optional().describe('Box and label each item (default true)'),
        ...journalSchema(caller)
      }
    },
    async ({ collage, width, outline, journal }) => {
      try {
        const groupId = tenantFor(caller, journal);
        const target = resolveCollage(await collages.list(caller.token, { groupId }), collage);
        const picture = await collages.preview(caller.token, target._id, { width, outline: outline ?? true });
        return { content: [image(picture), text(`"${target.title}", ${picture.width}×${picture.height}.`)] };
      } catch (error) {
        return explain(error);
      }
    }
  );

  server.registerTool(
    'view_photos',
    {
      title: 'Look at an album’s photos',
      description:
        'One page of an album as a numbered sheet of small pictures, in the order they were taken, ' +
        'with the list of which number is which photo and its id. This is the only way to know ' +
        'what a photo shows: nothing else in the library does. Use it to choose photos for a ' +
        'collage, then pass their ids to update_collage.',
      inputSchema: {
        albumName: z.string().describe('The album, by name'),
        page: z.number().int().min(1).optional(),
        size: z.number().int().min(6).max(48).optional().describe('Photos on a page (default 36)'),
        tag: z.string().optional(),
        from: z.string().optional().describe('Taken on or after, YYYY-MM-DD'),
        to: z.string().optional().describe('Taken on or before, YYYY-MM-DD'),
        ...journalSchema(caller)
      }
    },
    async ({ albumName, page, size, tag, from, to, journal }) => {
      try {
        const groupId = tenantFor(caller, journal);
        const target = resolveAlbum((await album.listAlbums(caller.token, { groupId, limit: 100 })).albums, albumName);
        const sheet = await collages.sheet(caller.token, target._id, { page, size, tag, from, to });
        if (sheet.photos.length === 0) return ok(`Nothing in ${target.name} matches that.`);

        const lines = sheet.photos.map((photo) => {
          const shape = photo.aspect ? (photo.aspect > 1.05 ? 'wide' : photo.aspect < 0.95 ? 'tall' : 'square') : '';
          const details = [photo.dateTaken?.slice(0, 10), shape && `${shape} ${photo.aspect}`, photo.mimetype.startsWith('video/') ? 'video' : '']
            .filter(Boolean)
            .join(', ');
          return `${photo.n}. ${photo.name}${details ? ` (${details})` : ''}  [id ${photo.id}]`;
        });
        const more = sheet.page < sheet.pages ? ` Page ${sheet.page + 1} has more.` : '';
        return {
          content: [
            image(sheet),
            text(`${target.name}: ${sheet.total} photos, page ${sheet.page} of ${sheet.pages}.${more}\n${lines.join('\n')}`)
          ]
        };
      } catch (error) {
        return explain(error);
      }
    }
  );
}

/**
 * How a collage is laid out, learned from the ones people made. The steps below
 * say when to apply them; the reasons are here so a new case can be judged.
 */
export const COLLAGE_LAYOUT_RULES = [
  'Layout:',
  '- Fill the whole canvas, edge to edge, with photos. Leave a margin of about 24 at the',
  '  edges and about 16 between photos. No empty strip, at the top or anywhere else.',
  '- Keep the middle for the title. Put the title where no photo covers it, and never',
  '  place a photo under it. Build the grid around that space rather than moving the title',
  '  onto the photos.',
  '- Give every photo a short caption (its `caption`). Make it funny and true to what is',
  '  visible in the picture. Never caption a person unkindly or with anything sexual or',
  '  violent, and never copy an old caption that does.',
  '- A tall photo in a wide box loses its top and bottom. Set focus "top" so faces stay',
  '  in frame. When a face sits elsewhere, set crop to the part with the faces. When the',
  '  photo itself cuts a head at its edge, or nothing of it should be lost, set fit "inside".'
];

const MAKE_COLLAGE_STEPS = [
  '1. If there is a collage to follow, read it with get_collage and look at it with view_collage.',
  '2. Look through the albums with view_photos, every page. Choose photos that fit the layout:',
  '   the best of each moment, a mix of moments, no two alike, people’s faces whole.',
  '3. create_collage, with `like` naming the collage to follow. A collage that spans more than',
  '   one album (a year, an anniversary) names the others in `alsoFrom`.',
  '4. update_collage with a place_photo for each photo (with its caption), plus the title,',
  '   and view: true. Follow the layout rules below.',
  '5. Look at the picture and the list of what looks wrong. Fix what is off with another',
  '   update_collage. Stop after about four rounds, or sooner when it looks right.',
  '6. Say which photos you chose and why, and the collage’s name. They will look at it in the',
  '   app and change what they like there.',
  '',
  ...COLLAGE_LAYOUT_RULES
].join('\n');

function registerWriteTools(server: McpServer, caller: Caller): void {
  server.registerTool(
    'create_collage',
    {
      title: 'Make a collage',
      description:
        'Make a new, empty collage drawing on one album, or several with `alsoFrom`. With `like`, it takes the size, colours ' +
        'and frames of an existing collage, and answers with that collage’s layout to follow. ' +
        'Then place photos with update_collage. The steps:\n' +
        MAKE_COLLAGE_STEPS,
      inputSchema: {
        title: z.string().min(1).max(200),
        albumName: z.string().describe('The album its photos come from'),
        alsoFrom: z
          .array(z.string())
          .max(20)
          .optional()
          .describe('More albums it may use photos from, by name, e.g. every monthly album of a year'),
        like: z.string().optional().describe('An existing collage to follow, by title'),
        ...journalSchema(caller)
      }
    },
    async ({ title, albumName, alsoFrom, like, journal }) => {
      try {
        const groupId = tenantFor(caller, journal);
        const { albums } = await album.listAlbums(caller.token, { groupId, limit: 100 });
        const source = resolveAlbum(albums, albumName);
        const sources = uniqueAlbums([source, ...(alsoFrom ?? []).map((name) => resolveAlbum(albums, name))]);
        const reference = like ? await load(caller, like, journal) : undefined;

        const blank = normalizeCollageConfig(null);
        const settings = reference?.doc ?? blank;
        const config = {
          ...serializeCollageDoc({ ...settings, photos: [], texts: [] }),
          title: { text: title, subtitle: '' }
        };
        const made = await collages.create(caller.token, {
          title,
          albumIds: sources.map((entry) => entry._id),
          config,
          groupId
        });

        const lines = [
          `Made "${made.title}" (id ${made._id}), empty, drawing on ${describeSources(sources)}: ` +
            `${describeSettings(settings)}.`
        ];
        if (reference) {
          lines.push('', `"${reference.collage.title}" is laid out like this; follow it with your own photos:`);
          lines.push(...describeLayout(reference.doc, reference.photos));
        }
        const names = sources.map((entry) => entry.name).join(', ');
        lines.push('', `Next: view_photos on ${names}, then update_collage with a place_photo for each photo.`);
        return ok(lines.join('\n'));
      } catch (error) {
        return explain(error);
      }
    }
  );

  server.registerTool(
    'update_collage',
    {
      title: 'Change a collage you made',
      description:
        'Apply a batch of edits to a collage an assistant made: place photos, move, resize, ' +
        'turn, crop or swap them, add or change texts, stickers and shapes, restack, change ' +
        'the colours. Items are named as get_collage names them (p1, t2), as they were before ' +
        'this batch. Positions and sizes are in canvas units, from the top-left corner. ' +
        'add_albums lets it use photos from more albums, and the same batch can place them. ' +
        'Answers with the collage as it now is and what looks wrong; set view to also get a ' +
        'picture of it. Collages people made cannot be changed: make a new one like it.',
      inputSchema: {
        collage: collageArg,
        changes: z.array(editSchema).min(1).max(60),
        view: z.boolean().optional().describe('Also answer with a picture of the result'),
        ...journalSchema(caller)
      }
    },
    async ({ collage, changes, view, journal }) => {
      try {
        const loaded = await load(caller, collage, journal);
        // Not a 403: that reads as a missing scope, and the fix here is a new
        // collage, not a new key.
        if (!loaded.collage.madeBy) {
          throw new TumbalandError(
            `"${loaded.collage.title}" was made by a person, so it cannot be changed here. Make a new collage like it with create_collage.`,
            409
          );
        }

        // Albums first, so a photo from one of them can be placed in the same
        // batch: the photos the rest is checked against are read again after.
        const albumNamesToAdd = changes.flatMap((change) => (change.op === 'add_albums' ? change.albums : []));
        const edits = changes.filter((change) => change.op !== 'add_albums') as EditOp[];
        const done: string[] = [];
        let current = loaded;
        if (albumNamesToAdd.length > 0) {
          const { albums } = await album.listAlbums(caller.token, { groupId: loaded.groupId, limit: 100 });
          const adding = uniqueAlbums(albumNamesToAdd.map((name) => resolveAlbum(albums, name)));
          await collages.addAlbums(caller.token, loaded.collage._id, adding.map((entry) => entry._id));
          done.push(`added ${describeSources(adding)}`);
          current = await fetchCollage(caller, loaded.collage._id, loaded.groupId);
        }

        if (edits.length > 0) {
          const plan = planChanges(current.doc, edits, await withShapes(caller, current, edits));
          await collages.change(caller.token, current.collage._id, plan.changes);
          done.push(...plan.done);
        }

        // Read back rather than trusting the plan: someone in the editor may
        // have changed other items at the same moment, and both landed.
        const now = await fetchCollage(caller, loaded.collage._id, loaded.groupId);
        const summary = `Done: ${done.join('; ')}.\n\n${await describe(caller, now)}`;
        if (!view) return ok(summary);

        const picture = await collages.preview(caller.token, now.collage._id, { outline: true });
        return { content: [image(picture), text(summary)] };
      } catch (error) {
        return explain(error);
      }
    }
  );

  server.registerPrompt(
    'make_collage',
    {
      title: 'Make a collage from an album',
      description: 'Choose photos from an album and lay them out, following an earlier collage if you name one.',
      argsSchema: {
        albumName: z.string().describe('The album to take photos from'),
        like: z.string().optional().describe('An earlier collage to follow'),
        notes: z.string().optional().describe('Anything else: a title, a mood, photos to include')
      }
    },
    ({ albumName, like, notes }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              `Make a collage from the album "${albumName}"${like ? `, laid out like "${like}"` : ''}.`,
              ...(notes ? [`Also: ${notes}`] : []),
              '',
              MAKE_COLLAGE_STEPS
            ].join('\n')
          }
        }
      ]
    })
  );
}

export const collageRead: ToolModule = {
  scopes: ['album:read'],
  register: registerReadTools
};

export const collageWrite: ToolModule = {
  scopes: ['album:read', 'album:write'],
  register: registerWriteTools
};
