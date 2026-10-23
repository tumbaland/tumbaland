process.env.SERVICE_NAME = 'album-service';
process.env.JWT_SECRET = 'test-secret';

/**
 * Autosave against a real database: the revision check is what keeps two
 * people's edits from overwriting each other, and that only means something
 * with real concurrent writes.
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

import os from 'os';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from './app';
import { CollageModel } from './collage/collage.model';

let mongo: MongoMemoryServer;

const token = (user: { id: string; groups: string[] }) =>
  `Bearer ${jwt.sign({ ...user, email: `${user.id}@example.com`, name: user.id }, 'test-secret', { expiresIn: '1h' })}`;
const TOM = token({ id: 'u-tom', groups: ['g1'] });
const IRJA = token({ id: 'u-irja', groups: ['g1'] });
const STRANGER = token({ id: 'u-x', groups: ['g9'] });

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  // The driver loads `os` with a dynamic import, which Jest's sandbox refuses, so it is handed over.
  await mongoose.connect(mongo.getUri(), { runtimeAdapters: { os } });
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(async () => {
  await CollageModel.deleteMany({});
});

async function groupCollage(photos: unknown[] = [{ id: 'a', x: 0 }, { id: 'b', x: 10 }]): Promise<string> {
  const res = await request(app)
    .post('/api/collages')
    .set('Authorization', TOM)
    .send({ title: 'Rome', albumIds: ['album-1'], groupId: 'g1', config: { version: '2.0', photos, texts: [] } });
  expect(res.status).toBe(201);
  return res.body.data._id as string;
}

const change = (auth: string, id: string, changes: unknown[]) =>
  request(app).post(`/api/collages/${id}/changes`).set('Authorization', auth).send({ changes });

const stored = async (id: string) => (await CollageModel.findById(id).lean())!;

describe('collage changes', () => {
  it('applies a batch and counts the revision up', async () => {
    const id = await groupCollage();

    const res = await change(TOM, id, [
      { type: 'put', layer: 'photos', item: { id: 'b', x: 50 } },
      { type: 'settings', values: { backgroundColor: '#fce4ec' } }
    ]);

    expect(res.status).toBe(200);
    expect(res.body.data.revision).toBe(1);
    const collage = await stored(id);
    expect(collage.config.photos).toEqual([{ id: 'a', x: 0 }, { id: 'b', x: 50 }]);
    expect((collage.config as unknown as Record<string, unknown>).backgroundColor).toBe('#fce4ec');
  });

  it('keeps both people’s changes when they land at the same moment', async () => {
    const id = await groupCollage();

    await Promise.all([
      change(TOM, id, [{ type: 'put', layer: 'photos', item: { id: 'a', x: 1 } }]),
      change(IRJA, id, [{ type: 'put', layer: 'photos', item: { id: 'b', x: 2 } }]),
      change(IRJA, id, [{ type: 'put', layer: 'texts', item: { id: 't1', text: 'Roma' } }])
    ]);

    const collage = await stored(id);
    expect(collage.config.photos).toEqual([{ id: 'a', x: 1 }, { id: 'b', x: 2 }]);
    expect((collage.config as unknown as { texts: unknown[] }).texts).toEqual([{ id: 't1', text: 'Roma' }]);
    expect(collage.revision).toBe(3);
  });

  it('works on a collage saved before revisions existed', async () => {
    const id = await groupCollage();
    await CollageModel.collection.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $unset: { revision: '' } });

    const res = await change(TOM, id, [{ type: 'remove', layer: 'photos', id: 'a' }]);

    expect(res.status).toBe(200);
    expect((await stored(id)).config.photos).toEqual([{ id: 'b', x: 10 }]);
  });

  it('counts a whole-collage save as a write too', async () => {
    const id = await groupCollage();

    await request(app).put(`/api/collages/${id}`).set('Authorization', TOM).send({ title: 'Roma' });

    expect((await stored(id)).revision).toBe(1);
  });

  it('answers someone outside the collage’s group as if it were not there', async () => {
    const id = await groupCollage();

    const res = await change(STRANGER, id, [{ type: 'remove', layer: 'photos', id: 'a' }]);

    expect(res.status).toBe(404);
    expect((await stored(id)).config.photos).toHaveLength(2);
  });

  it('refuses a change it does not understand', async () => {
    const id = await groupCollage();

    const res = await change(TOM, id, [{ type: 'settings', values: { albumIds: ['sneaky'] } }]);

    expect(res.status).toBe(400);
  });

  it('answers a missing collage as missing', async () => {
    const res = await change(TOM, new mongoose.Types.ObjectId().toString(), [
      { type: 'remove', layer: 'photos', id: 'a' }
    ]);
    expect(res.status).toBe(404);
  });
});
