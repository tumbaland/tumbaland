process.env.SERVICE_NAME = 'album-service';
process.env.JWT_SECRET = 'test-secret';

/**
 * What a connected assistant may do with collages, against a real database:
 * read and look at any, make new ones, change only the ones it made, and never
 * replace or delete one wholesale.
 */
jest.mock('./services/fileServiceClient', () => ({
  deleteFile: jest.fn(async () => undefined),
  getPhotoSignedUrl: jest.fn(),
  getPhotoSignedUrlsBatch: jest.fn(async () => ({})),
  getSignedUrlsBatch: jest.fn(async () => ({})),
  getFile: jest.fn(),
  getUploadSignedUrl: jest.fn(),
  generateFileId: jest.fn()
}));

import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { mintAccessToken, type ApiKeyScope } from '@tumbaland/backend-core';
import app from './app';
import { CollageModel } from './collage/collage.model';
import Album from './models/Album';
import Photo from './models/Photo';
import { getFile } from './services/fileServiceClient';
import { overrideMembershipLookupForTests } from '@tumbaland/backend-core/dist/groups/membership';

let mongo: MongoMemoryServer;

const TOM = `Bearer ${jwt.sign({ id: 'u-tom', email: 'u-tom@example.com', name: 'Tom', groups: [] }, 'test-secret', { expiresIn: '1h' })}`;

const GROUP = 'g1';

const assistant = (
  scopes: ApiKeyScope[] = ['album:read', 'album:write'],
  userId = 'u-tom',
  tenants: { allowed: string[]; default: string } = { allowed: ['personal'], default: 'personal' }
) =>
  `Bearer ${
    mintAccessToken({
      userId,
      email: `${userId}@example.com`,
      name: userId,
      resource: 'https://mcp.example.com',
      issuer: 'https://auth.example.com',
      scopes,
      tenants: tenants.allowed,
      defaultTenant: tenants.default,
      tenantNames: { personal: 'My own data', [GROUP]: 'Home' },
      clientId: 'client-1',
      clientName: 'Claude'
    }).accessToken
  }`;

/** A solid-colour JPEG, as a thumbnail would arrive from file-service. */
const jpeg = async (width: number, height: number, colour: string): Promise<Buffer> => {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, width, height);
  return canvas.encode('jpeg', 95);
};

/** The colour at one pixel of a base64 JPEG, as [r, g, b]. */
const pixel = async (base64: string, x: number, y: number): Promise<number[]> => {
  const image = await loadImage(Buffer.from(base64, 'base64'));
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  return Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3));
};

const near = (actual: number[], expected: number[]) =>
  expect(actual.every((value, index) => Math.abs(value - expected[index]!) < 24)).toBe(true);

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(async () => {
  await Promise.all([CollageModel.deleteMany({}), Album.deleteMany({}), Photo.deleteMany({})]);
  jest.mocked(getFile).mockReset();
});

const config = (photos: unknown[] = []) => ({ version: '2.0', viewport: { width: 1600, height: 900 }, photos, texts: [] });

const create = (auth: string, body: Record<string, unknown> = {}) =>
  request(app)
    .post('/api/collages')
    .set('Authorization', auth)
    .send({ title: 'Saaremaa', albumIds: [String(new mongoose.Types.ObjectId())], config: config(), ...body });

const change = (auth: string, id: string) =>
  request(app)
    .post(`/api/collages/${id}/changes`)
    .set('Authorization', auth)
    .send({ changes: [{ type: 'settings', values: { backgroundColor: '#fce4ec' } }] });

