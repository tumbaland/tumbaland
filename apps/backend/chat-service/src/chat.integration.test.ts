process.env.SERVICE_NAME = 'chat-service';
process.env.JWT_SECRET = 'test-secret';
process.env.INTERNAL_SERVICE_TOKEN = 'internal-test-token';

/**
 * The whole chain: a signed request, the real middleware stack, real
 * controllers, real models, a real database.
 *
 * The parts of chat that break are the joins, not the pieces. Access control is
 * spread across a token claim, a denormalised member list and a group id;
 * idempotent send depends on a unique index existing rather than on any code in
 * this repo; unread counts depend on a read cursor written by a different
 * route. None of that is provable with mocks.
 */
jest.mock('./services/fileServiceClient', () => ({
  getUploadUrl: jest.fn(async (fileId: string) => `https://files.test/upload/${fileId}?token=x`),
  getDownloadUrls: jest.fn(async (ids: string[]) => new Map(ids.map((id) => [id, `https://files.test/d/${id}`]))),
  uploadBuffer: jest.fn(async () => undefined),
  downloadBuffer: jest.fn(async () => Buffer.from('x')),
  // What file-service holds, which is what the meter is charged from.
  storedSize: jest.fn(async () => 1234 as number | null),
  // Async, like the real one: the caller chains .catch() on the result.
  deleteFolder: jest.fn(async () => undefined)
}));

// album-service, as chat sees it. The real routes are tested in album-service.
class FakeAlbumGone extends Error {}
const albumCalls = {
  listAlbums: jest.fn(async () => [{ id: 'a-rome', name: 'Rome', photoCount: 3 }]),
  getAlbum: jest.fn(async (_groupId: string, albumId: string) =>
    albumId === 'a-rome'
      ? { id: 'a-rome', name: 'Rome', photoCount: 3 }
      : albumId === 'a-home'
        ? { id: 'a-home', name: 'Home', photoCount: 0 }
        : null
  ),
  createAlbum: jest.fn(async (_groupId: string, _userId: string, name: string) => ({ id: 'a-new', name, photoCount: 0 })),
  addChatPhoto: jest.fn(async (input: { albumId: string }) => ({ photoId: 'p1', albumId: input.albumId, albumName: 'Rome' })),
  removeChatPhotos: jest.fn(async () => ({ removed: 1 })),
  moveChatPhotos: jest.fn(async (_messageId: string, input: { albumId: string }) => ({ moved: 1, albumId: input.albumId, albumName: 'Home' })),
  createCollage: jest.fn(async (_groupId: string, input: { title: string }) => ({ id: 'k-1', title: input.title }))
};
jest.mock('./services/albumClient', () => ({
  AlbumGoneError: FakeAlbumGone,
  listAlbums: (...args: unknown[]) => (albumCalls.listAlbums as jest.Mock)(...args),
  getAlbum: (...args: unknown[]) => (albumCalls.getAlbum as jest.Mock)(...args),
  createAlbum: (...args: unknown[]) => (albumCalls.createAlbum as jest.Mock)(...args),
  addChatPhoto: (...args: unknown[]) => (albumCalls.addChatPhoto as jest.Mock)(...args),
  removeChatPhotos: (...args: unknown[]) => (albumCalls.removeChatPhotos as jest.Mock)(...args),
  moveChatPhotos: (...args: unknown[]) => (albumCalls.moveChatPhotos as jest.Mock)(...args),
  createCollage: (...args: unknown[]) => (albumCalls.createCollage as jest.Mock)(...args)
}));

const assertHeadroom = jest.fn();
const recordStoredBytes = jest.fn();
const releaseStoredBytes = jest.fn();
jest.mock('./services/storageUsage', () => ({
  assertHeadroom: (...args: unknown[]) => assertHeadroom(...args),
  recordStoredBytes: (...args: unknown[]) => recordStoredBytes(...args),
  releaseStoredBytes: (...args: unknown[]) => releaseStoredBytes(...args)
}));

import os from 'os';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';

import app from './app';
import { Conversation } from './models/Conversation';
import { Message } from './models/Message';
import { ReadState } from './models/ReadState';
import { Presence } from './models/Presence';
import { Call } from './models/Call';
import { DROP_GRACE_MS, RING_TIMEOUT_MS, resetCallTimers, sweepCalls } from './services/callService';
import { clearPresence } from './services/presenceService';
import { clearSubscribers, subscribe } from './services/streamHub';
import { deleteFolder, getUploadUrl, storedSize } from './services/fileServiceClient';

let mongo: MongoMemoryServer;

const TOM = { id: 'u-tom', email: 'tom@example.com', name: 'Tom', groups: ['g1'] };
const IRJA = { id: 'u-irja', email: 'irja@example.com', name: 'Irja', groups: ['g1'] };
/** In a different group entirely: the person who must never see any of it. */
const PERSIK = { id: 'u-persik', email: 'persik@example.com', name: 'Persik', groups: ['g9'] };

const tokenFor = (user: typeof TOM) => jwt.sign(user, 'test-secret', { expiresIn: '1h' });

/**
 * Each test arrives from its own address, as separate clients would. The send
 * limiter counts per address, and the suite as a whole sends far more than one
 * person would in five minutes.
 */
let testNumber = 0;
let clientAddress = '10.0.0.1';
beforeEach(() => {
  testNumber++;
  clientAddress = `10.0.${Math.floor(testNumber / 250)}.${(testNumber % 250) + 1}`;
});

const as = (user: typeof TOM) => {
  const signed = (test: request.Test) =>
    test.set('Authorization', `Bearer ${tokenFor(user)}`).set('X-Forwarded-For', clientAddress);
  return {
    get: (path: string) => signed(request(app).get(path)),
    post: (path: string) => signed(request(app).post(path)),
    patch: (path: string) => signed(request(app).patch(path)),
    put: (path: string) => signed(request(app).put(path)),
    delete: (path: string) => signed(request(app).delete(path))
  };
};

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  // The driver loads `os` with a dynamic import, which Jest's sandbox refuses, so it is handed over.
  await mongoose.connect(mongo.getUri(), { runtimeAdapters: { os } });
  // The unique { conversationId, clientId } index is the idempotency
  // mechanism. Mongoose builds indexes in the background on first use, so the
  // tests below would race it without this.
  await Message.syncIndexes();
  await Conversation.syncIndexes();
  await ReadState.syncIndexes();
  await Presence.syncIndexes();
  await Call.syncIndexes();
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(async () => {
  clearSubscribers();
  clearPresence();
  resetCallTimers();
  jest.clearAllMocks();
  await Promise.all([
    Call.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    ReadState.deleteMany({}),
    Presence.deleteMany({})
  ]);
});

/** A conversation in g1, which Tom and Irja are both in. */
async function conversationInG1(): Promise<string> {
  const res = await as(TOM).post('/api/chat/conversations').send({ groupId: 'g1' });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

let counter = 0;
const clientId = () => `client-${Date.now()}-${counter++}`;

describe('creating a conversation', () => {
  it('creates one for a group the caller is in', async () => {
    const res = await as(TOM).post('/api/chat/conversations').send({ groupId: 'g1' });

    expect(res.status).toBe(201);
    expect(res.body.data.groupId).toBe('g1');
    expect(res.body.data.members.map((m: { userId: string }) => m.userId)).toContain(TOM.id);
  });

  it('refuses a group the caller is not in', async () => {
    const res = await as(PERSIK).post('/api/chat/conversations').send({ groupId: 'g1' });

    expect(res.status).toBe(403);
    expect(await Conversation.countDocuments({})).toBe(0);
  });

  it('is idempotent: two phones opening at once do not make two conversations', async () => {
    const [first, second] = await Promise.all([
      as(TOM).post('/api/chat/conversations').send({ groupId: 'g1' }),
      as(TOM).post('/api/chat/conversations').send({ groupId: 'g1' })
    ]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.id).toBe(second.body.data.id);
  });
});

describe('sending and reading messages', () => {
  it('stores a message and returns it', async () => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({ clientId: clientId(), body: 'hello' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ body: 'hello', senderEmail: TOM.email, kind: 'text' });
  });

  it('lets the other member of the group read it', async () => {
    const id = await conversationInG1();
    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'hello' });

    const res = await as(IRJA).get(`/api/chat/conversations/${id}/messages`);

    expect(res.status).toBe(200);
    expect(res.body.data.messages).toHaveLength(1);
    expect(res.body.data.messages[0].body).toBe('hello');
  });

  it('refuses an empty message', async () => {
    const id = await conversationInG1();

    const res = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: '   ' });

    expect(res.status).toBe(400);
  });

  it('refuses a message with no clientId, so a retry can never double-post', async () => {
    const id = await conversationInG1();

    const res = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ body: 'hello' });

    expect(res.status).toBe(400);
  });

  it('pages newest first and hands back a usable cursor', async () => {
    const id = await conversationInG1();
    for (let i = 0; i < 5; i++) {
      await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: `m${i}` });
    }

    const first = await as(TOM).get(`/api/chat/conversations/${id}/messages?limit=2`);
    expect(first.body.data.messages.map((m: { body: string }) => m.body)).toEqual(['m4', 'm3']);
    expect(first.body.data.nextCursor).toBeTruthy();

    const second = await as(TOM).get(
      `/api/chat/conversations/${id}/messages?limit=2&before=${encodeURIComponent(first.body.data.nextCursor)}`
    );
    expect(second.body.data.messages.map((m: { body: string }) => m.body)).toEqual(['m2', 'm1']);
  });

  it('reports no cursor at the start of the thread', async () => {
    const id = await conversationInG1();
    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'only' });

    const res = await as(TOM).get(`/api/chat/conversations/${id}/messages?limit=10`);

    expect(res.body.data.nextCursor).toBeNull();
  });
});

