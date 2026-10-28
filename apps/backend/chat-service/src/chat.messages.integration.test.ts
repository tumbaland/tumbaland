process.env.SERVICE_NAME = 'chat-service';
process.env.JWT_SECRET = 'test-secret';
process.env.INTERNAL_SERVICE_TOKEN = 'internal-test-token';

/**
 * Messages: sending, editing, reacting, replying, searching.
 *
 * Through the real middleware, controllers, models and a real database; see
 * test/integration.ts. What it talks to in file-service and album-service is
 * replaced, from test/mocks.ts.
 */
jest.mock('./services/fileServiceClient', () => jest.requireActual('./test/mocks').fileServiceClientMock);
jest.mock('./services/albumClient', () => jest.requireActual('./test/mocks').albumClientMock);
jest.mock('./services/storageUsage', () => jest.requireActual('./test/mocks').storageUsageMock);

import { as, TOM, IRJA, conversationInG1, clientId, setupChatIntegration } from './test/integration';
import { Message } from './models/Message';

setupChatIntegration();

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

  it('does not skip a message that shares a millisecond with the last one on the page', async () => {
    const id = await conversationInG1();
    const at = new Date('2026-10-01T10:00:00.000Z');
    
    for (let i = 0; i < 5; i++) {
      await Message.create({
        conversationId: id,
        senderEmail: TOM.email,
        senderId: TOM.id,
        senderName: 'Tom',
        kind: 'text',
        body: `same${i}`,
        clientId: clientId(),
        createdAt: at
      });
    }

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const url: string = `/api/chat/conversations/${id}/messages?limit=2${
        cursor ? `&before=${encodeURIComponent(cursor)}` : ''
      }`;
      const res = await as(TOM).get(url);
      seen.push(...res.body.data.messages.map((m: { body: string }) => m.body));
      cursor = res.body.data.nextCursor;
    } while (cursor);

    expect([...seen].sort()).toEqual(['same0', 'same1', 'same2', 'same3', 'same4']);
  });

  it('still accepts a bare timestamp as the cursor', async () => {
    const id = await conversationInG1();
    await as(TOM).post(`/api/chat/conversations/${id}/messages`).send({ clientId: clientId(), body: 'old' });

    const res = await as(TOM).get(
      `/api/chat/conversations/${id}/messages?before=${encodeURIComponent(new Date(Date.now() + 60_000).toISOString())}`
    );

    expect(res.status).toBe(200);
    expect(res.body.data.messages).toHaveLength(1);
  });

  it('refuses a cursor that is neither', async () => {
    const id = await conversationInG1();

    const res = await as(TOM).get(`/api/chat/conversations/${id}/messages?before=nonsense`);

    expect(res.status).toBe(400);
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
