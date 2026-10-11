import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { album, Album, Photo, resolveAlbum } from '../album';
import { Caller, ToolModule, explain, journalSchema, ok, tenantFor } from './module';

/**
 * Photos.
 *
 * What an assistant can usefully do here is narrower than it first looks, and
 * the tool descriptions say so plainly. Nothing about the *content* of a photo
 * is indexed: a real library of 2,600 photos carries one distinct tag, the AI
 * analysis field stores job timings rather than labels, and no photo has a
 * resolved place name. "Find the photos of the dog" cannot be answered, and a
 * tool that implied otherwise would return nothing while looking like it had
 * searched.
 *
 * What can be answered is where a photo lives, when it was taken, and what it
 * is called. The one write that earns its place follows from the same fact:
 * tags are unused, so helping put them there is the most useful thing an
 * assistant can do with this library.
 */

const megabytes = (bytes: number): string =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;

const describeAlbum = (entry: Album): string => {
  const detail = entry.description ? ` — ${entry.description}` : '';
  return `- ${entry.name}: ${entry.photoCount} photo${entry.photoCount === 1 ? '' : 's'}, ${megabytes(entry.totalSize)}${detail}`;
};

const describePhoto = (photo: Photo): string => {
  const name = photo.title || photo.originalName;
  const taken = photo.metadata?.dateTaken ? ` ${photo.metadata.dateTaken.slice(0, 10)}` : '';
  const tags = photo.tags.length > 0 ? ` [${photo.tags.join(', ')}]` : '';
  return `-${taken} ${name}${tags}  [id ${photo._id}]`;
};

/** Albums in the acting tenant, for both listing and name resolution. */
const albumsFor = (caller: Caller, journal?: string) => {
  const groupId = tenantFor(caller, journal);
  return { groupId, load: () => album.listAlbums(caller.token, { groupId, limit: 100 }) };
};

function registerReadTools(server: McpServer, caller: Caller): void {
  const apiKey = caller.token;

  server.registerTool(
    'list_albums',
    {
      title: 'List photo albums',
      description:
        'Every album, with how many photos it holds and how much space it takes. This is the way ' +
        'into the photo library: photos are searched one album at a time, so start here to find ' +
        'the album you want.',
      inputSchema: {
        search: z.string().optional().describe('Narrow to albums whose name or description matches'),
        ...journalSchema(caller)
      }
    },
    async ({ search, journal }) => {
      try {
        const { groupId } = albumsFor(caller, journal);
        const page = await album.listAlbums(apiKey, { search, groupId, limit: 100 });

        if (page.albums.length === 0) {
          return ok(search ? `No album matches "${search}".` : 'There are no albums yet.');
        }

        const photos = page.albums.reduce((sum, entry) => sum + entry.photoCount, 0);
        const bytes = page.albums.reduce((sum, entry) => sum + entry.totalSize, 0);

        return ok(
          `${page.albums.length} album${page.albums.length === 1 ? '' : 's'}, ` +
            `${photos} photos, ${megabytes(bytes)}:\n${page.albums.map(describeAlbum).join('\n')}`
        );
      } catch (error) {
        return explain(error);
      }
    }
  );

  server.registerTool(
    'search_photos',
    {
      title: 'Search photos in one album',
      description:
        'Photos inside a named album, optionally narrowed by text or tag. The text matches the ' +
        'filename and the title, not what is in the picture: nothing here knows what a photo shows, ' +
        'so asking for "the ones with the dog" cannot work. Use list_albums first to find the album.',
      inputSchema: {
        albumName: z.string().describe('The album to look in, by name, e.g. "Spain 2024"'),
        search: z.string().optional().describe('Text to match in the filename or title'),
        tag: z.string().optional().describe('Narrow to photos carrying this tag'),
        limit: z.number().int().min(1).max(100).optional().describe('How many at most (default 25)'),
        ...journalSchema(caller)
      }
    },
    async ({ albumName, search, tag, limit, journal }) => {
      try {
        const { load } = albumsFor(caller, journal);
        const target = resolveAlbum((await load()).albums, albumName);

        const page = await album.listPhotos(apiKey, target._id, {
          search,
          tags: tag,
          limit: limit ?? 25
        });

        if (page.photos.length === 0) {
          return ok(`Nothing in ${target.name} matches that.`);
        }

        const total = page.pagination?.total ?? page.photos.length;
        return ok(
          `${total} in ${target.name}, showing ${page.photos.length}:\n` +
            page.photos.map(describePhoto).join('\n')
        );
      } catch (error) {
        return explain(error);
      }
    }
  );

  server.registerTool(
    'get_photo_memories',
    {
      title: 'Photos from this day in earlier years',
      description:
        'Photos taken around today’s date in previous years, grouped by year and across every ' +
        'album. This is the one search that spans the whole library, because it goes on the date ' +
        'a photo was taken rather than on anything about its contents.',
      inputSchema: {
        windowDays: z
          .number()
          .int()
          .min(0)
          .max(30)
          .optional()
          .describe('How many days either side of today to include (default 3)'),
        ...journalSchema(caller)
      }
    },
    async ({ windowDays, journal }) => {
      try {
        const { groupId } = albumsFor(caller, journal);
        const memories = await album.getMemories(apiKey, { windowDays, groupId });

        if (memories.years.length === 0) {
          return ok('Nothing was photographed around this date in earlier years.');
        }

        const lines = memories.years.map((year) => {
          const photos = year.photos
            .map((photo) => {
              // An upload date is not a capture date, and a strip that blurred
              // the two would claim to know when a picture was taken.
              const source = photo.dateSource === 'uploaded' ? ' (by upload date)' : '';
              return `    ${photo.title || photo.originalName} in ${photo.albumName}${source}`;
            })
            .join('\n');
          return `  ${year.year}, ${year.yearsAgo} year${year.yearsAgo === 1 ? '' : 's'} ago — ${year.photoCount} photo${year.photoCount === 1 ? '' : 's'}:\n${photos}`;
        });

        return ok(`Around ${memories.date.slice(0, 10)}:\n${lines.join('\n')}`);
      } catch (error) {
        return explain(error);
      }
    }
  );
}

