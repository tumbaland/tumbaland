process.env.SERVICE_NAME = 'album-service';
process.env.JWT_SECRET = 'test-secret';

/**
 * Two people with the same collage open, over real HTTP connections: what one
 * saves reaches the other, not themselves, and each sees who else is here.
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

import http from 'http';
import { AddressInfo } from 'net';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from './app';
import { CollageModel } from './collage/collage.model';
import { closeAll } from './collage/collageLive';

let mongo: MongoMemoryServer;
let server: http.Server;
let port: number;

const token = (user: { id: string; name: string; groups: string[] }) =>
  `Bearer ${jwt.sign({ ...user, email: `${user.id}@example.com` }, 'test-secret', { expiresIn: '1h' })}`;
const TOM = token({ id: 'u-tom', name: 'Tom', groups: ['g1'] });
const IRJA = token({ id: 'u-irja', name: 'Irja', groups: ['g1'] });
const STRANGER = token({ id: 'u-x', name: 'X', groups: ['g9'] });

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  server = app.listen(0);
  port = (server.address() as AddressInfo).port;
}, 60_000);

afterAll(async () => {
  closeAll();
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(async () => {
  closeAll();
  await CollageModel.deleteMany({});
});

async function groupCollage(): Promise<string> {
  const res = await request(app)
    .post('/api/collages')
    .set('Authorization', TOM)
    .send({
      title: 'Rome',
      albumIds: ['album-1'],
      groupId: 'g1',
      config: { version: '2.0', photos: [{ id: 'a', x: 0 }], texts: [] }
    });
  return res.body.data._id as string;
}

interface Frame {
  event: string;
  data: Record<string, unknown>;
}

/** An open stream, collecting frames as they arrive. */
function open(auth: string, collageId: string, session: string) {
  const frames: Frame[] = [];
  let status = 0;
  let buffer = '';
  const waiters: (() => void)[] = [];
  const req = http.get(
    { port, path: `/api/collages/${collageId}/live?session=${session}`, headers: { Authorization: auth } },
    (res) => {
      status = res.statusCode ?? 0;
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        buffer += chunk;
        let end: number;
        while ((end = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const event = /^event: (.*)$/m.exec(block)?.[1];
          const data = /^data: (.*)$/m.exec(block)?.[1];
          if (event && data) frames.push({ event, data: JSON.parse(data) });
        }
        waiters.splice(0).forEach((wake) => wake());
      });
      res.on('end', () => waiters.splice(0).forEach((wake) => wake()));
    }
  );
  req.on('error', () => undefined);

  /** Waits for a frame matching `test`, from the start of the stream. */
  const next = (test: (frame: Frame) => boolean, timeoutMs = 3000): Promise<Frame> =>
    new Promise((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(new Error(`no matching frame; got ${JSON.stringify(frames)}`)),
        timeoutMs
      );
      const check = () => {
        const found = frames.find(test);
        if (found) {
          clearTimeout(deadline);
          resolve(found);
        } else waiters.push(check);
      };
      check();
    });

  return { frames, next, status: () => status, close: () => req.destroy() };
}

const viewers = (frame: Frame) => (frame.data.viewers as { name: string; selection: string | null }[]) ?? [];

