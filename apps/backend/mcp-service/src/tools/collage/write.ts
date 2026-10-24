import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  normalizeCollageConfig,
  serializeCollageDoc
} from '@tumbaland/collage-core';
import { album, resolveAlbum } from '../../album';
import { collages } from '../../collage';
import { TumbalandError } from '../../http';
import { EditOp, planChanges } from '../collageEdit';
import { describeLayout, describeSettings } from '../collageText';
import { Caller, ToolModule, explain, journalSchema, ok, tenantFor } from '../module';
import { image, text, fetchCollage, load, withShapes, uniqueAlbums, describeSources, describe } from './shared';
import { collageArg, editSchema } from './schemas';

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

export function registerWriteTools(server: McpServer, caller: Caller): void {
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

export const collageWrite: ToolModule = {
  scopes: ['album:read', 'album:write'],
  register: registerWriteTools
};
