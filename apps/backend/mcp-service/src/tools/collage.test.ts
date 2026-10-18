jest.mock('@tumbaland/backend-core', () => ({
  // Tenant constants from the real module; see the note in relationship.test.ts.
  ...jest.requireActual('@tumbaland/backend-core/dist/apiKeys/types'),
  verifyApiKey: jest.fn(),
  verifyAccessToken: jest.fn(),
  looksLikeApiKey: (t: string) => typeof t === 'string' && t.startsWith('tmb_live_'),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  requireEnv: (name: string) => process.env[name] ?? `missing:${name}`
}));

jest.mock('../album', () => ({
  ...jest.requireActual('../album'),
  album: { listAlbums: jest.fn() }
}));

jest.mock('../collage', () => ({
  ...jest.requireActual('../collage'),
  collages: {
    list: jest.fn(),
    get: jest.fn(),
    preview: jest.fn(),
    sheet: jest.fn(),
    create: jest.fn(),
    change: jest.fn(),
    addAlbums: jest.fn()
  }
}));

import request from 'supertest';
import { TEXT_LINE_HEIGHT } from '@tumbaland/collage-core';
import { verifyApiKey } from '@tumbaland/backend-core';
import fixtures from '../__fixtures__/album-api.json';
import { album } from '../album';
import { collages } from '../collage';
import { createApp } from '../app';

const mockedVerify = verifyApiKey as jest.Mock;
const albumApi = album as jest.Mocked<typeof album>;
const api = collages as jest.Mocked<typeof collages>;
const app = createApp();
const KEY = 'tmb_live_abcdef123456_aaaaaaaaaaaaaaaaaaaaaaaa';
const FINLAND = '685a7b72414b3995b5f1f872';
const TARTU = '685a9943d1beadd96f037d6b';

interface Part {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
}

async function rpc(method: string, params: Record<string, unknown>) {
  const res = await request(app)
    .post('/mcp')
    .set('Authorization', `Bearer ${KEY}`)
    .set('Accept', 'application/json, text/event-stream')
    .send({ jsonrpc: '2.0', id: 1, method, params });
  return JSON.parse(res.text.split('data: ')[1] ?? '{}');
}

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const payload = await rpc('tools/call', { name, arguments: args });
  const content: Part[] = payload.result?.content ?? [];
  return {
    isError: Boolean(payload.result?.isError),
    text: content.filter((part) => part.type === 'text').map((part) => part.text).join('\n'),
    images: content.filter((part) => part.type === 'image')
  };
}

const config = {
  version: '2.0',
  viewport: { width: 1600, height: 900 },
  backgroundColor: '#fce4ec',
  photoTransparencyMode: false,
  borderColor: '#fafafa',
  photos: [{ id: 'item-a', photoId: 'ph1', x: 0, y: 0, width: 800, height: 600 }],
  texts: [{ id: 'item-t', text: 'Rome 2024', x: 100, y: 700, width: 600, height: 80, fontSize: 64, color: '#e91e63', fontFamily: 'hand' }]
};

const theirs = { _id: '66a000000000000000000001', title: 'Rome', albumIds: [FINLAND], config, updatedAt: '2026-09-01T00:00:00Z' };
const ours = { ...theirs, _id: '66a000000000000000000002', title: 'Saaremaa', madeBy: { kind: 'assistant' as const, label: 'Claude' } };

const photos = [
  { _id: 'ph1', filename: 'f1', originalName: 'beach.jpg', mimetype: 'image/jpeg', width: 400, height: 300, tags: [] },
  { _id: 'ph2', filename: 'f2', originalName: 'harbour.jpg', mimetype: 'image/jpeg', width: 300, height: 400, tags: [] }
];

const picture = { image: 'AAAA', mimeType: 'image/jpeg', width: 1024, height: 576 };

