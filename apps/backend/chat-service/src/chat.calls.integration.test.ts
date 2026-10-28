process.env.SERVICE_NAME = 'chat-service';
process.env.JWT_SECRET = 'test-secret';
process.env.INTERNAL_SERVICE_TOKEN = 'internal-test-token';

/**
 * Calls: ICE servers, ringing, answering, dropping and sweeping.
 *
 * Through the real middleware, controllers, models and a real database; see
 * test/integration.ts. What it talks to in file-service and album-service is
 * replaced, from test/mocks.ts.
 */
jest.mock('./services/fileServiceClient', () => jest.requireActual('./test/mocks').fileServiceClientMock);
jest.mock('./services/albumClient', () => jest.requireActual('./test/mocks').albumClientMock);
jest.mock('./services/storageUsage', () => jest.requireActual('./test/mocks').storageUsageMock);

import request from 'supertest';
import { as, TOM, IRJA, PERSIK, conversationInG1, setupChatIntegration } from './test/integration';
import app from './app';
import { Call } from './models/Call';
import { DROP_GRACE_MS, RING_TIMEOUT_MS, resetCallTimers, sweepCalls } from './services/callService';
import { subscribe } from './services/streamHub';

setupChatIntegration();

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
