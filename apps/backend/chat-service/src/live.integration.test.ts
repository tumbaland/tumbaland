process.env.SERVICE_NAME = 'chat-service';
process.env.JWT_SECRET = 'test-secret';
process.env.INTERNAL_SERVICE_TOKEN = 'internal-test-token';

/**
 * Sharing where one is, live, through the real routes and a real database:
 * the push to whoever is waiting is the part worth proving end to end.
 */
const sendToUsers = jest.fn(async () => 1);
jest.mock('./services/pushService', () => ({
  ...jest.requireActual('./services/pushService'),
  isPushConfigured: () => true,
  sendToUsers: (...args: unknown[]) => (sendToUsers as jest.Mock)(...args)
}));

import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';

import app from './app';
import { Conversation } from './models/Conversation';
import { LiveLocation, type ILiveLocation } from './models/LiveLocation';
import { SavedPlace } from './models/SavedPlace';
import { clearGeocodeCache } from './services/geocodingService';
import { clearPresence } from './services/presenceService';
import { clearSubscribers, subscribe } from './services/streamHub';
import { distanceM, distanceText, watchShare, updatePosition, startShare } from './services/liveLocationService';

let mongo: MongoMemoryServer;

const TOM = { id: 'u-tom', email: 'tom@example.com', name: 'Tom', groups: ['g1'] };
const IRJA = { id: 'u-irja', email: 'irja@example.com', name: 'Irja', groups: ['g1'] };
const PERSIK = { id: 'u-persik', email: 'persik@example.com', name: 'Persik', groups: ['g9'] };

const tokenFor = (user: typeof TOM) => jwt.sign(user, 'test-secret', { expiresIn: '1h' });

let testNumber = 0;
let clientAddress = '10.1.0.1';
beforeEach(() => {
  testNumber++;
  clientAddress = `10.1.0.${testNumber + 1}`;
});

const as = (user: typeof TOM) => {
  const signed = (test: request.Test) =>
    test.set('Authorization', `Bearer ${tokenFor(user)}`).set('X-Forwarded-For', clientAddress);
  return {
    get: (path: string) => signed(request(app).get(path)),
    post: (path: string) => signed(request(app).post(path)),
    put: (path: string) => signed(request(app).put(path)),
    delete: (path: string) => signed(request(app).delete(path))
  };
};

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Conversation.syncIndexes();
  await LiveLocation.syncIndexes();
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(async () => {
  clearSubscribers();
  clearPresence();
  jest.clearAllMocks();
  clearGeocodeCache();
  await Promise.all([Conversation.deleteMany({}), LiveLocation.deleteMany({}), SavedPlace.deleteMany({})]);
});

/** A conversation both have opened, so both are in its roster. */
async function conversation(): Promise<string> {
  const res = await as(TOM).post('/api/chat/conversations').send({ groupId: 'g1' });
  const id = res.body.data.id as string;
  await as(IRJA).get(`/api/chat/conversations/${id}`);
  return id;
}

// Tallinn's old town, and a point about 1.1 km east of it.
const HOME = { lat: 59.437, lng: 24.7536 };
const NEAR = { lat: 59.437, lng: 24.773 };
const FAR = { lat: 59.33, lng: 24.75 };

/** Lets a position count as new: the service ignores ones closer than two seconds apart. */
const later = async (id: string) =>
  LiveLocation.updateOne(
    { conversationId: id, userId: TOM.id },
    { $set: { 'position.at': new Date(Date.now() - 10_000) } }
  );