function registerWriteTools(server: McpServer, caller: Caller): void {
  const apiKey = caller.token;

  server.registerTool(
    'tag_photos',
    {
      title: 'Tag photos',
      description:
        'Add or remove tags on photos, by id, from search_photos. Tags are the only thing that ' +
        'makes this library searchable by subject, and almost nothing is tagged yet, so helping ' +
        'put them there is worth doing. Say which photos and which tags before applying it.',
      inputSchema: {
        photoIds: z
          .array(z.string().min(1))
          .min(1)
          .max(200)
          .describe('The photos to change, from search_photos'),
        add: z.array(z.string().min(1)).max(20).optional().describe('Tags to add'),
        remove: z.array(z.string().min(1)).max(20).optional().describe('Tags to take off')
      }
    },
    async ({ photoIds, add, remove }) => {
      try {
        if (!add?.length && !remove?.length) {
          return ok('Nothing to change. Give at least one tag to add or remove.');
        }

        const result = await album.tagPhotos(apiKey, { photoIds, add, remove });
        const what = [
          add?.length ? `added ${add.join(', ')}` : null,
          remove?.length ? `removed ${remove.join(', ')}` : null
        ]
          .filter(Boolean)
          .join(' and ');

        // Matched, not requested: a photo in an album the credential cannot
        // reach is dropped silently, and reporting the request would overstate
        // what happened.
        return ok(`${what} on ${result.modified} of ${result.matched} photos.`);
      } catch (error) {
        return explain(error);
      }
    }
  );

  server.registerTool(
    'describe_photo',
    {
      title: 'Title or describe a photo',
      description:
        'Give one photo a title or a description. Like tags, this is what makes a photo findable ' +
        'later — a filename like PXL_20250614_072211118.jpg tells nobody anything.',
      inputSchema: {
        id: z.string().min(1).describe('The photo, from search_photos'),
        title: z.string().max(200).optional().describe('A short name for it'),
        description: z.string().max(1000).optional().describe('Anything worth remembering about it')
      }
    },
    async ({ id, title, description }) => {
      try {
        if (title === undefined && description === undefined) {
          return ok('Nothing to change. Give a title or a description.');
        }

        await album.describePhoto(apiKey, id, { title, description });
        return ok(`Updated ${title ? `"${title}"` : 'the photo'}.`);
      } catch (error) {
        return explain(error);
      }
    }
  );
}

export const albumRead: ToolModule = {
  scopes: ['album:read'],
  register: registerReadTools
};

export const albumWrite: ToolModule = {
  scopes: ['album:read', 'album:write'],
  register: registerWriteTools
};