describe('making and changing collages', () => {
  it('records that the assistant made it, under its connection’s name', async () => {
    const res = await create(assistant());

    expect(res.status).toBe(201);
    const stored = await CollageModel.findById(res.body.data._id).lean();
    expect(stored).toMatchObject({ userId: 'u-tom', madeBy: { kind: 'assistant', label: 'Claude' } });
    expect(stored!.groupId).toBeUndefined();
  });

  it('does not let a person claim an assistant made theirs', async () => {
    const res = await create(TOM, { madeBy: { kind: 'assistant', label: 'Claude' } });

    expect((await CollageModel.findById(res.body.data._id).lean())!.madeBy).toBeUndefined();
  });

  it('lets the assistant change a collage it made', async () => {
    const id = (await create(assistant())).body.data._id;

    expect((await change(assistant(), id)).status).toBe(200);
  });

  it('refuses the assistant a collage a person made, and says what to do instead', async () => {
    const id = (await create(TOM)).body.data._id;

    const res = await change(assistant(), id);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Make a new collage like it/);
  });

  it('still lets the person change what the assistant made', async () => {
    const id = (await create(assistant())).body.data._id;

    expect((await change(TOM, id)).status).toBe(200);
  });

  it('holds a read-only connection to reading', async () => {
    const id = (await create(TOM)).body.data._id;
    const reader = assistant(['album:read']);

    expect((await request(app).get('/api/collages').set('Authorization', reader)).status).toBe(200);
    expect((await request(app).get(`/api/collages/${id}`).set('Authorization', reader)).status).toBe(200);
    expect((await create(reader)).status).toBe(403);
    expect((await change(reader, id)).status).toBe(403);
  });

  it('never lets an assistant replace or delete a collage, even its own', async () => {
    const id = (await create(assistant())).body.data._id;

    const replace = await request(app).put(`/api/collages/${id}`).set('Authorization', assistant()).send({ title: 'x' });
    const remove = await request(app).delete(`/api/collages/${id}`).set('Authorization', assistant());

    expect(replace.status).toBe(403);
    expect(remove.status).toBe(403);
    expect(await CollageModel.findById(id)).not.toBeNull();
  });

  it('keeps one person’s collages from another person’s assistant, answering as if they were not there', async () => {
    const id = (await create(TOM)).body.data._id;

    const res = await request(app).get(`/api/collages/${id}`).set('Authorization', assistant(['album:read'], 'u-x'));

    expect(res.status).toBe(404);
  });
});

describe('a connection pinned to a shared journal', () => {
  // No group-service here: the test setup takes a token's own `groups` claim as
  // its membership, and an assistant's token has none. Say what it would answer.
  beforeAll(() => overrideMembershipLookupForTests(async () => [GROUP]));
  afterAll(() => overrideMembershipLookupForTests(async (user) => user.groups ?? []));

  const shared = assistant(['album:read', 'album:write'], 'u-tom', { allowed: ['personal', GROUP], default: GROUP });
  const personal = assistant(['album:read', 'album:write'], 'u-tom', { allowed: ['personal', GROUP], default: 'personal' });

  it('makes the collage in the shared journal, and lists it there and not in the personal one', async () => {
    const made = await create(shared);
    expect(made.status).toBe(201);
    expect((await CollageModel.findById(made.body.data._id).lean())).toMatchObject({ groupId: GROUP, madeBy: { kind: 'assistant' } });

    const inShared = await request(app).get('/api/collages').set('Authorization', shared);
    const inPersonal = await request(app).get('/api/collages').set('Authorization', personal);

    expect(inShared.body.data.map((entry: { _id: string }) => entry._id)).toEqual([made.body.data._id]);
    expect(inPersonal.body.data).toEqual([]);
  });

  it('makes one in the personal journal when that is named, though its default is the shared one', async () => {
    // What an assistant sends for "my own data": the literal, since leaving the
    // group out reads as the default.
    const made = await create(shared, { groupId: 'personal' });

    expect(made.status).toBe(201);
    const stored = await CollageModel.findById(made.body.data._id).lean();
    expect(stored!.groupId).toBeUndefined();
    expect(stored).toMatchObject({ userId: 'u-tom', madeBy: { kind: 'assistant' } });

    const mine = await request(app).get('/api/collages?groupId=personal').set('Authorization', shared);
    expect(mine.body.data.map((entry: { _id: string }) => entry._id)).toEqual([made.body.data._id]);
  });

  it('can be asked for the other journal by name, and only the ones it was granted', async () => {
    await create(shared);

    const asked = await request(app).get(`/api/collages?groupId=${GROUP}`).set('Authorization', personal);
    expect(asked.body.data).toHaveLength(1);

    const refused = await request(app).get('/api/collages?groupId=g-other').set('Authorization', personal);
    expect(refused.status).toBe(403);
  });

  it('keeps a connection that was never granted the journal out of what other members made there', async () => {
    const id = (await create(shared)).body.data._id;
    // Irja is in the group too, but her connection was granted only her own data.
    const irja = assistant(['album:read', 'album:write'], 'u-irja');

    expect((await request(app).get(`/api/collages/${id}`).set('Authorization', irja)).status).toBe(404);
    expect((await request(app).get(`/api/collages/${id}/preview`).set('Authorization', irja)).status).toBe(404);
    expect((await change(irja, id)).status).toBe(404);
  });

  it('lets her connection in once it was granted the journal', async () => {
    const id = (await create(shared)).body.data._id;
    const irja = assistant(['album:read', 'album:write'], 'u-irja', { allowed: ['personal', GROUP], default: GROUP });

    expect((await request(app).get(`/api/collages/${id}`).set('Authorization', irja)).status).toBe(200);
    // Tom's assistant made it, and an assistant may change what an assistant made.
    expect((await change(irja, id)).status).toBe(200);
  });
});