describe('sharing where one is, live', () => {
  it('starts, tells the others once, and shows the newest position to them', async () => {
    const id = await conversation();

    const started = await as(TOM).put(`/api/chat/conversations/${id}/live`).send({ minutes: 60 });
    expect(started.status).toBe(200);
    expect(sendToUsers).toHaveBeenCalledWith([IRJA.id], expect.objectContaining({ title: 'Tom' }), expect.anything());

    await as(TOM)
      .post(`/api/chat/conversations/${id}/live/position`)
      .send({ ...FAR, accuracy: 12, heading: 90, speed: 14 });

    const seen = await as(IRJA).get(`/api/chat/conversations/${id}/live`);
    expect(seen.body.data).toHaveLength(1);
    expect(seen.body.data[0]).toMatchObject({
      userId: TOM.id,
      name: 'Tom',
      position: { ...FAR, accuracy: 12, speed: 14 }
    });
  });

  it('runs on rather than starting over when started again, and keeps who is waiting', async () => {
    const id = await conversation();
    await as(TOM).put(`/api/chat/conversations/${id}/live`).send({ minutes: 30 });
    await as(IRJA)
      .put(`/api/chat/conversations/${id}/live/${TOM.id}/watch`)
      .send({ ...HOME, radiusM: 1000 });
    sendToUsers.mockClear();

    const again = await as(TOM).put(`/api/chat/conversations/${id}/live`).send({ minutes: 120 });

    expect(again.body.data.watchers).toHaveLength(1);
    expect(new Date(again.body.data.endsAt).getTime()).toBeGreaterThan(Date.now() + 100 * 60_000);
    expect(sendToUsers).not.toHaveBeenCalled();
  });

  it('tells the one waiting once the sharer is within their distance, and only once', async () => {
    const id = await conversation();
    await as(TOM).put(`/api/chat/conversations/${id}/live`).send({ minutes: 60 });
    await as(TOM).post(`/api/chat/conversations/${id}/live/position`).send(FAR);
    const waiting = await as(IRJA)
      .put(`/api/chat/conversations/${id}/live/${TOM.id}/watch`)
      .send({ ...HOME, radiusM: 2000 });
    expect(waiting.body.data.watchers[0]).toMatchObject({ userId: IRJA.id, radiusM: 2000, notified: false });
    expect(waiting.body.data.watchers[0].distanceM).toBeGreaterThan(10_000);
    sendToUsers.mockClear();

    await later(id);
    const close = await as(TOM).post(`/api/chat/conversations/${id}/live/position`).send(NEAR);
    await later(id);
    await as(TOM).post(`/api/chat/conversations/${id}/live/position`).send(HOME);

    expect(close.body.data.watchers[0]).toMatchObject({ notified: true });
    expect(sendToUsers).toHaveBeenCalledTimes(1);
    expect(sendToUsers).toHaveBeenCalledWith(
      [IRJA.id],
      expect.objectContaining({ title: 'Tom is almost here', body: '1.1 km away' }),
      expect.anything()
    );
  });

  it('never sends the one waiting’s own point to anyone', async () => {
    const id = await conversation();
    await as(TOM).put(`/api/chat/conversations/${id}/live`).send({ minutes: 60 });

    const res = await as(IRJA)
      .put(`/api/chat/conversations/${id}/live/${TOM.id}/watch`)
      .send({ ...HOME, radiusM: 1000 });

    expect(res.body.data.watchers[0]).not.toHaveProperty('lat');
    expect(JSON.stringify(res.body.data)).not.toContain(String(HOME.lng));
  });

  it('counts someone already close as told, rather than buzzing them', async () => {
    const id = await conversation();
    await as(TOM).put(`/api/chat/conversations/${id}/live`).send({ minutes: 60 });
    await as(TOM).post(`/api/chat/conversations/${id}/live/position`).send(NEAR);
    sendToUsers.mockClear();

    const res = await as(IRJA)
      .put(`/api/chat/conversations/${id}/live/${TOM.id}/watch`)
      .send({ ...HOME, radiusM: 2000 });

    expect(res.body.data.watchers[0].notified).toBe(true);
    expect(sendToUsers).not.toHaveBeenCalled();
  });

  it('can stop waiting', async () => {
    const id = await conversation();
    await as(TOM).put(`/api/chat/conversations/${id}/live`).send({ minutes: 60 });
    await as(IRJA)
      .put(`/api/chat/conversations/${id}/live/${TOM.id}/watch`)
      .send({ ...HOME, radiusM: 1000 });

    const res = await as(IRJA).delete(`/api/chat/conversations/${id}/live/${TOM.id}/watch`);

    expect(res.body.data.watchers).toEqual([]);
  });

  it('keeps nothing once stopped, and says so on the stream', async () => {
    const id = await conversation();
    const sent: string[] = [];
    subscribe(IRJA.id, ['g1'], {
      send: (chunk: string) => sent.push(chunk) > 0
    } as unknown as import('@tumbaland/backend-core').SseStream);
    await as(TOM).put(`/api/chat/conversations/${id}/live`).send({ minutes: 60 });

    const res = await as(TOM).delete(`/api/chat/conversations/${id}/live`);

    expect(res.status).toBe(204);
    expect(await LiveLocation.countDocuments()).toBe(0);
    expect(sent.join('')).toContain('event: live.updated');
    expect(sent.join('')).toContain('event: live.ended');
  });

  it('runs until stopped when no time is given, four hours at most', async () => {
    const id = await conversation();

    const res = await as(TOM).put(`/api/chat/conversations/${id}/live`).send({});

    expect(res.status).toBe(200);
    const left = new Date(res.body.data.endsAt).getTime() - Date.now();
    expect(left).toBeGreaterThan(239 * 60_000);
    expect(left).toBeLessThanOrEqual(240 * 60_000);
  });

  it('shows where the sharer is heading, and how far off it is', async () => {
    const id = await conversation();
    await as(TOM).put(`/api/chat/conversations/${id}/live`).send({ destination: HOME });

    await as(TOM).post(`/api/chat/conversations/${id}/live/position`).send(NEAR);

    const seen = await as(IRJA).get(`/api/chat/conversations/${id}/live`);
    expect(seen.body.data[0].destination).toMatchObject(HOME);
    expect(seen.body.data[0].destination.distanceM).toBeGreaterThan(1050);
    expect(seen.body.data[0].destination.distanceM).toBeLessThan(1150);
  });

  it('keeps the destination when carried on without one, and takes it away on null', async () => {
    const id = await conversation();
    await as(TOM).put(`/api/chat/conversations/${id}/live`).send({ destination: HOME });

    const kept = await as(TOM).put(`/api/chat/conversations/${id}/live`).send({});
    const cleared = await as(TOM).put(`/api/chat/conversations/${id}/live`).send({ destination: null });

    expect(kept.body.data.destination).toMatchObject(HOME);
    expect(cleared.body.data.destination).toBeNull();
  });

  it('shares a pin, says so to the others, and keeps it a pin when carried on', async () => {
    const id = await conversation();

    const pinned = await as(TOM).put(`/api/chat/conversations/${id}/live`).send({ fixed: true });
    const carried = await as(TOM).put(`/api/chat/conversations/${id}/live`).send({});

    expect(pinned.body.data.fixed).toBe(true);
    expect(carried.body.data.fixed).toBe(true);
    expect(sendToUsers).toHaveBeenCalledWith(
      [IRJA.id],
      expect.objectContaining({ body: expect.stringContaining('pin') }),
      expect.anything()
    );
  });

  it('refuses a position from someone not sharing', async () => {
    const id = await conversation();
    const res = await as(TOM).post(`/api/chat/conversations/${id}/live/position`).send(HOME);
    expect(res.status).toBe(404);
  });

  it('refuses a position off the map and a share longer than four hours', async () => {
    const id = await conversation();
    expect((await as(TOM).put(`/api/chat/conversations/${id}/live`).send({ minutes: 600 })).status).toBe(400);
    await as(TOM).put(`/api/chat/conversations/${id}/live`).send({ minutes: 60 });
    expect((await as(TOM).post(`/api/chat/conversations/${id}/live/position`).send({ lat: 95, lng: 0 })).status).toBe(
      400
    );
  });

  it('shows none of it to someone outside the group', async () => {
    const id = await conversation();
    await as(TOM).put(`/api/chat/conversations/${id}/live`).send({ minutes: 60 });

    const res = await as(PERSIK).get(`/api/chat/conversations/${id}/live`);

    expect(res.status).toBe(404);
  });

  it('keeps both watchers when their requests save the same version concurrently', async () => {
    const id = await conversation();
    await as(TOM).put(`/api/chat/conversations/${id}/live`).send({});
    const doc = (await Conversation.findById(id))!;
    const originalSave = LiveLocation.prototype.save;
    let unblock!: () => void;
    const barrier = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    let writes = 0;
    const saveSpy = jest.spyOn(LiveLocation.prototype, 'save').mockImplementation(async function (this: ILiveLocation) {
      const write = ++writes;
      if (write === 2) unblock();
      if (write <= 2) await barrier;
      return originalSave.call(this);
    });
    try {
      await Promise.all([
        watchShare(IRJA, doc, TOM.id, { ...HOME, radiusM: 1000 }),
        watchShare({ ...IRJA, id: 'u-waiter-2' }, doc, TOM.id, { ...FAR, radiusM: 2000 })
      ]);
      const saved = (await LiveLocation.findOne({ conversationId: id, userId: TOM.id }))!;
      expect(saved.watchers.map((watcher) => watcher.userId).sort()).toEqual(['u-irja', 'u-waiter-2']);
    } finally {
      saveSpy.mockRestore();
    }
  });

  it('sends one arrival notification for concurrent position updates', async () => {
    const id = await conversation();
    await as(TOM).put(`/api/chat/conversations/${id}/live`).send({});
    const doc = (await Conversation.findById(id))!;
    await watchShare(IRJA, doc, TOM.id, { ...HOME, radiusM: 2000 });
    sendToUsers.mockClear();
    await Promise.all([updatePosition(TOM, doc, NEAR), updatePosition(TOM, doc, NEAR)]);
    expect(sendToUsers).toHaveBeenCalledTimes(1);
    expect((await LiveLocation.findOne({ conversationId: id }))!.watchers[0]!.notifiedAt).not.toBeNull();
  });

  it('announces only one start when two tabs start sharing together', async () => {
    const id = await conversation();
    const doc = (await Conversation.findById(id))!;
    sendToUsers.mockClear();
    await Promise.all([startShare(TOM, doc), startShare(TOM, doc)]);
    expect(await LiveLocation.countDocuments({ conversationId: id, userId: TOM.id })).toBe(1);
    expect(sendToUsers).toHaveBeenCalledTimes(1);
  });

  it('leaves the chat request budget available while uploading positions', async () => {
    const id = await conversation();
    await as(TOM).put(`/api/chat/conversations/${id}/live`).send({});
    // Creation + start + 117 other requests leave one of the 120 slots available.
    for (let batch = 0; batch < 9; batch++)
      await Promise.all(Array.from({ length: 13 }, () => as(TOM).get('/api/unknown-route')));
    for (let update = 0; update < 30; update++)
      expect((await as(TOM).post(`/api/chat/conversations/${id}/live/position`).send(HOME)).status).toBe(200);
    expect((await as(TOM).get(`/api/chat/conversations/${id}/live`)).status).toBe(200);
  });
});