describe('idempotent send', () => {
  it('returns the stored message instead of posting a second one', async () => {
    const id = await conversationInG1();
    const key = clientId();

    const first = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: key, body: 'hello' });
    const retry = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: key, body: 'hello' });

    expect(first.status).toBe(201);
    // 200, not 201: nothing was created. And not an error, because the message
    // did arrive and telling the user it failed would be a lie.
    expect(retry.status).toBe(200);
    expect(retry.body.data.id).toBe(first.body.data.id);
    expect(await Message.countDocuments({ conversationId: id })).toBe(1);
  });

  it('holds under two retries racing each other', async () => {
    const id = await conversationInG1();
    const key = clientId();

    await Promise.all([
      as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: key, body: 'hello' }),
      as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: key, body: 'hello' })
    ]);

    expect(await Message.countDocuments({ conversationId: id })).toBe(1);
  });

  it('scopes the key to the conversation, so two threads may reuse one', async () => {
    const first = await conversationInG1();
    const secondRes = await as(TOM).post('/api/chat/conversations').send({ groupId: 'g1', title: 'Plans' });
    const second = secondRes.body.data.id as string;
    const key = clientId();

    await as(TOM).post(`/api/chat/conversations/${first}/messages`).send({ clientId: key, body: 'a' });
    const res = await as(TOM).post(`/api/chat/conversations/${second}/messages`).send({ clientId: key, body: 'b' });

    expect(res.status).toBe(201);
    expect(await Message.countDocuments({})).toBe(2);
  });
});

describe('access control', () => {
  let id: string;

  beforeEach(async () => {
    id = await conversationInG1();
    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'private' });
  });

  it('hides the conversation from someone in another group', async () => {
    const res = await as(PERSIK).get(`/api/chat/conversations/${id}/messages`);

    // 404 rather than 403: an outsider should not be able to tell a
    // conversation they cannot reach from one that does not exist.
    expect(res.status).toBe(404);
  });

  it('leaves it out of their conversation list', async () => {
    const res = await as(PERSIK).get('/api/chat/conversations');

    expect(res.body.data).toEqual([]);
  });

  it('refuses them posting into it', async () => {
    const res = await as(PERSIK)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({ clientId: clientId(), body: 'hello?' });

    expect(res.status).toBe(404);
    expect(await Message.countDocuments({ conversationId: id })).toBe(1);
  });

  it('refuses them reacting to a message in it', async () => {
    const message = await Message.findOne({ conversationId: id });
    const res = await as(PERSIK)
      .put(`/api/chat/conversations/${id}/messages/${message!._id}/reactions`)
      .send({ emoji: '👍' });

    expect(res.status).toBe(404);
  });

  it('refuses them the search results', async () => {
    const res = await as(PERSIK).get('/api/chat/search?q=private');

    expect(res.body.data).toEqual([]);
  });

  it('keeps them out even when they name the conversation id in search', async () => {
    const res = await as(PERSIK).get(`/api/chat/search?q=private&conversationId=${id}`);

    expect(res.body.data).toEqual([]);
  });

  it('answers a malformed conversation id as not found, not as a server error', async () => {
    const res = await as(TOM).get('/api/chat/conversations/not-an-id/messages');

    expect(res.status).toBe(404);
  });

  it('stops reading as soon as the group membership goes away', async () => {
    // Irja can read it while she is in g1.
    expect((await as(IRJA).get(`/api/chat/conversations/${id}/messages`)).status).toBe(200);

    // Removed from the group, she cannot, even though `memberEmails` on the
    // conversation still lists her. That denormalised copy is a display
    // convenience, never the access check.
    const removed = { ...IRJA, groups: [] };
    expect((await as(removed).get(`/api/chat/conversations/${id}/messages`)).status).toBe(404);
  });
});

describe('editing and deleting', () => {
  it('lets the sender edit their own message', async () => {
    const id = await conversationInG1();
    const sent = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({ clientId: clientId(), body: 'helo' });

    const res = await as(TOM)
      .patch(`/api/chat/conversations/${id}/messages/${sent.body.data.id}`)
      .send({ body: 'hello' });

    expect(res.status).toBe(200);
    expect(res.body.data.body).toBe('hello');
    expect(res.body.data.editedAt).toBeTruthy();
  });

  it('refuses a group member editing someone else’s message', async () => {
    const id = await conversationInG1();
    const sent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'mine' });

    const res = await as(IRJA)
      .patch(`/api/chat/conversations/${id}/messages/${sent.body.data.id}`)
      .send({ body: 'not yours' });

    // 403, not 404: Irja can see the message, she just may not change it.
    expect(res.status).toBe(403);
  });

  it('soft-deletes, keeping the row but dropping the content', async () => {
    const id = await conversationInG1();
    const sent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'oops' });

    expect((await as(TOM).delete(`/api/chat/conversations/${id}/messages/${sent.body.data.id}`)).status).toBe(204);

    expect(await Message.countDocuments({ conversationId: id })).toBe(1);
    const res = await as(IRJA).get(`/api/chat/conversations/${id}/messages`);
    expect(res.body.data.messages[0]).toMatchObject({ body: '', deletedAt: expect.any(String) });
  });

  it('refuses editing an already-deleted message', async () => {
    const id = await conversationInG1();
    const sent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'oops' });
    await as(TOM).delete(`/api/chat/conversations/${id}/messages/${sent.body.data.id}`);

    const res = await as(TOM)
      .patch(`/api/chat/conversations/${id}/messages/${sent.body.data.id}`)
      .send({ body: 'back' });

    expect(res.status).toBe(404);
  });
});

describe('reactions', () => {
  let id: string;
  let messageId: string;

  beforeEach(async () => {
    id = await conversationInG1();
    const sent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'nice' });
    messageId = sent.body.data.id;
  });

  it('adds one', async () => {
    const res = await as(IRJA).put(`/api/chat/conversations/${id}/messages/${messageId}/reactions`).send({ emoji: '👍' });

    expect(res.status).toBe(200);
    expect(res.body.data.reactions).toHaveLength(1);
    expect(res.body.data.reactions[0]).toMatchObject({ userId: IRJA.id, emoji: '👍' });
  });

  it('toggles the same emoji off again', async () => {
    await as(IRJA).put(`/api/chat/conversations/${id}/messages/${messageId}/reactions`).send({ emoji: '👍' });
    const res = await as(IRJA).put(`/api/chat/conversations/${id}/messages/${messageId}/reactions`).send({ emoji: '👍' });

    expect(res.body.data.reactions).toHaveLength(0);
  });

  it('replaces rather than stacks when the same person picks another emoji', async () => {
    await as(IRJA).put(`/api/chat/conversations/${id}/messages/${messageId}/reactions`).send({ emoji: '👍' });
    const res = await as(IRJA).put(`/api/chat/conversations/${id}/messages/${messageId}/reactions`).send({ emoji: '❤️' });

    expect(res.body.data.reactions).toHaveLength(1);
    expect(res.body.data.reactions[0].emoji).toBe('❤️');
  });

  it('keeps each person’s reaction separate', async () => {
    await as(TOM).put(`/api/chat/conversations/${id}/messages/${messageId}/reactions`).send({ emoji: '👍' });
    const res = await as(IRJA).put(`/api/chat/conversations/${id}/messages/${messageId}/reactions`).send({ emoji: '👍' });

    expect(res.body.data.reactions).toHaveLength(2);
  });

  it('refuses a body dressed up as an emoji', async () => {
    const res = await as(IRJA)
      .put(`/api/chat/conversations/${id}/messages/${messageId}/reactions`)
      .send({ emoji: 'this is not an emoji, it is a sentence' });

    expect(res.status).toBe(400);
  });
});

describe('unread counts', () => {
  it('counts what the other person sent and not your own', async () => {
    const id = await conversationInG1();
    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'one' });
    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'two' });

    expect((await as(IRJA).get('/api/chat/unread')).body.data.unread).toBe(2);
    // Tom sent them, so they are not news to him.
    expect((await as(TOM).get('/api/chat/unread')).body.data.unread).toBe(0);
  });

  it('breaks the count down by conversation, for the worker checking a push is still news', async () => {
    const id = await conversationInG1();
    const sent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'one' });

    expect((await as(IRJA).get('/api/chat/unread')).body.data.conversations).toEqual({ [id]: 1 });

    await as(IRJA).post(`/api/chat/conversations/${id}/read`).send({ lastReadMessageId: sent.body.data.id });

    expect((await as(IRJA).get('/api/chat/unread')).body.data.conversations).toEqual({ [id]: 0 });
  });

  it('clears once the thread is marked read', async () => {
    const id = await conversationInG1();
    const sent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'one' });

    await as(IRJA).post(`/api/chat/conversations/${id}/read`).send({ lastReadMessageId: sent.body.data.id });

    expect((await as(IRJA).get('/api/chat/unread')).body.data.unread).toBe(0);
  });

  it('counts only what arrived after the read cursor', async () => {
    const id = await conversationInG1();
    const first = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'one' });
    await as(IRJA).post(`/api/chat/conversations/${id}/read`).send({ lastReadMessageId: first.body.data.id });
    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'two' });

    expect((await as(IRJA).get('/api/chat/unread')).body.data.unread).toBe(1);
  });

  it('never moves the read cursor backwards', async () => {
    const id = await conversationInG1();
    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'one' });
    await as(IRJA).post(`/api/chat/conversations/${id}/read`).send({});

    // The phone reads the thread and its cursor jumps an hour ahead of this
    // laptop's clock. A stale tab reporting an older position afterwards must
    // not resurrect a notification the phone already cleared.
    const ahead = new Date(Date.now() + 60 * 60 * 1000);
    await ReadState.updateOne({ conversationId: id, userId: IRJA.id }, { $set: { lastReadAt: ahead } });

    await as(IRJA).post(`/api/chat/conversations/${id}/read`).send({});

    const after = await ReadState.findOne({ conversationId: id, userId: IRJA.id });
    expect(after!.lastReadAt.getTime()).toBe(ahead.getTime());
  });

  it('never moves the seen marker back to an older message', async () => {
    const id = await conversationInG1();
    const first = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'one' });
    const second = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'two' });
    await as(IRJA).post(`/api/chat/conversations/${id}/read`).send({ lastReadMessageId: second.body.data.id });

    // A laptop tab hidden since the first message comes back on screen.
    await as(IRJA).post(`/api/chat/conversations/${id}/read`).send({ lastReadMessageId: first.body.data.id });

    const after = await ReadState.findOne({ conversationId: id, userId: IRJA.id });
    expect(after!.lastReadMessageId).toBe(second.body.data.id);
  });

  it('does not count a deleted message', async () => {
    const id = await conversationInG1();
    const sent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'oops' });
    await as(TOM).delete(`/api/chat/conversations/${id}/messages/${sent.body.data.id}`);

    expect((await as(IRJA).get('/api/chat/unread')).body.data.unread).toBe(0);
  });
});

