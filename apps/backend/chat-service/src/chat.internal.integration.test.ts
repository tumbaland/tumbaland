process.env.SERVICE_NAME = 'chat-service';
process.env.JWT_SECRET = 'test-secret';
process.env.INTERNAL_SERVICE_TOKEN = 'internal-test-token';

/**
 * The routes other services call: Album, and the plan reminders.
 *
 * Through the real middleware, controllers, models and a real database; see
 * test/integration.ts. What it talks to in file-service and album-service is
 * replaced, from test/mocks.ts.
 */
jest.mock('./services/fileServiceClient', () => jest.requireActual('./test/mocks').fileServiceClientMock);
jest.mock('./services/albumClient', () => jest.requireActual('./test/mocks').albumClientMock);
jest.mock('./services/storageUsage', () => jest.requireActual('./test/mocks').storageUsageMock);

import request from 'supertest';
import { as, TOM, IRJA, conversationInG1, setupChatIntegration } from './test/integration';
import app from './app';

setupChatIntegration();

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