beforeEach(() => {
  jest.clearAllMocks();
  mockedVerify.mockResolvedValue({
    ok: true,
    userId: 'u1',
    keyId: 'k1',
    scopes: ['album:read', 'album:write'],
    tenants: { allowed: ['personal'], default: 'personal' },
    tenantNames: { personal: 'My own data' }
  });
  albumApi.listAlbums.mockResolvedValue(fixtures.albums as never);
  api.list.mockResolvedValue([theirs, ours] as never);
  api.get.mockImplementation(async (_key, id) => ({ collage: id === ours._id ? ours : theirs, photos }) as never);
  api.preview.mockResolvedValue(picture as never);
  api.change.mockResolvedValue({ revision: 2 });
});

describe('reading collages', () => {
  it('lists them with who made each', async () => {
    const { text } = await callTool('list_collages');

    expect(text).toContain('2 collages:');
    expect(text).toContain('- "Rome": 1 photos, 1 texts, 1600×900, from Finland 2025, changed 2026-09-01, made by a person');
    expect(text).toContain('made by Claude  [id 66a000000000000000000002]');
  });

  it('says when there are none', async () => {
    api.list.mockResolvedValue([]);
    expect((await callTool('list_collages')).text).toBe('There are no collages yet.');
  });

  it('describes one by name, with its albums and the names the tools take', async () => {
    const { text } = await callTool('get_collage', { collage: 'rome' });

    expect(api.get).toHaveBeenCalledWith(KEY, theirs._id);
    expect(text).toContain('"Rome" (id 66a000000000000000000001): 1600×900, background #fce4ec, frames on, in #fafafa.');
    expect(text).toContain('Photos come from Finland 2025; 2 to choose from.');
    expect(text).toContain('p1  beach.jpg');
    expect(text).toContain('t1  text "Rome 2024" in Handwritten');
  });

  it('answers a name it cannot find with the real ones', async () => {
    const { isError, text } = await callTool('get_collage', { collage: 'Paris' });
    expect(isError).toBe(true);
    expect(text).toContain('"Rome", "Saaremaa"');
  });

  it('shows a collage as a picture, outlined unless told not to', async () => {
    const { images, text } = await callTool('view_collage', { collage: 'Rome' });

    expect(images).toEqual([{ type: 'image', data: 'AAAA', mimeType: 'image/jpeg' }]);
    expect(text).toBe('"Rome", 1024×576.');
    expect(api.preview).toHaveBeenCalledWith(KEY, theirs._id, { width: undefined, outline: true });

    await callTool('view_collage', { collage: 'Rome', outline: false, width: 512 });
    expect(api.preview).toHaveBeenLastCalledWith(KEY, theirs._id, { width: 512, outline: false });
  });
});

describe('view_photos', () => {
  it('shows an album page as a picture and a numbered list with ids', async () => {
    api.sheet.mockResolvedValue({
      ...picture,
      page: 1,
      pages: 2,
      total: 40,
      photos: [
        { n: 1, id: 'ph1', name: 'beach.jpg', dateTaken: '2025-06-14T10:00:00Z', aspect: 1.33, mimetype: 'image/jpeg', tags: [] },
        { n: 2, id: 'ph2', name: 'clip.mp4', aspect: 0.56, mimetype: 'video/mp4', tags: [] },
        { n: 3, id: 'ph3', name: 'square.jpg', aspect: 1, mimetype: 'image/jpeg', tags: [] },
        { n: 4, id: 'ph4', name: 'unknown.jpg', mimetype: 'image/jpeg', tags: [] }
      ]
    } as never);

    const { images, text } = await callTool('view_photos', { albumName: 'Finland', from: '2025-06-01' });

    expect(api.sheet).toHaveBeenCalledWith(KEY, FINLAND, expect.objectContaining({ from: '2025-06-01' }));
    expect(images).toHaveLength(1);
    expect(text).toContain('Finland 2025: 40 photos, page 1 of 2. Page 2 has more.');
    expect(text).toContain('1. beach.jpg (2025-06-14, wide 1.33)  [id ph1]');
    expect(text).toContain('2. clip.mp4 (tall 0.56, video)  [id ph2]');
    expect(text).toContain('3. square.jpg (square 1)  [id ph3]');
    expect(text).toContain('4. unknown.jpg  [id ph4]');
  });

  it('says so when nothing matches', async () => {
    api.sheet.mockResolvedValue({ ...picture, page: 1, pages: 1, total: 0, photos: [] } as never);
    expect((await callTool('view_photos', { albumName: 'Finland', tag: 'dog' })).text).toBe('Nothing in Finland 2025 matches that.');
  });
});