describe('collage live', () => {
  it('opens with the revision, and tells everyone who is here', async () => {
    const id = await groupCollage();
    const tom = open(TOM, id, 'tom-session-1');
    await tom.next((f) => f.event === 'ready');
    expect((await tom.next((f) => f.event === 'ready')).data.revision).toBe(0);

    open(IRJA, id, 'irja-session-1');

    const both = await tom.next((f) => f.event === 'presence' && viewers(f).length === 2);
    expect(
      viewers(both)
        .map((v) => v.name)
        .sort()
    ).toEqual(['Irja', 'Tom']);
  });

  it('sends one person’s saved changes to the other, and not back to themselves', async () => {
    const id = await groupCollage();
    const tom = open(TOM, id, 'tom-session-1');
    const irja = open(IRJA, id, 'irja-session-1');
    await tom.next((f) => f.event === 'ready');
    await irja.next((f) => f.event === 'ready');

    await request(app)
      .post(`/api/collages/${id}/changes`)
      .set('Authorization', IRJA)
      .send({ session: 'irja-session-1', changes: [{ type: 'put', layer: 'photos', item: { id: 'a', x: 40 } }] });

    const change = await tom.next((f) => f.event === 'changes');
    expect(change.data).toMatchObject({
      revision: 1,
      changes: [{ type: 'put', layer: 'photos', item: { id: 'a', x: 40 } }],
      by: { userId: 'u-irja', name: 'Irja' }
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(irja.frames.some((f) => f.event === 'changes')).toBe(false);
  });

  it('shows what each person has selected', async () => {
    const id = await groupCollage();
    const tom = open(TOM, id, 'tom-session-1');
    open(IRJA, id, 'irja-session-1');
    await tom.next((f) => f.event === 'presence' && viewers(f).length === 2);

    const res = await request(app)
      .post(`/api/collages/${id}/presence`)
      .set('Authorization', IRJA)
      .send({ session: 'irja-session-1', selection: 'a' });

    expect(res.status).toBe(204);
    await tom.next((f) => f.event === 'presence' && viewers(f).some((v) => v.name === 'Irja' && v.selection === 'a'));
  });

  it('will not let one person set the other’s selection', async () => {
    const id = await groupCollage();
    const irja = open(IRJA, id, 'irja-session-1');
    await irja.next((f) => f.event === 'ready');

    const res = await request(app)
      .post(`/api/collages/${id}/presence`)
      .set('Authorization', TOM)
      .send({ session: 'irja-session-1', selection: 'a' });

    expect(res.status).toBe(404);
  });

  it('tells the others when someone leaves', async () => {
    const id = await groupCollage();
    const tom = open(TOM, id, 'tom-session-1');
    const irja = open(IRJA, id, 'irja-session-1');
    await tom.next((f) => f.event === 'presence' && viewers(f).length === 2);

    irja.close();

    await tom.next((f) => f.event === 'presence' && viewers(f).length === 1 && tom.frames.indexOf(f) > 1);
  });

  it('has everyone reload after a whole-collage save', async () => {
    const id = await groupCollage();
    const tom = open(TOM, id, 'tom-session-1');
    await tom.next((f) => f.event === 'ready');

    await request(app).put(`/api/collages/${id}`).set('Authorization', IRJA).send({ title: 'Roma' });

    expect((await tom.next((f) => f.event === 'reload')).data.revision).toBe(1);
  });

  it('passes on where an item is mid-drag to the others, and not back to the one dragging', async () => {
    const id = await groupCollage();
    const tom = open(TOM, id, 'tom-session-1');
    const irja = open(IRJA, id, 'irja-session-1');
    await tom.next((f) => f.event === 'ready');
    await irja.next((f) => f.event === 'ready');

    const item = { id: 'a', x: 120, y: 40, width: 200, height: 150, rotation: 5 };
    const res = await request(app)
      .post(`/api/collages/${id}/moving`)
      .set('Authorization', IRJA)
      .send({ session: 'irja-session-1', item });

    expect(res.status).toBe(204);
    const moving = await tom.next((f) => f.event === 'moving');
    expect(moving.data).toMatchObject({ userId: 'u-irja', name: 'Irja', item });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(irja.frames.some((f) => f.event === 'moving')).toBe(false);
  });

  it('says when a dragged item is let go', async () => {
    const id = await groupCollage();
    const tom = open(TOM, id, 'tom-session-1');
    open(IRJA, id, 'irja-session-1');
    await tom.next((f) => f.event === 'presence' && viewers(f).length === 2);

    await request(app)
      .post(`/api/collages/${id}/moving`)
      .set('Authorization', IRJA)
      .send({ session: 'irja-session-1', item: null });

    expect((await tom.next((f) => f.event === 'moving')).data.item).toBeNull();
  });

  it('will not pass on a drag for a tab that is not the sender’s', async () => {
    const id = await groupCollage();
    const irja = open(IRJA, id, 'irja-session-1');
    await irja.next((f) => f.event === 'ready');

    const res = await request(app)
      .post(`/api/collages/${id}/moving`)
      .set('Authorization', TOM)
      .send({ session: 'irja-session-1', item: { id: 'a', x: 0, y: 0, width: 1, height: 1 } });

    expect(res.status).toBe(404);
  });

  it('lets a long drag through, well past the general limit of 300 requests', async () => {
    const id = await groupCollage();
    const irja = open(IRJA, id, 'irja-session-1');
    await irja.next((f) => f.event === 'ready');

    const statuses: number[] = [];
    for (let step = 0; step < 320; step += 1) {
      const res = await request(app)
        .post(`/api/collages/${id}/moving`)
        .set('Authorization', IRJA)
        .send({ session: 'irja-session-1', item: { id: 'a', x: step, y: 0, width: 10, height: 10 } });
      statuses.push(res.status);
    }

    expect(statuses.filter((status) => status !== 204)).toEqual([]);
  }, 30_000);

  it('refuses someone outside the collage’s group before any stream opens', async () => {
    const id = await groupCollage();
    const stranger = open(STRANGER, id, 'stranger-session');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(stranger.status()).toBe(403);
  });

  it('refuses a stream without a session', async () => {
    const id = await groupCollage();
    const res = await request(app).get(`/api/collages/${id}/live`).set('Authorization', TOM);
    expect(res.status).toBe(400);
  });
});