describe('looking at collages and albums', () => {
  const album = () => Album.create({ name: 'Saaremaa', userId: 'u-tom' });
  const photo = async (albumId: unknown, fields: Record<string, unknown>) =>
    (await Photo.create({
      filename: 'f.jpg',
      originalName: 'IMG.jpg',
      albumId: String(albumId),
      mimetype: 'image/jpeg',
      size: 1,
      ...fields
    })) as unknown as { _id: unknown };

  it('draws the collage with its photos where they sit', async () => {
    const { _id: albumId } = await album();
    const red = await photo(albumId, { minioThumbnailFileId: 'thumb-red', width: 400, height: 300 });
    jest.mocked(getFile).mockResolvedValue(await jpeg(400, 300, '#ff0000'));
    const id = (
      await create(TOM, {
        albumIds: [String(albumId)],
        config: {
          ...config([{ id: 'a', photoId: String(red._id), x: 0, y: 0, width: 800, height: 450 }]),
          backgroundColor: '#0000ff'
        }
      })
    ).body.data._id;

    const res = await request(app).get(`/api/collages/${id}/preview?width=800`).set('Authorization', assistant(['album:read']));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ mimeType: 'image/jpeg', width: 800, height: 450 });
    // The photo covers the top-left quarter; the background shows elsewhere.
    near(await pixel(res.body.data.image, 100, 100), [255, 0, 0]);
    near(await pixel(res.body.data.image, 700, 400), [0, 0, 255]);
  });

  it('leaves out a photo from outside the collage’s albums', async () => {
    const { _id: albumId } = await album();
    const elsewhere = await photo(new mongoose.Types.ObjectId(), { minioThumbnailFileId: 'thumb' });
    jest.mocked(getFile).mockResolvedValue(await jpeg(10, 10, '#ff0000'));
    const id = (
      await create(TOM, {
        albumIds: [String(albumId)],
        config: config([{ id: 'a', photoId: String(elsewhere._id), x: 0, y: 0, width: 800, height: 450 }])
      })
    ).body.data._id;

    await request(app).get(`/api/collages/${id}/preview`).set('Authorization', assistant(['album:read']));

    expect(getFile).not.toHaveBeenCalled();
  });

  it('measures the shape of a photo that has no size recorded, from its picture', async () => {
    const { _id: albumId } = await album();
    const old = await photo(albumId, { minioThumbnailFileId: 'thumb-old' });
    const elsewhere = await photo(new mongoose.Types.ObjectId(), { minioThumbnailFileId: 'thumb' });
    jest.mocked(getFile).mockResolvedValue(await jpeg(300, 400, '#ff0000'));
    const id = (await create(TOM, { albumIds: [String(albumId)] })).body.data._id;

    const res = await request(app)
      .get(`/api/collages/${id}/shapes?photos=${String(old._id)},${String(elsewhere._id)},not-an-id`)
      .set('Authorization', assistant(['album:read']));

    expect(res.status).toBe(200);
    // Only the collage's own photo: one from another album is not its to measure.
    expect(res.body.data).toEqual({ [String(old._id)]: 0.75 });
  });

  it('refuses to measure more photos than a batch of edits could use', async () => {
    const id = (await create(TOM)).body.data._id;
    const many = Array.from({ length: 61 }, () => String(new mongoose.Types.ObjectId())).join(',');

    const res = await request(app).get(`/api/collages/${id}/shapes?photos=${many}`).set('Authorization', assistant(['album:read']));

    expect(res.status).toBe(400);
  });

  it('lays an album out as a numbered sheet, in the order the photos were taken', async () => {
    const { _id: albumId } = await album();
    await photo(albumId, { originalName: 'later.jpg', minioThumbnailFileId: 't2', metadata: { dateTaken: new Date('2025-07-02') } });
    await photo(albumId, { originalName: 'first.jpg', minioThumbnailFileId: 't1', metadata: { dateTaken: new Date('2025-07-01') } });
    await photo(albumId, { originalName: 'third.jpg', minioThumbnailFileId: 't3', metadata: { dateTaken: new Date('2025-07-03') } });
    jest.mocked(getFile).mockResolvedValue(await jpeg(300, 200, '#00ff00'));

    const res = await request(app)
      .get(`/api/photos/album/${String(albumId)}/sheet?size=2&page=1`)
      .set('Authorization', assistant(['album:read']));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ page: 1, pages: 2, total: 3, mimeType: 'image/jpeg' });
    expect(res.body.data.photos).toEqual([
      expect.objectContaining({ n: 1, name: 'first.jpg', aspect: 1.5 }),
      expect.objectContaining({ n: 2, name: 'later.jpg' })
    ]);

    const next = await request(app)
      .get(`/api/photos/album/${String(albumId)}/sheet?size=2&page=2`)
      .set('Authorization', assistant(['album:read']));
    expect(next.body.data.photos).toEqual([expect.objectContaining({ n: 3, name: 'third.jpg' })]);
  });

  it('narrows a sheet to the days asked for', async () => {
    const { _id: albumId } = await album();
    await photo(albumId, { originalName: 'in.jpg', metadata: { dateTaken: new Date('2025-07-02T12:00:00Z') } });
    await photo(albumId, { originalName: 'out.jpg', metadata: { dateTaken: new Date('2025-08-02T12:00:00Z') } });

    const res = await request(app)
      .get(`/api/photos/album/${String(albumId)}/sheet?from=2025-07-01&to=2025-07-31`)
      .set('Authorization', assistant(['album:read']));

    expect(res.body.data.photos.map((entry: { name: string }) => entry.name)).toEqual(['in.jpg']);
  });

  it('counts the whole of the last day asked for', async () => {
    const { _id: albumId } = await album();
    await photo(albumId, { originalName: 'noon.jpg', metadata: { dateTaken: new Date('2025-07-31T12:00:00Z') } });
    await photo(albumId, { originalName: 'next.jpg', metadata: { dateTaken: new Date('2025-08-01T00:30:00Z') } });

    const res = await request(app)
      .get(`/api/photos/album/${String(albumId)}/sheet?to=2025-07-31`)
      .set('Authorization', assistant(['album:read']));

    expect(res.body.data.photos.map((entry: { name: string }) => entry.name)).toEqual(['noon.jpg']);
  });

  it('answers an album the caller cannot reach as missing', async () => {
    const { _id: albumId } = await Album.create({ name: 'Theirs', userId: 'u-x' });

    const res = await request(app)
      .get(`/api/photos/album/${String(albumId)}/sheet`)
      .set('Authorization', assistant(['album:read']));

    expect(res.status).toBe(404);
  });

  it('refuses a date it cannot read', async () => {
    const { _id: albumId } = await album();

    const res = await request(app)
      .get(`/api/photos/album/${String(albumId)}/sheet?from=someday`)
      .set('Authorization', assistant(['album:read']));

    expect(res.status).toBe(400);
  });
});