describe('the conversation as a thread opens it', () => {
  it('lists how far each of the others has read, and not the caller', async () => {
    const id = await conversationInG1();
    const sent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'hei' });
    await as(IRJA).post(`/api/chat/conversations/${id}/read`).send({ lastReadMessageId: sent.body.data.id });
    await as(TOM).post(`/api/chat/conversations/${id}/read`).send({ lastReadMessageId: sent.body.data.id });

    const res = await as(TOM).get(`/api/chat/conversations/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.reads).toEqual([
      expect.objectContaining({ userId: IRJA.id, lastReadMessageId: sent.body.data.id, lastReadAt: expect.any(String) })
    ]);
  });

  it('carries each member’s picture, and keeps it current', async () => {
    const id = await conversationInG1();
    const withPicture = { ...IRJA, picture: 'https://auth.test/auth/avatars/u-irja?v=1' };
    await as(withPicture).get(`/api/chat/conversations/${id}`);

    const first = await as(TOM).get(`/api/chat/conversations/${id}`);
    expect(first.body.data.members).toContainEqual(expect.objectContaining({ userId: IRJA.id, picture: withPicture.picture }));

    const changed = { ...IRJA, picture: 'https://auth.test/auth/avatars/u-irja?v=2' };
    await as(changed).get(`/api/chat/conversations/${id}`);

    const second = await as(TOM).get(`/api/chat/conversations/${id}`);
    expect(second.body.data.members).toContainEqual(expect.objectContaining({ userId: IRJA.id, picture: changed.picture }));
  });

  it('is hidden from someone outside the group', async () => {
    const id = await conversationInG1();
    expect((await as(PERSIK).get(`/api/chat/conversations/${id}`)).status).toBe(404);
  });
});

describe('the conversation list', () => {
  it('carries a preview of the last message', async () => {
    const id = await conversationInG1();
    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'see you at six' });

    const res = await as(IRJA).get('/api/chat/conversations');

    expect(res.body.data[0]).toMatchObject({
      id,
      lastMessagePreview: 'see you at six',
      lastMessageSender: TOM.name,
      unreadCount: 1
    });
  });

  it('drops an unsent message from the preview', async () => {
    const id = await conversationInG1();
    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'first' });
    const oops = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'oops' });

    await as(TOM).delete(`/api/chat/conversations/${id}/messages/${oops.body.data.id}`);

    const res = await as(IRJA).get('/api/chat/conversations');
    expect(res.body.data[0].lastMessagePreview).toBe('first');
  });

  it('follows an edit of the newest message', async () => {
    const id = await conversationInG1();
    const sent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'teh' });

    await as(TOM).patch(`/api/chat/conversations/${id}/messages/${sent.body.data.id}`).send({ body: 'the' });

    const res = await as(IRJA).get('/api/chat/conversations');
    expect(res.body.data[0].lastMessagePreview).toBe('the');
  });

  it('leaves the preview alone when an older message is edited', async () => {
    const id = await conversationInG1();
    const old = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'old' });
    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'newest' });

    await as(TOM).patch(`/api/chat/conversations/${id}/messages/${old.body.data.id}`).send({ body: 'older' });

    const res = await as(IRJA).get('/api/chat/conversations');
    expect(res.body.data[0].lastMessagePreview).toBe('newest');
  });

  it('describes an attachment-only message rather than showing an empty preview', async () => {
    const id = await conversationInG1();
    await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({
        clientId: clientId(),
        attachments: [{ fileId: `chat/g1/${id}/y/original.jpg`, mimetype: 'image/jpeg', sizeBytes: 1000 }]
      });

    const res = await as(IRJA).get('/api/chat/conversations');

    expect(res.body.data[0].lastMessagePreview).toBe('Photo');
  });

  it('calls a recording a voice message', async () => {
    const id = await conversationInG1();
    await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({
        clientId: clientId(),
        attachments: [{ fileId: `chat/g1/${id}/v/original.m4a`, mimetype: 'audio/mp4', sizeBytes: 1000, durationMs: 3000 }]
      });

    const res = await as(IRJA).get('/api/chat/conversations');

    expect(res.body.data[0].lastMessagePreview).toBe('Voice message');
  });
});

describe('replies', () => {
  it('accepts a reply to a message in the same conversation', async () => {
    const id = await conversationInG1();
    const parent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'q' });

    const res = await as(IRJA)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({ clientId: clientId(), body: 'a', replyTo: parent.body.data.id });

    expect(res.status).toBe(201);
    expect(res.body.data.replyTo).toBe(parent.body.data.id);
  });

  it('refuses a reply pointing at another conversation, which would be an id probe', async () => {
    const first = await conversationInG1();
    const other = (await as(TOM).post('/api/chat/conversations').send({ groupId: 'g1', title: 'Plans' })).body.data.id;
    const parent = await as(TOM)
      .post(`/api/chat/conversations/${other}/messages`)
      .send({ clientId: clientId(), body: 'elsewhere' });

    const res = await as(TOM)
      .post(`/api/chat/conversations/${first}/messages`)
      .send({ clientId: clientId(), body: 'a', replyTo: parent.body.data.id });

    expect(res.status).toBe(400);
  });

  const reply = async (id: string, parentId: string) =>
    as(IRJA).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'yes', replyTo: parentId });

  it('quotes the message it answers, so it reads even when that one is not loaded', async () => {
    const id = await conversationInG1();
    const parent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'dinner at 7?' });

    const res = await reply(id, parent.body.data.id);

    expect(res.body.data.quote).toMatchObject({ senderId: TOM.id, senderName: TOM.name, text: 'dinner at 7?' });
    const page = await as(TOM).get(`/api/chat/conversations/${id}/messages`);
    expect(page.body.data.messages.find((m: { body: string }) => m.body === 'yes').quote).toMatchObject({ text: 'dinner at 7?' });
  });

  it('quotes a voice message by what it is', async () => {
    const id = await conversationInG1();
    const parent = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({
        clientId: clientId(),
        attachments: [{ fileId: `chat/g1/${id}/v/original.m4a`, mimetype: 'audio/mp4', sizeBytes: 100, durationMs: 2000 }]
      });

    const res = await reply(id, parent.body.data.id);

    expect(res.body.data.quote.text).toBe('Voice message');
  });

  it('follows an edit of the message it quotes', async () => {
    const id = await conversationInG1();
    const parent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'dinner at 7?' });
    await reply(id, parent.body.data.id);

    await as(TOM).patch(`/api/chat/conversations/${id}/messages/${parent.body.data.id}`).send({ body: 'dinner at 8?' });

    const page = await as(IRJA).get(`/api/chat/conversations/${id}/messages`);
    expect(page.body.data.messages.find((m: { body: string }) => m.body === 'yes').quote.text).toBe('dinner at 8?');
  });

  it('forgets the words of a quoted message once it is unsent', async () => {
    const id = await conversationInG1();
    const parent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'oops' });
    await reply(id, parent.body.data.id);

    await as(TOM).delete(`/api/chat/conversations/${id}/messages/${parent.body.data.id}`);

    const page = await as(IRJA).get(`/api/chat/conversations/${id}/messages`);
    expect(page.body.data.messages.find((m: { body: string }) => m.body === 'yes').quote).toMatchObject({ text: '', deleted: true });
  });

  it('refuses a reply to a message already unsent', async () => {
    const id = await conversationInG1();
    const parent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'oops' });
    await as(TOM).delete(`/api/chat/conversations/${id}/messages/${parent.body.data.id}`);

    const res = await reply(id, parent.body.data.id);

    expect(res.status).toBe(400);
  });
});

describe('message effects', () => {
  it('keeps the effect a message was sent with, for the other person to see', async () => {
    const id = await conversationInG1();
    await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({ clientId: clientId(), body: 'miss you', effect: 'hearts' });

    const res = await as(IRJA).get(`/api/chat/conversations/${id}/messages`);

    expect(res.body.data.messages[0].effect).toBe('hearts');
  });

  it('sends an ordinary message with no effect', async () => {
    const id = await conversationInG1();

    const res = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'hi' });

    expect(res.body.data.effect).toBeNull();
  });

  it('refuses an effect it does not know', async () => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({ clientId: clientId(), body: 'hi', effect: 'fireworks' });

    expect(res.status).toBe(400);
  });

  it('drops the effect when the message is unsent', async () => {
    const id = await conversationInG1();
    const sent = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({ clientId: clientId(), body: 'oops', effect: 'confetti' });

    await as(TOM).delete(`/api/chat/conversations/${id}/messages/${sent.body.data.id}`);
    const res = await as(IRJA).get(`/api/chat/conversations/${id}/messages`);

    expect(res.body.data.messages[0].effect).toBeNull();
  });
});

describe('search', () => {
  it('finds a message the caller can read', async () => {
    const id = await conversationInG1();
    await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({ clientId: clientId(), body: 'dinner reservation at eight' });

    const res = await as(IRJA).get('/api/chat/search?q=reservation');

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].body).toContain('reservation');
  });

  it('matches part of a word, in any case, newest first', async () => {
    const id = await conversationInG1();
    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'That Restaurant was lovely' });
    await as(IRJA).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'the restaurant again?' });
    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'something else' });

    const res = await as(IRJA).get(`/api/chat/search?q=rest&conversationId=${id}`);

    expect(res.body.data.map((message: { body: string }) => message.body)).toEqual([
      'the restaurant again?',
      'That Restaurant was lovely'
    ]);
  });

  it('takes the term literally rather than as a pattern', async () => {
    const id = await conversationInG1();
    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'costs 5.50 (maybe)' });
    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'costs 5x50' });

    const res = await as(IRJA).get(`/api/chat/search?q=${encodeURIComponent('5.50 (')}`);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].body).toBe('costs 5.50 (maybe)');
  });

  it('finds Russian text in any case, and English inside the same message', async () => {
    const id = await conversationInG1();
    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'Привет! Встречаемся в Кафе на Tallinn street?' });
    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'just english here' });

    const search = (term: string) => as(IRJA).get(`/api/chat/search?q=${encodeURIComponent(term)}&conversationId=${id}`);

    for (const term of ['привет', 'ПРИВЕТ', 'кафе', 'встреч', 'tallinn', 'кафе на tall']) {
      const res = await search(term);
      expect({ term, found: res.body.data.map((message: { body: string }) => message.body) }).toEqual({
        term,
        found: ['Привет! Встречаемся в Кафе на Tallinn street?']
      });
    }
  });

  it('treats ё and е as the same letter, the way people type Russian', async () => {
    const id = await conversationInG1();
    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'Ещё одна Ёлка' });
    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'еще раз' });

    const bodies = async (term: string) =>
      (await as(IRJA).get(`/api/chat/search?q=${encodeURIComponent(term)}&conversationId=${id}`)).body.data
        .map((message: { body: string }) => message.body)
        .sort();

    expect(await bodies('еще')).toEqual(['Ещё одна Ёлка', 'еще раз']);
    expect(await bodies('ещё')).toEqual(['Ещё одна Ёлка', 'еще раз']);
    expect(await bodies('елка')).toEqual(['Ещё одна Ёлка']);
  });

  it('returns nothing for an empty term rather than the whole history', async () => {
    const id = await conversationInG1();
    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'anything' });

    const res = await as(IRJA).get('/api/chat/search?q=');

    expect(res.body.data).toEqual([]);
  });
});

describe('attachments', () => {
  it('keeps media metadata and URLs across sending, retrying, reading, editing and reacting', async () => {
    const id = await conversationInG1();
    const attachment = {
      fileId: `chat/g1/${id}/abc/original.jpg`,
      thumbnailFileId: `chat/g1/${id}/abc/thumb.webp`,
      mimetype: 'image/jpeg',
      sizeBytes: 1234,
      width: 640,
      height: 480
    };
    const payload = { clientId: clientId(), attachments: [attachment] };
    const sent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send(payload);
    expect(sent.status).toBe(201);
    const messageId = sent.body.data.id;
    const retry = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send(payload);
    const page = await as(IRJA).get(`/api/chat/conversations/${id}/messages`);
    const edited = await as(TOM).patch(`/api/chat/conversations/${id}/messages/${messageId}`).send({ body: 'Photo' });
    const reacted = await as(IRJA).put(`/api/chat/conversations/${id}/messages/${messageId}/reactions`).send({ emoji: '❤️' });

    for (const message of [sent.body.data, retry.body.data, page.body.data.messages[0], edited.body.data, reacted.body.data]) {
      expect(message.attachments[0]).toMatchObject({
        ...attachment,
        url: `https://files.test/d/${attachment.fileId}`,
        thumbnailUrl: `https://files.test/d/${attachment.thumbnailFileId}`
      });
      expect(message.attachments[0]).not.toHaveProperty('_doc');
    }
  });

  const image = { filename: 'holiday.jpg', mimetype: 'image/jpeg', sizeBytes: 500_000 };

  it('mints a signed upload URL inside the conversation\u2019s own folder', async () => {
    const id = await conversationInG1();

    const res = await as(TOM).post(`/api/chat/conversations/${id}/attachments/upload-url`).send(image);

    expect(res.status).toBe(201);
    expect(res.body.data.uploadUrl).toContain('https://files.test/upload/');
    expect(res.body.data.fileId).toMatch(new RegExp(`^chat/g1/${id}/[0-9a-f-]{36}/original\\.jpg$`));
  });

  it('checks the storage quota before a byte is written', async () => {
    const id = await conversationInG1();

    await as(TOM).post(`/api/chat/conversations/${id}/attachments/upload-url`).send(image);

    // The signed URL is the only point where the size is known before the
    // upload happens.
    expect(assertHeadroom).toHaveBeenCalledWith(expect.anything(), 'g1', 500_000);
  });

  it('tells a video uploader where to put its poster frame', async () => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/attachments/upload-url`)
      .send({ filename: 'clip.mp4', mimetype: 'video/mp4', sizeBytes: 5_000_000 });

    expect(res.body.data.posterUploadFileId).toMatch(/\/poster\.jpg$/);
  });

  it('offers no poster path for an image', async () => {
    const id = await conversationInG1();

    const res = await as(TOM).post(`/api/chat/conversations/${id}/attachments/upload-url`).send(image);

    expect(res.body.data.posterUploadFileId).toBeNull();
  });

  it.each([
    ['text/html'],
    ['application/octet-stream'],
    ['application/zip'],
    ['application/x-msdownload']
  ])('refuses %s, so only images, video, voice and documents can reach storage', async (mimetype) => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/attachments/upload-url`)
      .send({ filename: 'x', mimetype, sizeBytes: 100 });

    expect(res.status).toBe(400);
  });

  it.each([
    ['report.pdf', 'application/pdf'],
    ['letter.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['budget.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['notes.odt', 'application/vnd.oasis.opendocument.text']
  ])('allows the document %s, with no poster path', async (filename, mimetype) => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/attachments/upload-url`)
      .send({ filename, mimetype, sizeBytes: 5_000_000 });

    expect(res.status).toBe(201);
    expect(res.body.data.posterUploadFileId).toBeNull();
  });

  it.each([
    ['voice.weba', 'audio/webm'],
    ['voice.m4a', 'audio/mp4'],
    ['voice.ogg', 'audio/ogg']
  ])('allows the voice message %s, with no poster path', async (filename, mimetype) => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/attachments/upload-url`)
      .send({ filename, mimetype, sizeBytes: 400_000 });

    expect(res.status).toBe(201);
    expect(res.body.data.posterUploadFileId).toBeNull();
  });

  it('refuses a voice message over its ceiling', async () => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/attachments/upload-url`)
      .send({ filename: 'voice.weba', mimetype: 'audio/webm', sizeBytes: 20 * 1024 * 1024 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/too large/);
  });

  it('refuses a document over its ceiling', async () => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/attachments/upload-url`)
      .send({ filename: 'big.pdf', mimetype: 'application/pdf', sizeBytes: 30 * 1024 * 1024 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/too large/);
  });

  it('refuses an image over the per-file ceiling', async () => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/attachments/upload-url`)
      .send({ ...image, sizeBytes: 30 * 1024 * 1024 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/too large/);
  });

  it('allows a video the image ceiling would have refused', async () => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/attachments/upload-url`)
      .send({ filename: 'clip.mp4', mimetype: 'video/mp4', sizeBytes: 30 * 1024 * 1024 });

    expect(res.status).toBe(201);
  });

  it('refuses an upload URL to someone outside the group', async () => {
    const id = await conversationInG1();

    const res = await as(PERSIK).post(`/api/chat/conversations/${id}/attachments/upload-url`).send(image);

    expect(res.status).toBe(404);
  });

  it('meters the bytes once the message carrying them exists, by what is really stored', async () => {
    const id = await conversationInG1();
    (storedSize as jest.Mock).mockResolvedValueOnce(500_000);

    const sent = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({
        clientId: clientId(),
        // Says one byte; file-service holds half a megabyte.
        attachments: [{ fileId: `chat/g1/${id}/abc/original.jpg`, mimetype: 'image/jpeg', sizeBytes: 1 }]
      });

    expect(recordStoredBytes).toHaveBeenCalledWith('g1', 500_000);
    expect(sent.body.data.attachments[0].sizeBytes).toBe(500_000);
  });

  it('refuses a message whose upload never finished', async () => {
    const id = await conversationInG1();
    (storedSize as jest.Mock).mockResolvedValueOnce(null);

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({
        clientId: clientId(),
        attachments: [{ fileId: `chat/g1/${id}/abc/original.jpg`, mimetype: 'image/jpeg', sizeBytes: 100 }]
      });

    expect(res.status).toBe(400);
    expect(recordStoredBytes).not.toHaveBeenCalled();
  });

  it('asks for an upload URL good for no more than the size the quota was checked against', async () => {
    const id = await conversationInG1();

    await as(TOM).post(`/api/chat/conversations/${id}/attachments/upload-url`).send(image);

    expect(getUploadUrl).toHaveBeenCalledWith(expect.any(String), 'image/jpeg', 15, image.sizeBytes);
  });

  it('hands back signed URLs with the thread, one batch for the page', async () => {
    const id = await conversationInG1();
    await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({
        clientId: clientId(),
        attachments: [{ fileId: `chat/g1/${id}/abc/original.jpg`, mimetype: 'image/jpeg', sizeBytes: 100 }]
      });

    const res = await as(IRJA).get(`/api/chat/conversations/${id}/messages`);

    expect(res.body.data.messages[0].attachments[0].url).toContain('https://files.test/d/');
  });

  it('deletes the files and releases the bytes when a message is deleted', async () => {
    const id = await conversationInG1();
    (storedSize as jest.Mock).mockResolvedValueOnce(500_000);
    const sent = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({
        clientId: clientId(),
        attachments: [{ fileId: `chat/g1/${id}/abc/original.jpg`, mimetype: 'image/jpeg', sizeBytes: 500_000 }]
      });

    await as(TOM).delete(`/api/chat/conversations/${id}/messages/${sent.body.data.id}`);

    // Keeping files nobody can see would charge the owner for storage they
    // cannot reach or free.
    expect(deleteFolder).toHaveBeenCalledWith(`chat/g1/${id}/abc`);
    expect(releaseStoredBytes).toHaveBeenCalledWith('g1', 500_000);
  });

  it('deletes a video poster that was uploaded into a folder of its own', async () => {
    const id = await conversationInG1();
    const sent = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({
        clientId: clientId(),
        attachments: [
          {
            fileId: `chat/g1/${id}/clip/original.mp4`,
            posterFileId: `chat/g1/${id}/still/original.jpg`,
            mimetype: 'video/mp4',
            sizeBytes: 100
          }
        ]
      });

    await as(TOM).delete(`/api/chat/conversations/${id}/messages/${sent.body.data.id}`);

    expect(deleteFolder).toHaveBeenCalledWith(`chat/g1/${id}/clip`);
    expect(deleteFolder).toHaveBeenCalledWith(`chat/g1/${id}/still`);
  });

  it.each([
    ['another group', (id: string) => ({ fileId: `chat/g9/${id}/abc/original.jpg` })],
    ['another module', () => ({ fileId: 'album/g1/secret/original.jpg' })],
    ['a climb out with ..', (id: string) => ({ fileId: `chat/g1/${id}/../../g9/x/original.jpg` })],
    ['a foreign thumbnail', (id: string) => ({ fileId: `chat/g1/${id}/abc/original.jpg`, thumbnailFileId: 'album/g1/x.webp' })]
  ])('refuses a message carrying a file from %s', async (_label, file) => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({ clientId: clientId(), attachments: [{ ...file(id), mimetype: 'image/jpeg', sizeBytes: 100 }] });

    // Otherwise the service would sign a download URL for it, and delete its
    // folder when the message was unsent.
    expect(res.status).toBe(400);
    expect(await Message.countDocuments()).toBe(0);
  });

  it('still deletes the message when the file delete fails', async () => {
    const id = await conversationInG1();
    (deleteFolder as jest.Mock).mockRejectedValueOnce(new Error('file-service down'));
    const sent = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({
        clientId: clientId(),
        attachments: [{ fileId: `chat/g1/${id}/abc/original.jpg`, mimetype: 'image/jpeg', sizeBytes: 100 }]
      });

    const res = await as(TOM).delete(`/api/chat/conversations/${id}/messages/${sent.body.data.id}`);

    // An orphaned file is a job for reconciliation, not a reason to leave the
    // message visible.
    expect(res.status).toBe(204);
  });

  it('refuses a thumbnail request for a file outside this conversation', async () => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/attachments/thumbnail`)
      .send({ fileId: 'chat/g9/other/abc/original.jpg', mimetype: 'image/jpeg' });

    // Without this the route would read and rewrite any path in storage.
    expect(res.status).toBe(400);
  });

  it('refuses a thumbnail request that tries to climb out with ..', async () => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/attachments/thumbnail`)
      .send({ fileId: `chat/g1/${id}/../../../etc/passwd`, mimetype: 'image/jpeg' });

    expect(res.status).toBe(400);
  });

  it('refuses more than ten attachments on one message', async () => {
    const id = await conversationInG1();
    const many = Array.from({ length: 11 }, (_, i) => ({
      fileId: `chat/g1/${id}/a${i}/original.jpg`,
      mimetype: 'image/jpeg',
      sizeBytes: 100
    }));

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({ clientId: clientId(), attachments: many });

    expect(res.status).toBe(400);
  });
});