describe('distances', () => {
  it('measures along the surface of the Earth', () => {
    expect(distanceM(HOME, NEAR)).toBeGreaterThan(1050);
    expect(distanceM(HOME, NEAR)).toBeLessThan(1150);
  });

  it('words a distance as a person would', () => {
    expect(distanceText(20)).toBe('50 m');
    expect(distanceText(870)).toBe('850 m');
    expect(distanceText(3240)).toBe('3.2 km');
    expect(distanceText(14_600)).toBe('15 km');
  });
});

describe('labels on a share', () => {
  it('carries what the destination and the pin are, for the one waiting', async () => {
    const id = await conversation();
    await as(TOM)
      .put(`/api/chat/conversations/${id}/live`)
      .send({ fixed: true, pinLabel: 'Kaupmehe 7', destination: { ...HOME, label: 'Home' } });

    const seen = await as(IRJA).get(`/api/chat/conversations/${id}/live`);

    expect(seen.body.data[0]).toMatchObject({ pinLabel: 'Kaupmehe 7', destination: { label: 'Home' } });
  });
});

describe('saved places', () => {
  it('keeps a place for the whole group, by name', async () => {
    const id = await conversation();
    const saved = await as(TOM)
      .post(`/api/chat/conversations/${id}/places`)
      .send({ name: ' Home ', ...HOME, address: 'Kaupmehe 7' });
    await as(IRJA)
      .post(`/api/chat/conversations/${id}/places`)
      .send({ name: 'Gym', ...NEAR });

    const list = await as(IRJA).get(`/api/chat/conversations/${id}/places`);

    expect(saved.status).toBe(201);
    expect(list.body.data.map((place: { name: string }) => place.name)).toEqual(['Gym', 'Home']);
    expect(list.body.data[1]).toMatchObject({ ...HOME, address: 'Kaupmehe 7' });
  });

  it('lets either person delete one', async () => {
    const id = await conversation();
    const saved = await as(TOM)
      .post(`/api/chat/conversations/${id}/places`)
      .send({ name: 'Home', ...HOME });

    const res = await as(IRJA).delete(`/api/chat/conversations/${id}/places/${saved.body.data.id}`);

    expect(res.status).toBe(204);
    expect(await SavedPlace.countDocuments()).toBe(0);
    expect((await as(IRJA).delete(`/api/chat/conversations/${id}/places/${saved.body.data.id}`)).status).toBe(404);
    expect((await as(IRJA).delete(`/api/chat/conversations/${id}/places/not-an-id`)).status).toBe(404);
  });

  it('refuses a place with no name, and more than the group can keep', async () => {
    const id = await conversation();
    expect(
      (
        await as(TOM)
          .post(`/api/chat/conversations/${id}/places`)
          .send({ name: '  ', ...HOME })
      ).status
    ).toBe(400);

    await SavedPlace.insertMany(
      Array.from({ length: 50 }, (_, index) => ({ groupId: 'g1', name: `Place ${index}`, ...HOME, createdBy: TOM.id }))
    );
    const res = await as(TOM)
      .post(`/api/chat/conversations/${id}/places`)
      .send({ name: 'One more', ...HOME });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/50 places/);
  });

  it('shows none of them to someone outside the group', async () => {
    const id = await conversation();
    await as(TOM)
      .post(`/api/chat/conversations/${id}/places`)
      .send({ name: 'Home', ...HOME });

    expect((await as(PERSIK).get(`/api/chat/conversations/${id}/places`)).status).toBe(404);
  });
});

