process.env.SERVICE_NAME = 'album-service';
process.env.JWT_SECRET = 'test-secret';
process.env.INTERNAL_SERVICE_TOKEN = 'internal-test-token';

/**
 * The internal routes chat-service calls, against a real database.
 *
 * What matters is the contract with the rest of Album: a chat photo is an
 * album entry that points at chat's file, so Album's own delete paths must
 * leave that file and its bytes alone.
 */
jest.mock('./services/fileServiceClient', () => ({
  deleteFile: jest.fn(async () => undefined),
  getPhotoSignedUrl: jest.fn(),
  getPhotoSignedUrlsBatch: jest.fn(async () => ({})),
  getFile: jest.fn(),
  getUploadSignedUrl: jest.fn(),
  generateFileId: jest.fn()
}));

const releaseStoredBytes = jest.fn();
jest.mock('./services/storageUsage', () => ({
  assertStorageHeadroom: jest.fn(),
  recordStoredBytes: jest.fn(),
  releaseStoredBytes: (...args: unknown[]) => releaseStoredBytes(...args),
  storageActor: () => ({ userId: 'u-tom' })
}));

import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from './app';
import Album from './models/Album';
import Photo from './models/Photo';
import { deleteFile } from './services/fileServiceClient';

let mongo: MongoMemoryServer;

const internal = {
  get: (path: string) => request(app).get(path).set('x-internal-token', 'internal-test-token'),
  post: (path: string) => request(app).post(path).set('x-internal-token', 'internal-test-token'),
  delete: (path: string) => request(app).delete(path).set('x-internal-token', 'internal-test-token')
};

const TOM = { id: 'u-tom', email: 'tom@example.com', name: 'Tom', groups: ['g1'] };
const asTom = () => `Bearer ${jwt.sign(TOM, 'test-secret', { expiresIn: '1h' })}`;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(async () => {
  jest.clearAllMocks();
  await Promise.all([Album.deleteMany({}), Photo.deleteMany({})]);
});

async function groupAlbum(name = 'Rome', groupId = 'g1'): Promise<string> {
  const res = await internal.post(`/internal/groups/${groupId}/albums`).send({ name, userId: 'u-tom' });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

const photoFrom = (albumId: string, overrides: Record<string, unknown> = {}) => ({
  groupId: 'g1',
  albumId,
  conversationId: 'c1',
  messageId: 'm1',
  fileId: 'chat/g1/c1/abc/original.jpg',
  thumbnailFileId: 'chat/g1/c1/abc/thumb.webp',
  mimetype: 'image/jpeg',
  size: 500_000,
  width: 1200,
  height: 900,
  takenAt: '2026-09-22T10:00:00.000Z',
  ...overrides
});

describe('the internal gate', () => {
  it('refuses a caller without the service token', async () => {
    const res = await request(app).get('/internal/groups/g1/albums');
    expect(res.status).toBe(401);
  });

  it('refuses a person’s own session, which is not a service', async () => {
    const res = await request(app).get('/internal/groups/g1/albums').set('Authorization', asTom());
    expect(res.status).toBe(401);
  });
});

describe('albums for the picker', () => {
  it('creates a group album and lists only that group’s', async () => {
    await groupAlbum('Rome');
    await groupAlbum('Elsewhere', 'g9');

    const res = await internal.get('/internal/groups/g1/albums');

    expect(res.body.data).toEqual([{ id: expect.any(String), name: 'Rome', photoCount: 0 }]);
  });

  it('answers a missing or foreign album as not found', async () => {
    const foreign = await groupAlbum('Elsewhere', 'g9');

    expect((await internal.get(`/internal/groups/g1/albums/${foreign}`)).status).toBe(404);
    expect((await internal.get('/internal/groups/g1/albums/not-an-id')).status).toBe(404);
  });
});

describe('adding a chat photo', () => {
  it('points at chat’s files, counts it, and makes it the cover', async () => {
    const albumId = await groupAlbum();

    const res = await internal.post('/internal/chat-photos').send(photoFrom(albumId));

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ albumId, albumName: 'Rome' });
    const photo = await Photo.findById(res.body.data.photoId);
    expect(photo).toMatchObject({
      minioFileId: 'chat/g1/c1/abc/original.jpg',
      minioThumbnailFileId: 'chat/g1/c1/abc/thumb.webp',
      source: { kind: 'chat', conversationId: 'c1', messageId: 'm1' }
    });
    const album = await Album.findById(albumId);
    expect(album).toMatchObject({ photoCount: 1, totalSize: 0, coverPhotoId: res.body.data.photoId });
  });

  it('gives a video no still-image thumbnail, which Album would try to play', async () => {
    const albumId = await groupAlbum();

    const res = await internal
      .post('/internal/chat-photos')
      .send(photoFrom(albumId, { fileId: 'chat/g1/c1/v/original.mp4', mimetype: 'video/mp4', thumbnailFileId: 'chat/g1/c1/v2/original.jpg' }));

    expect((await Photo.findById(res.body.data.photoId))!.minioThumbnailFileId).toBeUndefined();
  });

  it('is idempotent on the file, so a retry does not add it twice', async () => {
    const albumId = await groupAlbum();
    await internal.post('/internal/chat-photos').send(photoFrom(albumId));
    await internal.post('/internal/chat-photos').send(photoFrom(albumId));

    expect(await Photo.countDocuments()).toBe(1);
  });

  it('refuses an album in another group', async () => {
    const foreign = await groupAlbum('Elsewhere', 'g9');

    const res = await internal.post('/internal/chat-photos').send(photoFrom(foreign));

    expect(res.status).toBe(404);
  });
});

