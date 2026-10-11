jest.mock('@tumbaland/backend-core', () => ({
  requireEnv: (name: string) => process.env[name] ?? 'http://album-service:4002'
}));

import { collages, resolveCollage, Collage } from './collage';
import { ShapeError } from './schemas';

const respond = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    text: async () => JSON.stringify(status < 400 ? { success: true, data: body } : { success: false, message: body })
  } as Response);

const KEY = 'tmb_live_abcdef123456_secret';
const fetchMock = () => global.fetch as jest.Mock;
const lastUrl = (): URL => fetchMock().mock.calls.at(-1)[0];
const lastInit = (): RequestInit => fetchMock().mock.calls.at(-1)[1];

/** A collage as album-service sends one: a Mongoose document, extra fields and all. */
const stored = {
  _id: '66a000000000000000000001',
  title: 'Saaremaa',
  albumIds: ['66b000000000000000000001'],
  config: { version: '2.0', photos: [], texts: [] },
  userId: 'u1',
  revision: 3,
  madeBy: { kind: 'assistant', label: 'Claude' },
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-02T10:00:00.000Z',
  __v: 0
};

beforeEach(() => {
  global.fetch = jest.fn() as unknown as typeof fetch;
});

describe('the collage client', () => {
  it('lists collages in the tenant asked for', async () => {
    fetchMock().mockReturnValue(respond([stored]));

    const list = await collages.list(KEY, { groupId: 'g1' });

    expect(list[0]).toMatchObject({ title: 'Saaremaa', madeBy: { label: 'Claude' } });
    expect(lastUrl().pathname).toBe('/api/collages');
    expect(lastUrl().searchParams.get('groupId')).toBe('g1');
  });

  it('reads a collage with the photos it can use', async () => {
    fetchMock().mockReturnValue(
      respond({
        collage: stored,
        photos: [{ _id: 'p1', filename: 'f.jpg', originalName: 'IMG_1.jpg', mimetype: 'image/jpeg', width: 400, height: 300, tags: [], signedUrl: 'https://x' }]
      })
    );

    const { collage, photos } = await collages.get(KEY, stored._id);

    expect(collage.title).toBe('Saaremaa');
    expect(photos[0]).toMatchObject({ originalName: 'IMG_1.jpg', width: 400 });
    // The signed links are skipped: nothing here draws a photo.
    expect(lastUrl().searchParams.get('urls')).toBe('0');
  });

  it('names the field when a collage comes back in a shape it does not expect', async () => {
    fetchMock().mockReturnValue(respond([{ title: 'no id' }]));
    await expect(collages.list(KEY, {})).rejects.toBeInstanceOf(ShapeError);
  });

  it('asks for an outlined preview only when told to', async () => {
    fetchMock().mockReturnValue(respond({ image: 'abc', mimeType: 'image/jpeg', width: 1024, height: 576 }));

    await collages.preview(KEY, 'c1', { width: 800, outline: true });
    expect(lastUrl().pathname).toBe('/api/collages/c1/preview');
    expect(lastUrl().searchParams.get('outline')).toBe('1');
    expect(lastUrl().searchParams.get('width')).toBe('800');

    await collages.preview(KEY, 'c1', {});
    expect(lastUrl().searchParams.has('outline')).toBe(false);
  });

  it('reads an album’s sheet with its filters', async () => {
    fetchMock().mockReturnValue(
      respond({ image: 'abc', mimeType: 'image/jpeg', width: 10, height: 10, page: 1, pages: 1, total: 1, photos: [{ n: 1, id: 'p1', name: 'a.jpg', tags: [] }] })
    );

    const sheet = await collages.sheet(KEY, 'a1', { page: 2, tag: 'beach', from: '2025-07-01' });

    expect(sheet.photos[0]).toMatchObject({ n: 1, mimetype: 'image/jpeg' });
    expect(lastUrl().pathname).toBe('/api/photos/album/a1/sheet');
    expect(Object.fromEntries(lastUrl().searchParams)).toEqual({ page: '2', tag: 'beach', from: '2025-07-01' });
  });

  it('creates a collage and sends changes as album-service takes them', async () => {
    fetchMock().mockReturnValue(respond(stored));
    await collages.create(KEY, { title: 'Saaremaa', albumIds: ['a1'], config: {} });
    expect(lastInit().method).toBe('POST');
    expect(JSON.parse(lastInit().body as string)).toEqual({ title: 'Saaremaa', albumIds: ['a1'], config: {} });

    fetchMock().mockReturnValue(respond({ revision: 4 }));
    await expect(collages.change(KEY, 'c1', [{ type: 'remove', layer: 'photos', id: 'x' }])).resolves.toEqual({ revision: 4 });
    expect(lastUrl().pathname).toBe('/api/collages/c1/changes');
  });
});

describe('resolveCollage', () => {
  const list = [
    { ...stored, _id: '66a000000000000000000001', title: 'Saaremaa 2025' },
    { ...stored, _id: '66a000000000000000000002', title: 'Rome' },
    { ...stored, _id: '66a000000000000000000003', title: 'Rome' }
  ] as unknown as Collage[];

  it('finds a collage by part of its title, whatever the case', () => {
    expect(resolveCollage(list, 'saaremaa')._id).toBe('66a000000000000000000001');
  });

  it('finds one by id, which is how two with one title are told apart', () => {
    expect(resolveCollage(list, '66a000000000000000000003')._id).toBe('66a000000000000000000003');
  });

  it('asks which one when a title is shared, giving the ids', () => {
    expect(() => resolveCollage(list, 'Rome')).toThrow(/66a000000000000000000002.*66a000000000000000000003/);
  });

  it('lists the real titles on a miss', () => {
    expect(() => resolveCollage(list, 'Paris')).toThrow('No collage called "Paris". The collages are: "Saaremaa 2025", "Rome", "Rome".');
    expect(() => resolveCollage([], 'Paris')).toThrow('(none yet)');
  });
});