describe('looking places up', () => {
  const photon = (features: unknown[], ok = true) =>
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok, status: ok ? 200 : 503, json: async () => ({ features }) } as Response);
  const feature = (lng: number, lat: number, properties: Record<string, string>) => ({
    geometry: { coordinates: [lng, lat] },
    properties
  });

  afterEach(() => jest.restoreAllMocks());

  it('finds places by name near where the person is, as a name and an address line', async () => {
    const fetchMock = photon([
      feature(24.7536, 59.437, { name: 'Raekoja plats', district: 'Kesklinn', city: 'Tallinn', country: 'Estonia' }),
      feature(24.76, 59.43, { street: 'Viru', housenumber: '4', city: 'Tallinn', country: 'Estonia' }),
      { geometry: {}, properties: { name: 'No point' } }
    ]);

    const res = await as(TOM).get('/api/chat/places/search?q=raekoja&lat=59.4371&lng=24.7536');

    expect(res.body.data).toEqual([
      { name: 'Raekoja plats', detail: 'Kesklinn, Tallinn, Estonia', lat: 59.437, lng: 24.7536 },
      { name: 'Viru 4', detail: 'Tallinn, Estonia', lat: 59.43, lng: 24.76 }
    ]);
    const asked = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(asked.searchParams.get('q')).toBe('raekoja');
    // Only the town is said of where the person is.
    expect(asked.searchParams.get('lat')).toBe('59.44');
  });

  it('asks the geocoder once for the same search', async () => {
    const fetchMock = photon([feature(24.75, 59.43, { name: 'Kalev Spa' })]);

    await as(TOM).get('/api/chat/places/search?q=kalev');
    await as(TOM).get('/api/chat/places/search?q=Kalev');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives the address at a point, keeping the point where it was put', async () => {
    photon([feature(24.7601, 59.4302, { street: 'Viru', housenumber: '4', city: 'Tallinn' })]);

    const res = await as(TOM).get('/api/chat/places/reverse?lat=59.43&lng=24.76');

    expect(res.body.data).toEqual({ name: 'Viru 4', detail: 'Tallinn', lat: 59.43, lng: 24.76 });
  });

  it('answers with nothing rather than an error when the geocoder is down', async () => {
    photon([], false);
    expect((await as(TOM).get('/api/chat/places/search?q=anything')).body.data).toEqual([]);
    expect((await as(TOM).get('/api/chat/places/reverse?lat=59&lng=24')).body.data).toBeNull();

    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('timeout'));
    clearGeocodeCache();
    expect((await as(TOM).get('/api/chat/places/reverse?lat=59&lng=24')).body.data).toBeNull();
  });

  it('refuses a search too short to mean anything, and a point off the map', async () => {
    expect((await as(TOM).get('/api/chat/places/search?q=a')).status).toBe(400);
    expect((await as(TOM).get('/api/chat/places/reverse?lat=95&lng=24')).status).toBe(400);
  });
});