describe('opening chat for the first time', () => {
  it('creates a conversation for the group, so there is somewhere to talk', async () => {
    // A group made in Groups does not create a conversation by itself. Without
    // this the list is empty forever and there is no way in.
    const res = await as(TOM).post('/api/chat/conversations/mine');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].groupId).toBe('g1');
  });

  it('gives both people the same conversation', async () => {
    const tom = await as(TOM).post('/api/chat/conversations/mine');
    const irja = await as(IRJA).post('/api/chat/conversations/mine');

    expect(irja.body.data[0].id).toBe(tom.body.data[0].id);
  });

  it('puts whoever opens it on the roster, so push has somewhere to send', async () => {
    await as(TOM).post('/api/chat/conversations/mine');
    const res = await as(IRJA).post('/api/chat/conversations/mine');

    const members = res.body.data[0].members.map((m: { userId: string }) => m.userId);
    expect(members).toEqual(expect.arrayContaining([TOM.id, IRJA.id]));
  });

  it('is safe to call on every open', async () => {
    await as(TOM).post('/api/chat/conversations/mine');
    await as(TOM).post('/api/chat/conversations/mine');
    await as(TOM).post('/api/chat/conversations/mine');

    expect(await Conversation.countDocuments({})).toBe(1);
  });

  it('holds when two phones open the app at the same moment', async () => {
    await Promise.all([
      as(TOM).post('/api/chat/conversations/mine'),
      as(IRJA).post('/api/chat/conversations/mine')
    ]);

    expect(await Conversation.countDocuments({})).toBe(1);
  });

  it('takes the groups from the session, never from the caller', async () => {
    // Persik is in g9, so this can only ever produce a g9 conversation.
    const res = await as(PERSIK).post('/api/chat/conversations/mine').send({ groupId: 'g1' });

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].groupId).toBe('g9');
    expect(await Conversation.countDocuments({ groupId: 'g1' })).toBe(0);
  });

  it('returns nothing for someone in no group at all', async () => {
    const res = await as({ ...TOM, groups: [] }).post('/api/chat/conversations/mine');

    expect(res.body.data).toEqual([]);
    expect(await Conversation.countDocuments({})).toBe(0);
  });

  it('carries the unread count, so the list needs one request rather than two', async () => {
    const id = await conversationInG1();
    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'hei' });

    const res = await as(IRJA).post('/api/chat/conversations/mine');

    expect(res.body.data[0].unreadCount).toBe(1);
  });

  it('needs a session', async () => {
    const res = await request(app).post('/api/chat/conversations/mine');

    expect(res.status).toBe(401);
  });
});

