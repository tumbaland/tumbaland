import os from 'os';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';

import app from '../app';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { ReadState } from '../models/ReadState';
import { Presence } from '../models/Presence';
import { Call } from '../models/Call';
import { resetCallTimers } from '../services/callService';
import { clearPresence } from '../services/presenceService';
import { clearSubscribers } from '../services/streamHub';

/**
 * The whole chain: a signed request, the real middleware stack, real
 * controllers, real models, a real database.
 *
 * The parts of chat that break are the joins, not the pieces. Access control is
 * spread across a token claim, a denormalised member list and a group id;
 * idempotent send depends on a unique index existing rather than on any code in
 * this repo; unread counts depend on a read cursor written by a different
 * route. None of that is provable with mocks.
 *
 * A suite sets the service's environment at the top of its file, registers the
 * mocks from ./mocks, and calls `setupChatIntegration()` once.
 */

export const TOM = { id: 'u-tom', email: 'tom@example.com', name: 'Tom', groups: ['g1'] };
export const IRJA = { id: 'u-irja', email: 'irja@example.com', name: 'Irja', groups: ['g1'] };
/** In a different group entirely: the person who must never see any of it. */
export const PERSIK = { id: 'u-persik', email: 'persik@example.com', name: 'Persik', groups: ['g9'] };

const tokenFor = (user: typeof TOM) => jwt.sign(user, 'test-secret', { expiresIn: '1h' });

let testNumber = 0;
let clientAddress = '10.0.0.1';

/** A request as `user`, from this test's own address. */
export const as = (user: typeof TOM) => {
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

/** A conversation in g1, which Tom and Irja are both in. */
export async function conversationInG1(): Promise<string> {
  const res = await as(TOM).post('/api/chat/conversations').send({ groupId: 'g1' });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

let counter = 0;
export const clientId = () => `client-${Date.now()}-${counter++}`;

/** The database and the per-test housekeeping every chat integration suite needs. */
export function setupChatIntegration(): void {
  let mongo: MongoMemoryServer;

  /**
   * Each test arrives from its own address, as separate clients would. The send
   * limiter counts per address, and the suite as a whole sends far more than one
   * person would in five minutes.
   */
  beforeEach(() => {
    testNumber++;
    clientAddress = `10.0.${Math.floor(testNumber / 250)}.${(testNumber % 250) + 1}`;
  });

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
}