describe('create_collage', () => {
  it('makes an empty collage in the album’s tenant, with the default settings', async () => {
    api.create.mockResolvedValue({ ...ours, _id: '66a000000000000000000009', title: 'Helsinki' } as never);

    const { text } = await callTool('create_collage', { title: 'Helsinki', albumName: 'Finland' });

    const [, input] = api.create.mock.calls[0]!;
    // Personal is named, never left out: an omitted tenant means the connection's default.
    expect(input).toMatchObject({ title: 'Helsinki', albumIds: [FINLAND], groupId: 'personal' });
    expect(input.config).toMatchObject({ version: '2.0', viewport: { width: 1600, height: 900 }, photos: [], texts: [], title: { text: 'Helsinki' } });
    expect(text).toContain('Made "Helsinki" (id 66a000000000000000000009), empty, drawing on Finland 2025');
    expect(text).toContain('Next: view_photos on Finland 2025');
  });

  it('takes the settings of the one it is like, and gives its layout to follow', async () => {
    api.create.mockResolvedValue(ours as never);

    const { text } = await callTool('create_collage', { title: 'Saaremaa', albumName: 'Finland', like: 'Rome' });

    const [, input] = api.create.mock.calls[0]!;
    expect(input.config).toMatchObject({ backgroundColor: '#fce4ec', borderColor: '#fafafa', photoTransparencyMode: false, photos: [], texts: [] });
    expect(text).toContain('"Rome" is laid out like this; follow it with your own photos:');
    expect(text).toContain('p1  beach.jpg');
  });
});

describe('a collage over several albums', () => {
  it('makes one that draws on every album named, each once', async () => {
    api.create.mockResolvedValue({ ...ours, title: '1000 days' } as never);

    const { text } = await callTool('create_collage', {
      title: '1000 days',
      albumName: 'Finland',
      alsoFrom: ['Tartu', 'Finland 2025']
    });

    const [, input] = api.create.mock.calls[0]!;
    expect(input.albumIds).toEqual([FINLAND, TARTU]);
    expect(text).toContain('drawing on Finland 2025 (16 photos), Tartu 2024 (35 photos)');
    expect(text).toContain('Next: view_photos on Finland 2025, Tartu 2024');
  });

  it('adds an album and places a photo from it in the same batch', async () => {
    const tartuPhoto = { _id: 'ph3', filename: 'f3', originalName: 'castle.jpg', mimetype: 'image/jpeg', width: 400, height: 300, tags: [] };
    let added = false;
    api.addAlbums.mockImplementation(async () => {
      added = true;
      return { albumIds: [FINLAND, TARTU], revision: 3 };
    });
    api.get.mockImplementation(
      async () => ({ collage: added ? { ...ours, albumIds: [FINLAND, TARTU] } : ours, photos: added ? [...photos, tartuPhoto] : photos }) as never
    );

    const { isError, text } = await callTool('update_collage', {
      collage: 'Saaremaa',
      changes: [
        { op: 'place_photo', photo: 'ph3', x: 0, y: 0, width: 400, height: 300 },
        { op: 'add_albums', albums: ['Tartu'] }
      ]
    });

    expect(isError).toBe(false);
    expect(api.addAlbums).toHaveBeenCalledWith(KEY, ours._id, [TARTU]);
    const [, , changes] = api.change.mock.calls[0]!;
    expect(changes[0]).toMatchObject({ type: 'put', layer: 'photos', item: { photoId: 'ph3' } });
    expect(text).toContain('Done: added Tartu 2024 (35 photos); placed castle.jpg as p2.');
  });

  it('sends no changes when the batch only adds albums', async () => {
    api.addAlbums.mockResolvedValue({ albumIds: [FINLAND, TARTU], revision: 3 });

    const { text } = await callTool('update_collage', { collage: 'Saaremaa', changes: [{ op: 'add_albums', albums: ['Tartu'] }] });

    expect(api.change).not.toHaveBeenCalled();
    expect(text).toContain('Done: added Tartu 2024 (35 photos).');
  });

  it('points at add_albums when a photo is from an album the collage does not use', async () => {
    const { isError, text } = await callTool('update_collage', {
      collage: 'Saaremaa',
      changes: [{ op: 'place_photo', photo: 'elsewhere', x: 0, y: 0, width: 10, height: 10 }]
    });

    expect(isError).toBe(true);
    expect(text).toContain('add_albums');
  });
});