describe('presence', () => {
  /** Presence is recorded without holding up the request, so give it a moment. */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

  it('shows the other person online once they have been active, and never the caller', async () => {
    const id = await conversationInG1();
    await as(IRJA).get(`/api/chat/conversations/${id}`);
    await settle();

    const res = await as(TOM).get(`/api/chat/conversations/${id}`);

    expect(res.body.data.presence).toEqual([
      { userId: IRJA.id, online: true, lastActiveAt: expect.any(String) }
    ]);
  });

  it('carries presence on the conversation list too, for the dots there', async () => {
    const id = await conversationInG1();
    await as(IRJA).get(`/api/chat/conversations/${id}`);
    await settle();

    const res = await as(TOM).get('/api/chat/conversations');

    expect(res.body.data[0].presence).toEqual([
      { userId: IRJA.id, online: true, lastActiveAt: expect.any(String) }
    ]);
  });

  it('counts the shell’s unread poll as being active', async () => {
    const id = await conversationInG1();
    // On the roster (she has opened the chat before), then quiet until now.
    await as(IRJA).get(`/api/chat/conversations/${id}`);
    await settle();
    clearPresence();
    await Presence.deleteMany({});

    await as(IRJA).get('/api/chat/unread');
    await settle();

    const res = await as(TOM).get(`/api/chat/conversations/${id}`);
    expect(res.body.data.presence[0]).toMatchObject({ userId: IRJA.id, online: true });
  });

  it('does not count the service worker’s background check as being active', async () => {
    const id = await conversationInG1();
    await as(IRJA).get(`/api/chat/conversations/${id}`);
    await settle();
    clearPresence();
    await Presence.deleteMany({});

    // A push arrived on her locked phone; nobody is looking at the app.
    await as(IRJA).get('/api/chat/unread?background=1');
    await settle();

    const res = await as(TOM).get(`/api/chat/conversations/${id}`);
    expect(res.body.data.presence[0]).toMatchObject({ userId: IRJA.id, online: false });
  });
});

describe('making a collage together', () => {
  async function withAlbum(): Promise<string> {
    const id = await conversationInG1();
    await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });
    return id;
  }

  it('makes the collage on the chat’s album and posts a card both people see', async () => {
    const id = await withAlbum();

    const res = await as(TOM).post(`/api/chat/conversations/${id}/collages`).send({ clientId: clientId(), title: 'Rome' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ kind: 'collage', collage: { id: 'k-1', title: 'Rome' }, senderName: 'Tom' });
    expect(albumCalls.createCollage).toHaveBeenCalledWith('g1', {
      clientId: res.body.data.clientId,
      userId: 'u-tom',
      albumId: 'a-rome',
      conversationId: id,
      title: 'Rome'
    });
    const page = await as(IRJA).get(`/api/chat/conversations/${id}/messages`);
    expect(page.body.data.messages[0]).toMatchObject({ kind: 'collage', collage: { id: 'k-1', title: 'Rome' } });
    const list = await as(IRJA).get('/api/chat/conversations');
    expect(list.body.data[0]).toMatchObject({ lastMessagePreview: 'Collage: Rome', unreadCount: 1 });
  });

  it('makes one collage for a retried request, not two', async () => {
    const id = await withAlbum();
    const key = clientId();

    const first = await as(TOM).post(`/api/chat/conversations/${id}/collages`).send({ clientId: key, title: 'Rome' });
    const again = await as(TOM).post(`/api/chat/conversations/${id}/collages`).send({ clientId: key, title: 'Rome' });

    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect(again.body.data.id).toBe(first.body.data.id);
    expect(albumCalls.createCollage).toHaveBeenCalledTimes(1);
  });

  it('asks for an album first when the chat has none', async () => {
    const id = await conversationInG1();

    const res = await as(TOM).post(`/api/chat/conversations/${id}/collages`).send({ clientId: clientId(), title: 'Rome' });

    expect(res.status).toBe(400);
    expect(albumCalls.createCollage).not.toHaveBeenCalled();
  });

  it('says so when the chat’s album has been deleted in Album', async () => {
    const id = await withAlbum();
    albumCalls.createCollage.mockRejectedValueOnce(new FakeAlbumGone());

    const res = await as(TOM).post(`/api/chat/conversations/${id}/collages`).send({ clientId: clientId(), title: 'Rome' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('no longer exists');
  });

  it('keeps people outside the group out', async () => {
    const id = await withAlbum();

    const res = await as(PERSIK).post(`/api/chat/conversations/${id}/collages`).send({ clientId: clientId(), title: 'Rome' });

    expect(res.status).toBe(404);
  });
});

