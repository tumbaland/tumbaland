process.env.SERVICE_NAME = 'chat-service';
process.env.JWT_SECRET = 'test-secret';

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
  // Async, like the real one: the caller chains .catch() on the result.
  deleteFolder: jest.fn(async () => undefined)
}));

const assertHeadroom = jest.fn();
const recordStoredBytes = jest.fn();
const releaseStoredBytes = jest.fn();
jest.mock('./services/storageUsage', () => ({
  assertHeadroom: (...args: unknown[]) => assertHeadroom(...args),
  recordStoredBytes: (...args: unknown[]) => recordStoredBytes(...args),
  releaseStoredBytes: (...args: unknown[]) => releaseStoredBytes(...args)
}));

import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';

import app from './app';
import { Conversation } from './models/Conversation';
import { Message } from './models/Message';
import { ReadState } from './models/ReadState';
import { clearSubscribers } from './services/streamHub';
import { deleteFolder } from './services/fileServiceClient';

let mongo: MongoMemoryServer;

const TOM = { id: 'u-tom', email: 'tom@example.com', name: 'Tom', groups: ['g1'] };
const IRJA = { id: 'u-irja', email: 'irja@example.com', name: 'Irja', groups: ['g1'] };
/** In a different group entirely: the person who must never see any of it. */
const PERSIK = { id: 'u-persik', email: 'persik@example.com', name: 'Persik', groups: ['g9'] };

const tokenFor = (user: typeof TOM) => jwt.sign(user, 'test-secret', { expiresIn: '1h' });

const as = (user: typeof TOM) => ({
  get: (path: string) => request(app).get(path).set('Authorization', `Bearer ${tokenFor(user)}`),
  post: (path: string) => request(app).post(path).set('Authorization', `Bearer ${tokenFor(user)}`),
  patch: (path: string) => request(app).patch(path).set('Authorization', `Bearer ${tokenFor(user)}`),
  put: (path: string) => request(app).put(path).set('Authorization', `Bearer ${tokenFor(user)}`),
  delete: (path: string) => request(app).delete(path).set('Authorization', `Bearer ${tokenFor(user)}`)
});

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  // The unique { conversationId, clientId } index is the idempotency
  // mechanism. Mongoose builds indexes in the background on first use, so the
  // tests below would race it without this.
  await Message.syncIndexes();
  await Conversation.syncIndexes();
  await ReadState.syncIndexes();
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(async () => {
  clearSubscribers();
  jest.clearAllMocks();
  await Promise.all([Conversation.deleteMany({}), Message.deleteMany({}), ReadState.deleteMany({})]);
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

  it('does not count a deleted message', async () => {
    const id = await conversationInG1();
    const sent = await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'oops' });
    await as(TOM).delete(`/api/chat/conversations/${id}/messages/${sent.body.data.id}`);

    expect((await as(IRJA).get('/api/chat/unread')).body.data.unread).toBe(0);
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

  it('describes an attachment-only message rather than showing an empty preview', async () => {
    const id = await conversationInG1();
    await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({
        clientId: clientId(),
        attachments: [{ fileId: 'chat/g1/x/y.jpg', mimetype: 'image/jpeg', sizeBytes: 1000 }]
      });

    const res = await as(IRJA).get('/api/chat/conversations');

    expect(res.body.data[0].lastMessagePreview).toBe('Photo');
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

  it('returns nothing for an empty term rather than the whole history', async () => {
    const id = await conversationInG1();
    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'anything' });

    const res = await as(IRJA).get('/api/chat/search?q=');

    expect(res.body.data).toEqual([]);
  });
});

describe('attachments', () => {
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
    ['application/pdf'],
    ['text/html'],
    ['application/octet-stream']
  ])('refuses %s, so only images and video can reach storage', async (mimetype) => {
    const id = await conversationInG1();

    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/attachments/upload-url`)
      .send({ filename: 'x', mimetype, sizeBytes: 100 });

    expect(res.status).toBe(400);
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

  it('meters the bytes once the message carrying them exists', async () => {
    const id = await conversationInG1();

    await as(TOM)
      .post(`/api/chat/conversations/${id}/messages`)
      .send({
        clientId: clientId(),
        attachments: [{ fileId: `chat/g1/${id}/abc/original.jpg`, mimetype: 'image/jpeg', sizeBytes: 500_000 }]
      });

    expect(recordStoredBytes).toHaveBeenCalledWith('g1', 500_000);
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
