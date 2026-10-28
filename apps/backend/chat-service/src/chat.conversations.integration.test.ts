process.env.SERVICE_NAME = 'chat-service';
process.env.JWT_SECRET = 'test-secret';
process.env.INTERNAL_SERVICE_TOKEN = 'internal-test-token';

/**
 * Conversations: creating, finding, who can see them, who is online and how they look.
 *
 * Through the real middleware, controllers, models and a real database; see
 * test/integration.ts. What it talks to in file-service and album-service is
 * replaced, from test/mocks.ts.
 */
jest.mock('./services/fileServiceClient', () => jest.requireActual('./test/mocks').fileServiceClientMock);
jest.mock('./services/albumClient', () => jest.requireActual('./test/mocks').albumClientMock);
jest.mock('./services/storageUsage', () => jest.requireActual('./test/mocks').storageUsageMock);

import request from 'supertest';
import { as, TOM, IRJA, PERSIK, conversationInG1, clientId, setupChatIntegration } from './test/integration';
import app from './app';
import { Conversation } from './models/Conversation';
import { Message } from './models/Message';
import { ReadState } from './models/ReadState';
import { Presence } from './models/Presence';
import { clearPresence } from './services/presenceService';

setupChatIntegration();

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