describe('the internal route for Album', () => {
  it('refuses a caller without the service token', async () => {
    const res = await request(app).post('/internal/collage-activity').send({});
    expect(res.status).toBe(401);
  });

  it('refuses a person’s own session, which is not a service', async () => {
    const res = await as(TOM).post('/internal/collage-activity').send({});
    expect(res.status).toBe(401);
  });

  it('takes Album’s collage activity, and nudges nobody while push is not set up', async () => {
    const id = await conversationInG1();

    const res = await request(app)
      .post('/internal/collage-activity')
      .set('x-internal-token', 'internal-test-token')
      .send({ conversationId: id, collageId: 'k-1', title: 'Rome', userId: 'u-tom', name: 'Tom', presentUserIds: ['u-tom'] });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ notified: 0 });
  });
});

describe('the internal route for plan reminders', () => {
  const reminder = (over: Record<string, unknown> = {}) => ({
    planId: 'p-concert',
    groupId: 'g1',
    userId: 'u-tom',
    title: 'Concert',
    date: '2026-10-16',
    time: '19:00',
    timeZone: 'Europe/Tallinn',
    place: 'Saku Arena',
    remindAt: '2026-10-16T15:00:00.000Z',
    ...over
  });
  const post = (body: object) =>
    request(app).post('/internal/plan-reminder').set('x-internal-token', 'internal-test-token').send(body);

  it('refuses a caller without the service token', async () => {
    expect((await request(app).post('/internal/plan-reminder').send(reminder())).status).toBe(401);
  });

  it('refuses a reminder without the fields it needs', async () => {
    expect((await post({ ...reminder(), time: '7pm' })).status).toBe(400);
  });

  it('posts a card into the group’s chat that is news to everyone, the planner included', async () => {
    const id = await conversationInG1();
    await as(IRJA).get(`/api/chat/conversations/${id}`);

    const res = await post(reminder());
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ posted: true });

    const messages = (await as(IRJA).get(`/api/chat/conversations/${id}/messages`)).body.data.messages;
    const card = messages.find((m: { kind: string }) => m.kind === 'reminder');
    expect(card).toMatchObject({
      senderName: 'Reminder',
      body: 'Concert on Friday 16 October at 19:00 · Saku Arena',
      plan: { id: 'p-concert', title: 'Concert', date: '2026-10-16', time: '19:00', place: 'Saku Arena' }
    });
    expect((await as(TOM).get('/api/chat/unread')).body.data.conversations[id]).toBe(1);
    expect((await as(IRJA).get('/api/chat/unread')).body.data.conversations[id]).toBe(1);
  });

  it('posts a reminder once, however often it is retried', async () => {
    const id = await conversationInG1();
    await post(reminder({ planId: 'p-retry' }));
    await post(reminder({ planId: 'p-retry' }));
    const messages = (await as(TOM).get(`/api/chat/conversations/${id}/messages`)).body.data.messages;
    expect(messages.filter((m: { plan?: { id: string } }) => m.plan?.id === 'p-retry')).toHaveLength(1);
  });

  it('has no thread to post in for a personal plan', async () => {
    const res = await post(reminder({ groupId: undefined, planId: 'p-personal' }));
    expect(res.body.data).toEqual({ posted: false });
  });
});

describe('saving photos to Album', () => {
  /** Album work runs after the reply, so give it a moment. */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 100));
  const photo = (id: string, name = 'abc') => ({
    fileId: `chat/g1/${id}/${name}/original.jpg`,
    thumbnailFileId: `chat/g1/${id}/${name}/thumb.webp`,
    mimetype: 'image/jpeg',
    sizeBytes: 1000
  });

  it('asks first: a new conversation has no album chosen', async () => {
    const id = await conversationInG1();
    const res = await as(TOM).get(`/api/chat/conversations/${id}`);
    expect(res.body.data.photoAlbum).toEqual({ mode: 'unset', albumId: null, albumName: null });
  });

  it('offers the group’s albums for the picker', async () => {
    const id = await conversationInG1();
    const res = await as(TOM).get(`/api/chat/conversations/${id}/albums`);
    expect(res.body.data).toEqual([{ id: 'a-rome', name: 'Rome', photoCount: 3 }]);
    expect(albumCalls.listAlbums).toHaveBeenCalledWith('g1');
  });

  it('says nothing when someone picks the album already chosen', async () => {
    const id = await conversationInG1();
    await as(IRJA).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });

    const res = await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ mode: 'album', albumId: 'a-rome', albumName: 'Rome' });
    const page = await as(TOM).get(`/api/chat/conversations/${id}/messages`);
    // Only Irja's line, from when it really changed.
    expect(page.body.data.messages.filter((m: { kind: string }) => m.kind === 'system')).toHaveLength(1);
  });

  it('sets the album for both people, and says so in the thread without counting it unread', async () => {
    const id = await conversationInG1();

    const res = await as(IRJA).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });

    expect(res.body.data).toEqual({ mode: 'album', albumId: 'a-rome', albumName: 'Rome' });
    const seen = await as(TOM).get(`/api/chat/conversations/${id}`);
    expect(seen.body.data.photoAlbum).toMatchObject({ albumName: 'Rome' });
    const page = await as(TOM).get(`/api/chat/conversations/${id}/messages`);
    expect(page.body.data.messages[0]).toMatchObject({ kind: 'system', body: 'Irja set photos to go to Rome' });
    const list = await as(TOM).get('/api/chat/conversations');
    expect(list.body.data[0].unreadCount).toBe(0);
  });

  it('creates a new album from the picker', async () => {
    const id = await conversationInG1();

    const res = await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', newAlbumName: 'Paris' });

    expect(albumCalls.createAlbum).toHaveBeenCalledWith('g1', TOM.id, 'Paris');
    expect(res.body.data).toEqual({ mode: 'album', albumId: 'a-new', albumName: 'Paris' });
  });

  it('refuses an album that is not in the conversation’s group', async () => {
    const id = await conversationInG1();
    const res = await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-elsewhere' });
    expect(res.status).toBe(400);
  });

  it('saves each file of a sent photo message and marks it with the album', async () => {
    const id = await conversationInG1();
    await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });

    const sent = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({ clientId: clientId(), attachments: [photo(id), photo(id, 'def')] });
    await settle();

    expect(albumCalls.addChatPhoto).toHaveBeenCalledTimes(2);
    expect(albumCalls.addChatPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 'g1', albumId: 'a-rome', messageId: sent.body.data.id, fileId: photo(id).fileId })
    );
    const stored = await Message.findById(sent.body.data.id);
    expect(stored!.attachments[0]).toMatchObject({ albumId: 'a-rome', albumName: 'Rome' });
  });

  it('tells an open thread when someone changes their name, and keeps the new one', async () => {
    const id = await conversationInG1();
    await as(IRJA).get(`/api/chat/conversations/${id}`);
    const sent: string[] = [];
    subscribe('u-tom', ['g1'], { send: (chunk: string) => sent.push(chunk) > 0 } as unknown as import('@tumbaland/backend-core').SseStream);

    await as({ ...IRJA, name: 'Irja Tamm' }).get(`/api/chat/conversations/${id}`);

    expect(sent.join('')).toContain('"member":{"userId":"u-irja","name":"Irja Tamm"');
    const detail = await as(TOM).get(`/api/chat/conversations/${id}`);
    expect(detail.body.data.members).toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: 'u-irja', name: 'Irja Tamm' })])
    );
  });

  it("hands a video's still to the album along with the video", async () => {
    const id = await conversationInG1();
    await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });

    await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({
        clientId: clientId(),
        attachments: [
          {
            fileId: `chat/g1/${id}/clip/original.mp4`,
            posterFileId: `chat/g1/${id}/still/original.jpg`,
            mimetype: 'video/mp4',
            sizeBytes: 100
          }
        ]
      });
    await settle();

    expect(albumCalls.addChatPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: `chat/g1/${id}/clip/original.mp4`, posterFileId: `chat/g1/${id}/still/original.jpg` })
    );
  });

  it('leaves out only the photos the sender unticked', async () => {
    const id = await conversationInG1();
    await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });
    const kept = photo(id, 'kept');
    const left = photo(id, 'left');

    await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({ clientId: clientId(), attachments: [kept, left], skipAlbumFileIds: [left.fileId] });
    await settle();

    expect(albumCalls.addChatPhoto).toHaveBeenCalledTimes(1);
    expect(albumCalls.addChatPhoto).toHaveBeenCalledWith(expect.objectContaining({ fileId: kept.fileId }));
  });

  it('leaves out a send marked "not this one"', async () => {
    const id = await conversationInG1();
    await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });

    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), attachments: [photo(id)], skipAlbum: true });
    await settle();

    expect(albumCalls.addChatPhoto).not.toHaveBeenCalled();
  });

  it('keeps a voice message out of the album', async () => {
    const id = await conversationInG1();
    await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });

    await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({
        clientId: clientId(),
        attachments: [{ fileId: `chat/g1/${id}/v/original.weba`, mimetype: 'audio/webm', sizeBytes: 100, durationMs: 4200 }]
      });
    await settle();

    expect(albumCalls.addChatPhoto).not.toHaveBeenCalled();
  });

  it.each([['unset', undefined], ['off', { mode: 'off' }]])('saves nothing while %s', async (_label, choice) => {
    const id = await conversationInG1();
    if (choice) await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send(choice);

    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), attachments: [photo(id)] });
    await settle();

    expect(albumCalls.addChatPhoto).not.toHaveBeenCalled();
  });

  it('goes back to asking when the album was deleted in Album', async () => {
    const id = await conversationInG1();
    await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });
    albumCalls.addChatPhoto.mockRejectedValueOnce(new FakeAlbumGone());

    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), attachments: [photo(id)] });
    await settle();

    const res = await as(TOM).get(`/api/chat/conversations/${id}`);
    expect(res.body.data.photoAlbum.mode).toBe('unset');
  });

  it('still sends when Album is down', async () => {
    const id = await conversationInG1();
    await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });
    albumCalls.addChatPhoto.mockRejectedValueOnce(new Error('album-service down'));

    const sent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), attachments: [photo(id)] });
    await settle();

    expect(sent.status).toBe(201);
  });

  it('takes the photos out of the album on unsend, before the files go', async () => {
    const id = await conversationInG1();
    const sent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), attachments: [photo(id)] });

    await as(TOM).delete(`/api/chat/conversations/${id}/messages/${sent.body.data.id}`);

    expect(albumCalls.removeChatPhotos).toHaveBeenCalledWith(sent.body.data.id);
    const removedAt = (albumCalls.removeChatPhotos as jest.Mock).mock.invocationCallOrder[0]!;
    const deletedAt = (deleteFolder as jest.Mock).mock.invocationCallOrder[0]!;
    expect(removedAt).toBeLessThan(deletedAt);
  });

  it('lets either person take a message back out of the album', async () => {
    const id = await conversationInG1();
    await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });
    const sent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), attachments: [photo(id)] });
    await settle();

    const res = await as(IRJA).delete(`/api/chat/conversations/${id}/messages/${sent.body.data.id}/album`);

    expect(res.status).toBe(200);
    expect(res.body.data.attachments[0]).toMatchObject({ albumId: null });
    expect(albumCalls.removeChatPhotos).toHaveBeenCalledWith(sent.body.data.id);
    const stored = await Message.findById(sent.body.data.id);
    expect(stored!.attachments[0]).toMatchObject({ albumId: null, albumName: null });
  });

  it('keeps someone outside the group out of the setting', async () => {
    const id = await conversationInG1();
    const res = await as(PERSIK).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'off' });
    expect(res.status).toBe(404);
  });
});