describe('update_collage', () => {
  it('applies the edits to a collage it made, and answers with how it is now', async () => {
    const { text, images } = await callTool('update_collage', {
      collage: 'Saaremaa',
      changes: [
        { op: 'place_photo', photo: 'ph2', x: 800, y: 0, width: 600, height: 800, focus: 'top' },
        { op: 'edit', item: 't1', text: 'Saaremaa 2025' }
      ]
    });

    const [, id, changes] = api.change.mock.calls[0]!;
    expect(id).toBe(ours._id);
    expect(changes).toHaveLength(2);
    expect(changes[0]).toMatchObject({ type: 'put', layer: 'photos', item: { photoId: 'ph2' } });
    expect(text).toContain('Done: changed t1; placed harbour.jpg as p2.');
    expect(text).toContain('"Saaremaa"');
    expect(images).toHaveLength(0);
  });

  it('makes a text’s box tall enough for its new lines', async () => {
    await callTool('update_collage', { collage: 'Saaremaa', changes: [{ op: 'edit', item: 't1', text: 'Saaremaa\n2025' }] });

    const [, , changes] = api.change.mock.calls[0]!;
    // Two lines at the text's 64: the old box was measured for one.
    expect(changes[0]).toMatchObject({ type: 'put', layer: 'texts', item: { height: Math.round(2 * 64 * TEXT_LINE_HEIGHT + 64 * 0.4) } });
  });

  it('keeps a height it was given', async () => {
    await callTool('update_collage', {
      collage: 'Saaremaa',
      changes: [{ op: 'edit', item: 't1', text: 'Saaremaa\n2025', height: 300 }]
    });

    const [, , changes] = api.change.mock.calls[0]!;
    expect(changes[0]).toMatchObject({ item: { height: 300 } });
  });

  it('attaches a picture when asked to look', async () => {
    const { images } = await callTool('update_collage', { collage: 'Saaremaa', changes: [{ op: 'remove', item: 'p1' }], view: true });

    expect(images).toHaveLength(1);
    expect(api.preview).toHaveBeenCalledWith(KEY, ours._id, { outline: true });
  });

  it('will not touch a collage a person made, and says what to do instead', async () => {
    const { isError, text } = await callTool('update_collage', { collage: 'Rome', changes: [{ op: 'remove', item: 'p1' }] });

    expect(isError).toBe(true);
    expect(text).toContain('Make a new collage like it with create_collage');
    // Not dressed up as a missing permission, which would send them to make a new key.
    expect(text).not.toContain('new key');
    expect(api.change).not.toHaveBeenCalled();
  });

  it('refuses an edit it cannot make before sending anything', async () => {
    const { isError, text } = await callTool('update_collage', {
      collage: 'Saaremaa',
      changes: [{ op: 'place_photo', photo: 'elsewhere', x: 0, y: 0, width: 10, height: 10 }]
    });

    expect(isError).toBe(true);
    expect(text).toContain('view_photos');
    expect(api.change).not.toHaveBeenCalled();
  });
});

