import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  CollageConfig,
  normalizeCollageConfig
} from '@tumbaland/collage-core';
import { album, resolveAlbum } from '../../album';
import { collages, resolveCollage } from '../../collage';
import { Caller, ToolModule, explain, journalSchema, ok, tenantFor } from '../module';
import { image, text, load, describe } from './shared';
import { collageArg } from './schemas';

export function registerReadTools(server: McpServer, caller: Caller): void {
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

export const collageRead: ToolModule = {
  scopes: ['album:read'],
  register: registerReadTools
};