describe('changing a sent photo’s album', () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 100));
  const file = (id: string, name: string) => ({
    fileId: `chat/g1/${id}/${name}/original.jpg`,
    mimetype: 'image/jpeg',
    sizeBytes: 1000
  });

  async function twoPhotosInRome() {
    const id = await conversationInG1();
    await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });
    const sent = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({ clientId: clientId(), attachments: [file(id, 'abc'), file(id, 'def')] });
    expect(sent.status).toBe(201);
    await settle();
    jest.clearAllMocks();
    return { id, messageId: sent.body.data.id as string };
  }

  it('moves one photo, and leaves the other and the conversation’s setting alone', async () => {
    const { id, messageId } = await twoPhotosInRome();

    const res = await as(IRJA)
      .put(`/api/chat/conversations/${id}/messages/${messageId}/album`)
      .send({ albumId: 'a-home', fileId: file(id, 'abc').fileId });

    expect(res.status).toBe(200);
    expect(res.body.data.attachments[0]).toMatchObject({ albumId: 'a-home', albumName: 'Home' });
    expect(albumCalls.moveChatPhotos).toHaveBeenCalledWith(messageId, {
      groupId: 'g1',
      albumId: 'a-home',
      fileIds: [file(id, 'abc').fileId]
    });
    const stored = await Message.findById(messageId);
    expect(stored!.attachments.map((attachment) => attachment.albumName)).toEqual(['Home', 'Rome']);
    const detail = await as(TOM).get(`/api/chat/conversations/${id}`);
    expect(detail.body.data.photoAlbum.albumName).toBe('Rome');
  });

  it('adds a photo that was left out, rather than trying to move it', async () => {
    const id = await conversationInG1();
    const sent = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({ clientId: clientId(), attachments: [file(id, 'abc')], skipAlbum: true });

    await as(TOM).put(`/api/chat/conversations/${id}/messages/${sent.body.data.id}/album`).send({ albumId: 'a-rome' });

    expect(albumCalls.moveChatPhotos).not.toHaveBeenCalled();
    expect(albumCalls.addChatPhoto).toHaveBeenCalledWith(expect.objectContaining({ albumId: 'a-rome', fileId: file(id, 'abc').fileId }));
  });

  it('can put a photo in a new album', async () => {
    const { id, messageId } = await twoPhotosInRome();

    await as(TOM).put(`/api/chat/conversations/${id}/messages/${messageId}/album`).send({ newAlbumName: 'Best of Rome' });

    expect(albumCalls.createAlbum).toHaveBeenCalledWith('g1', TOM.id, 'Best of Rome');
  });

  it('takes out just one photo', async () => {
    const { id, messageId } = await twoPhotosInRome();

    await as(TOM).delete(`/api/chat/conversations/${id}/messages/${messageId}/album?fileId=${file(id, 'def').fileId}`);

    expect(albumCalls.removeChatPhotos).toHaveBeenCalledWith(messageId, file(id, 'def').fileId);
    const stored = await Message.findById(messageId);
    expect(stored!.attachments.map((attachment) => attachment.albumName)).toEqual(['Rome', null]);
  });

  it('moves some of a message\u2019s photos in one go, creating a new album once', async () => {
    const { id, messageId } = await twoPhotosInRome();

    const res = await as(TOM)
      .put(`/api/chat/conversations/${id}/messages/${messageId}/album`)
      .send({ newAlbumName: 'Best of Rome', fileIds: [file(id, 'def').fileId] });

    expect(res.status).toBe(200);
    expect(albumCalls.createAlbum).toHaveBeenCalledTimes(1);
    expect(albumCalls.moveChatPhotos).toHaveBeenCalledWith(messageId, expect.objectContaining({ fileIds: [file(id, 'def').fileId] }));
    const stored = await Message.findById(messageId);
    expect(stored!.attachments[0]!.albumName).toBe('Rome');
  });

  it('takes out several photos, and leaves the rest', async () => {
    const id = await conversationInG1();
    await as(TOM).put(`/api/chat/conversations/${id}/photo-album`).send({ mode: 'album', albumId: 'a-rome' });
    const sent = await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({ clientId: clientId(), attachments: [file(id, 'a'), file(id, 'b'), file(id, 'c')] });
    await settle();
    jest.clearAllMocks();

    await as(TOM).delete(
      `/api/chat/conversations/${id}/messages/${sent.body.data.id}/album?fileId=${file(id, 'a').fileId}&fileId=${file(id, 'c').fileId}`
    );

    expect(albumCalls.removeChatPhotos).toHaveBeenCalledTimes(2);
    const stored = await Message.findById(sent.body.data.id);
    expect(stored!.attachments.map((attachment) => attachment.albumName)).toEqual([null, 'Rome', null]);
  });

  it('refuses a file that is not on the message', async () => {
    const { id, messageId } = await twoPhotosInRome();

    const res = await as(TOM)
      .put(`/api/chat/conversations/${id}/messages/${messageId}/album`)
      .send({ albumId: 'a-home', fileId: 'chat/g9/elsewhere/original.jpg' });

    expect(res.status).toBe(404);
  });

  it('refuses an album from another group', async () => {
    const { id, messageId } = await twoPhotosInRome();

    const res = await as(TOM).put(`/api/chat/conversations/${id}/messages/${messageId}/album`).send({ albumId: 'a-elsewhere' });

    expect(res.status).toBe(400);
  });
});

describe('appearance', () => {
  const photo = (id: string, name = 'abc') => ({
    fileId: `chat/g1/${id}/${name}/original.jpg`,
    mimetype: 'image/jpeg',
    sizeBytes: 1000
  });

  it('starts on the classic theme with no background', async () => {
    const id = await conversationInG1();
    const res = await as(TOM).get(`/api/chat/conversations/${id}`);
    expect(res.body.data.appearance).toEqual({ theme: 'classic', backgroundFileId: null, backgroundUrl: null });
  });

  it('changes the theme for both people, and says so in the thread', async () => {
    const id = await conversationInG1();

    const res = await as(IRJA).put(`/api/chat/conversations/${id}/appearance`).send({ theme: 'ocean' });

    expect(res.body.data.theme).toBe('ocean');
    expect((await as(TOM).get(`/api/chat/conversations/${id}`)).body.data.appearance.theme).toBe('ocean');
    const page = await as(TOM).get(`/api/chat/conversations/${id}/messages`);
    expect(page.body.data.messages[0]).toMatchObject({ kind: 'system', body: 'Irja changed the theme to Ocean' });
  });

  it('accepts the newer themes and names them in the thread', async () => {
    const id = await conversationInG1();

    const res = await as(TOM).put(`/api/chat/conversations/${id}/appearance`).send({ theme: 'midnight' });

    expect(res.body.data.theme).toBe('midnight');
    const page = await as(IRJA).get(`/api/chat/conversations/${id}/messages`);
    expect(page.body.data.messages[0]).toMatchObject({ kind: 'system', body: 'Tom changed the theme to Midnight' });
  });

  it('refuses a theme that does not exist', async () => {
    const id = await conversationInG1();
    const res = await as(TOM).put(`/api/chat/conversations/${id}/appearance`).send({ theme: 'neon' });
    expect(res.status).toBe(400);
  });

  it('uses a photo from the conversation as the background, with a signed URL', async () => {
    const id = await conversationInG1();
    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), attachments: [photo(id)] });

    const res = await as(TOM).put(`/api/chat/conversations/${id}/appearance`).send({ backgroundFileId: photo(id).fileId });

    expect(res.body.data).toMatchObject({
      backgroundFileId: photo(id).fileId,
      backgroundUrl: `https://files.test/d/${photo(id).fileId}`
    });
  });

  it('refuses a background that is not a photo sent in this conversation', async () => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .put(`/api/chat/conversations/${id}/appearance`)
      .send({ backgroundFileId: 'album/g9/someone-else/original.jpg' });

    expect(res.status).toBe(400);
  });

  it('drops the background when the photo behind it is unsent', async () => {
    const id = await conversationInG1();
    const sent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), attachments: [photo(id)] });
    await as(TOM).put(`/api/chat/conversations/${id}/appearance`).send({ backgroundFileId: photo(id).fileId });

    await as(TOM).delete(`/api/chat/conversations/${id}/messages/${sent.body.data.id}`);

    const res = await as(TOM).get(`/api/chat/conversations/${id}`);
    expect(res.body.data.appearance.backgroundFileId).toBeNull();
  });

  it('keeps someone outside the group out of it', async () => {
    const id = await conversationInG1();
    const res = await as(PERSIK).put(`/api/chat/conversations/${id}/appearance`).send({ theme: 'ocean' });
    expect(res.status).toBe(404);
  });
});