describe('which journal it works in', () => {
  /** A connection granted a shared journal and the person's own data, defaulting to the shared one. */
  const withTwoJournals = () =>
    mockedVerify.mockResolvedValue({
      ok: true,
      userId: 'u1',
      keyId: 'k1',
      scopes: ['album:read', 'album:write'],
      tenants: { allowed: ['personal', 'g1'], default: 'g1' },
      tenantNames: { personal: 'My own data', g1: 'Home' }
    });

  beforeEach(() => {
    withTwoJournals();
    api.create.mockResolvedValue(ours as never);
  });

  it('makes a collage in the default journal when none is named', async () => {
    await callTool('create_collage', { title: 'Helsinki', albumName: 'Finland' });

    expect(api.create.mock.calls[0]![1]).toMatchObject({ groupId: 'g1' });
    expect(albumApi.listAlbums).toHaveBeenCalledWith(KEY, expect.objectContaining({ groupId: 'g1' }));
  });

  it('makes one in the person’s own data when asked, though the connection defaults to the shared journal', async () => {
    // Leaving the group out would be read as "the default", which is the shared journal.
    await callTool('create_collage', { title: 'Helsinki', albumName: 'Finland', journal: 'My own data' });

    expect(api.create.mock.calls[0]![1]).toMatchObject({ groupId: 'personal' });
    expect(albumApi.listAlbums).toHaveBeenCalledWith(KEY, expect.objectContaining({ groupId: 'personal' }));
  });

  it('reads and lists in the journal asked for, the same way', async () => {
    await callTool('list_collages', { journal: 'My own data' });
    expect(api.list).toHaveBeenCalledWith(KEY, { groupId: 'personal' });

    await callTool('get_collage', { collage: 'Rome', journal: 'Home' });
    expect(api.list).toHaveBeenLastCalledWith(KEY, { groupId: 'g1' });
  });

  it('refuses a journal the connection was not granted, naming the ones it has', async () => {
    const { isError, text } = await callTool('create_collage', { title: 'x', albumName: 'Finland', journal: 'Work' });

    expect(isError).toBe(true);
    expect(text).toContain('It has access to: My own data, Home');
    expect(api.create).not.toHaveBeenCalled();
  });
});

describe('the make_collage prompt', () => {
  it('spells out the loop for the album and the collage to follow', async () => {
    const payload = await rpc('prompts/get', { name: 'make_collage', arguments: { albumName: 'Finland 2025', like: 'Rome', notes: 'warm colours' } });
    const message = payload.result.messages[0].content.text as string;

    expect(message).toMatch(/^Make a collage from the album "Finland 2025", laid out like "Rome"\.\nAlso: warm colours\n/);
    expect(message).toContain('view_photos');
    expect(message).toContain('update_collage');
  });

  it('carries the layout rules: canvas filled, title kept clear, a caption on every photo, faces in frame', async () => {
    const payload = await rpc('prompts/get', { name: 'make_collage', arguments: { albumName: 'Finland 2025' } });
    const message = payload.result.messages[0].content.text as string;

    expect(message).toContain('Fill the whole canvas');
    expect(message).toContain('Keep the middle for the title');
    expect(message).toContain('Give every photo a short caption');
    expect(message).toContain('focus "top"');
    // Captions are not copied from older collages, so the rule says so.
    expect(message).toContain('never copy an old caption');
  });

  it('leaves out what was not given', async () => {
    const payload = await rpc('prompts/get', { name: 'make_collage', arguments: { albumName: 'Finland 2025' } });
    expect(payload.result.messages[0].content.text).toMatch(/^Make a collage from the album "Finland 2025"\.\n\n1\./);
  });
});