describe('removing', () => {
  it('takes a message’s photos out without deleting any file', async () => {
    const albumId = await groupAlbum();
    await internal.post('/internal/chat-photos').send(photoFrom(albumId));
    await internal.post('/internal/chat-photos').send(photoFrom(albumId, { fileId: 'chat/g1/c1/def/original.jpg' }));

    const res = await internal.delete('/internal/chat-photos/m1');

    expect(res.body.data).toEqual({ removed: 2 });
    expect(await Photo.countDocuments()).toBe(0);
    expect(await Album.findById(albumId)).toMatchObject({ photoCount: 0, coverPhotoId: undefined });
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('can take out one file of the message', async () => {
    const albumId = await groupAlbum();
    await internal.post('/internal/chat-photos').send(photoFrom(albumId));
    await internal.post('/internal/chat-photos').send(photoFrom(albumId, { fileId: 'chat/g1/c1/def/original.jpg' }));

    await internal.delete('/internal/chat-photos/m1?fileId=chat/g1/c1/def/original.jpg');

    expect(await Photo.countDocuments()).toBe(1);
  });

  it('leaves chat’s file and bytes alone when deleted from Album’s own pages', async () => {
    const albumId = await groupAlbum();
    const added = await internal.post('/internal/chat-photos').send(photoFrom(albumId));

    const res = await request(app).delete(`/api/photos/${added.body.data.photoId}`).set('Authorization', asTom());

    expect(res.status).toBe(200);
    expect(deleteFile).not.toHaveBeenCalled();
    expect(releaseStoredBytes).not.toHaveBeenCalled();
  });

  it('leaves chat’s files and bytes alone when the whole album is deleted', async () => {
    const albumId = await groupAlbum();
    await internal.post('/internal/chat-photos').send(photoFrom(albumId));

    const res = await request(app).delete(`/api/albums/${albumId}`).set('Authorization', asTom());

    expect(res.status).toBe(200);
    expect(deleteFile).not.toHaveBeenCalled();
    expect(releaseStoredBytes).toHaveBeenCalledWith(expect.anything(), expect.anything(), 0);
  });
});

describe('moving', () => {
  it('moves one file of a message to another album, keeping what Album added to it', async () => {
    const rome = await groupAlbum('Rome');
    const home = await groupAlbum('Home');
    const first = await internal.post('/internal/chat-photos').send(photoFrom(rome));
    await internal.post('/internal/chat-photos').send(photoFrom(rome, { fileId: 'chat/g1/c1/def/original.jpg' }));
    await Photo.updateOne({ _id: first.body.data.photoId }, { $set: { title: 'Trevi' } });

    const res = await internal
      .post('/internal/chat-photos/m1/move')
      .send({ groupId: 'g1', albumId: home, fileIds: ['chat/g1/c1/abc/original.jpg'] });

    expect(res.body.data).toEqual({ moved: 1, albumId: home, albumName: 'Home' });
    const photo = await Photo.findById(first.body.data.photoId);
    expect(photo).toMatchObject({ albumId: expect.anything(), title: 'Trevi' });
    expect(String(photo!.albumId)).toBe(home);
    expect(await Album.findById(rome)).toMatchObject({ photoCount: 1 });
    expect(await Album.findById(home)).toMatchObject({ photoCount: 1, coverPhotoId: first.body.data.photoId });
    // It was Rome's cover; Rome no longer points at a photo it lost.
    expect((await Album.findById(rome))!.coverPhotoId).not.toBe(first.body.data.photoId);
  });

  it('refuses to move into another group’s album', async () => {
    const rome = await groupAlbum('Rome');
    const foreign = await groupAlbum('Elsewhere', 'g9');
    await internal.post('/internal/chat-photos').send(photoFrom(rome));

    const res = await internal.post('/internal/chat-photos/m1/move').send({ groupId: 'g1', albumId: foreign });

    expect(res.status).toBe(404);
    expect(await Album.findById(rome)).toMatchObject({ photoCount: 1 });
  });
});