describe('ICE servers for calls', () => {
  it('answers a signed-in person with STUN, and says there is no relay, when TURN is not set up', async () => {
    delete process.env.CLOUDFLARE_TURN_KEY_ID;
    delete process.env.CLOUDFLARE_TURN_API_TOKEN;

    const res = await as(TOM).get('/api/chat/calls/ice-servers');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data).toEqual({
      iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
      relay: false,
      expiresAt: null
    });
  });

  it('refuses someone who is not signed in', async () => {
    const res = await request(app).get('/api/chat/calls/ice-servers');
    expect(res.status).toBe(401);
  });
});

describe('calls', () => {
  const TOM_PHONE = { deviceId: 'tom-phone-1' };
  const IRJA_PHONE = { deviceId: 'irja-phone-1' };
  const IRJA_LAPTOP = { deviceId: 'irja-laptop-1' };

  /** A conversation both have opened, so each is on its roster. */
  async function twoPersonConversation(): Promise<string> {
    const id = await conversationInG1();
    await as(IRJA).get(`/api/chat/conversations/${id}`);
    return id;
  }

  async function ringing(): Promise<{ conversationId: string; callId: string }> {
    const conversationId = await twoPersonConversation();
    const res = await as(TOM).post(`/api/chat/conversations/${conversationId}/calls`).send(TOM_PHONE);
    expect(res.status).toBe(201);
    return { conversationId, callId: res.body.data.id as string };
  }

  async function answered(): Promise<{ conversationId: string; callId: string }> {
    const call = await ringing();
    expect((await as(IRJA).post(`/api/chat/calls/${call.callId}/accept`).send(IRJA_PHONE)).status).toBe(200);
    return call;
  }

  const lastLine = async (conversationId: string) =>
    (await as(TOM).get(`/api/chat/conversations/${conversationId}/messages`)).body.data.messages[0];

  it('rings the other person, who finds it on opening the app', async () => {
    const { callId } = await ringing();

    const res = await as(IRJA).get('/api/chat/calls/current');

    expect(res.body.data).toMatchObject({
      id: callId,
      status: 'ringing',
      caller: { userId: 'u-tom', name: 'Tom' },
      callees: [{ userId: 'u-irja', name: 'Irja' }],
      callerDeviceId: 'tom-phone-1'
    });
  });

  it('refuses a call with nobody else in the conversation yet', async () => {
    const id = await conversationInG1();
    const res = await as(TOM).post(`/api/chat/conversations/${id}/calls`).send(TOM_PHONE);
    expect(res.status).toBe(400);
  });

  it('answers on one device, and tells a second device it was answered elsewhere', async () => {
    const { callId } = await ringing();

    const first = await as(IRJA).post(`/api/chat/calls/${callId}/accept`).send(IRJA_PHONE);
    const second = await as(IRJA).post(`/api/chat/calls/${callId}/accept`).send(IRJA_LAPTOP);

    expect(first.body.data).toMatchObject({ status: 'active', answeredBy: 'u-irja', answeredDeviceId: 'irja-phone-1' });
    expect(second.status).toBe(409);
    expect(second.body.message).toBe('Answered on another device');
  });

  it('does not let the caller answer their own call', async () => {
    const { callId } = await ringing();
    const res = await as(TOM).post(`/api/chat/calls/${callId}/accept`).send(TOM_PHONE);
    expect(res.status).toBe(400);
  });

  it('says busy to a second call while one is going', async () => {
    const { conversationId } = await answered();
    const res = await as(IRJA).post(`/api/chat/conversations/${conversationId}/calls`).send(IRJA_PHONE);
    expect(res.status).toBe(409);
  });

  it('relays signals between the two devices in the call and nobody else', async () => {
    const { callId } = await answered();
    const offer = { description: { type: 'offer', sdp: 'v=0' } };

    const fromCaller = await as(TOM).post(`/api/chat/calls/${callId}/signal`).send({ ...TOM_PHONE, data: offer });
    const fromCallee = await as(IRJA)
      .post(`/api/chat/calls/${callId}/signal`)
      .send({ ...IRJA_PHONE, data: { candidate: { candidate: 'candidate:1 1 udp 1 1.2.3.4 5 typ host', sdpMid: '0' } } });
    const otherDevice = await as(IRJA).post(`/api/chat/calls/${callId}/signal`).send({ ...IRJA_LAPTOP, data: offer });
    const outsider = await as(PERSIK).post(`/api/chat/calls/${callId}/signal`).send({ deviceId: 'persik-1', data: offer });

    expect(fromCaller.status).toBe(204);
    expect(fromCallee.status).toBe(204);
    expect(otherDevice.status).toBe(409);
    expect(outsider.status).toBe(404);
  });

  it('refuses a signal with nothing in it', async () => {
    const { callId } = await answered();
    const res = await as(TOM).post(`/api/chat/calls/${callId}/signal`).send({ ...TOM_PHONE, data: {} });
    expect(res.status).toBe(400);
  });

  it('refuses signals before the call is answered', async () => {
    const { callId } = await ringing();
    const res = await as(TOM)
      .post(`/api/chat/calls/${callId}/signal`)
      .send({ ...TOM_PHONE, data: { description: { type: 'offer', sdp: 'v=0' } } });
    expect(res.status).toBe(409);
  });

  it('hangs up, writes how long it lasted into the thread, and frees both people', async () => {
    const { conversationId, callId } = await answered();

    const res = await as(IRJA).post(`/api/chat/calls/${callId}/end`);

    expect(res.body.data).toMatchObject({ status: 'ended', endReason: 'hangup' });
    expect(await lastLine(conversationId)).toMatchObject({ kind: 'system', body: 'Call, 0 sec' });
    expect((await as(TOM).get('/api/chat/calls/current')).body.data).toBeNull();
    expect((await as(TOM).post(`/api/chat/conversations/${conversationId}/calls`).send(TOM_PHONE)).status).toBe(201);
  });

  it('ends once, however many times it is ended', async () => {
    const { conversationId, callId } = await answered();

    await as(IRJA).post(`/api/chat/calls/${callId}/end`);
    const again = await as(TOM).post(`/api/chat/calls/${callId}/end`);

    expect(again.body.data.endReason).toBe('hangup');
    const page = await as(TOM).get(`/api/chat/conversations/${conversationId}/messages`);
    expect(page.body.data.messages.filter((m: { body: string }) => m.body.startsWith('Call,'))).toHaveLength(1);
  });

  it('counts a call the caller gave up on as missed', async () => {
    const { conversationId, callId } = await ringing();

    const res = await as(TOM).post(`/api/chat/calls/${callId}/end`);

    expect(res.body.data.endReason).toBe('cancelled');
    expect(await lastLine(conversationId)).toMatchObject({ body: 'Missed call from Tom' });
  });

  it('declines', async () => {
    const { callId } = await ringing();
    const res = await as(IRJA).post(`/api/chat/calls/${callId}/decline`);
    expect(res.body.data).toMatchObject({ status: 'ended', endReason: 'declined' });
  });

  it('stops ringing after the timeout, even with the timer lost to a restart', async () => {
    const { conversationId, callId } = await ringing();
    resetCallTimers();

    await sweepCalls(Date.now() + RING_TIMEOUT_MS + 10_000);

    expect((await Call.findById(callId))!.endReason).toBe('missed');
    expect(await lastLine(conversationId)).toMatchObject({ body: 'Missed call from Tom' });
  });

  it('ends an answered call when one side has been gone past the grace period', async () => {
    const { callId } = await answered();
    const now = Date.now();

    // Nobody in this test holds a stream, so both sides look gone.
    await sweepCalls(now);
    expect((await Call.findById(callId))!.status).toBe('active');

    await sweepCalls(now + DROP_GRACE_MS);
    expect((await Call.findById(callId))!.endReason).toBe('dropped');
  });

  it('lets only one of two people calling each other at the same moment ring', async () => {
    const conversationId = await twoPersonConversation();

    const [fromTom, fromIrja] = await Promise.all([
      as(TOM).post(`/api/chat/conversations/${conversationId}/calls`).send(TOM_PHONE),
      as(IRJA).post(`/api/chat/conversations/${conversationId}/calls`).send(IRJA_PHONE)
    ]);

    expect([fromTom.status, fromIrja.status].sort()).toEqual([201, 409]);
    expect(await Call.countDocuments({ status: 'ringing' })).toBe(1);
  });

  it('keeps a call whose two tabs are still connected, however the people are', async () => {
    const { callId } = await answered();
    const fakeStream = () => ({ send: () => true }) as unknown as import('@tumbaland/backend-core').SseStream;
    subscribe('u-tom', ['g1'], fakeStream(), 'tom-phone-1');
    subscribe('u-irja', ['g1'], fakeStream(), 'irja-phone-1');
    const now = Date.now();

    await sweepCalls(now);
    await sweepCalls(now + DROP_GRACE_MS);

    expect((await Call.findById(callId))!.status).toBe('active');
  });

  it('drops a call when the phone on it is gone, even with the same person on a laptop', async () => {
    const { callId } = await answered();
    const fakeStream = () => ({ send: () => true }) as unknown as import('@tumbaland/backend-core').SseStream;
    subscribe('u-tom', ['g1'], fakeStream(), 'tom-phone-1');
    // Irja's phone took the call and went away; her laptop is still open.
    subscribe('u-irja', ['g1'], fakeStream(), 'irja-laptop-1');
    const now = Date.now();

    await sweepCalls(now);
    await sweepCalls(now + DROP_GRACE_MS);

    expect((await Call.findById(callId))!.endReason).toBe('dropped');
  });

  it('keeps someone outside the group out of it entirely', async () => {
    const { conversationId, callId } = await ringing();

    expect((await as(PERSIK).post(`/api/chat/conversations/${conversationId}/calls`).send({ deviceId: 'persik-1' })).status).toBe(404);
    expect((await as(PERSIK).post(`/api/chat/calls/${callId}/accept`).send({ deviceId: 'persik-1' })).status).toBe(404);
    expect((await as(PERSIK).post(`/api/chat/calls/${callId}/end`)).status).toBe(404);
    expect((await as(PERSIK).get('/api/chat/calls/current')).body.data).toBeNull();
  });
});
