process.env.SERVICE_NAME = 'relationship-service';

/**
 * The whole chain in one place: an authenticated request, the audit middleware,
 * a real controller, a real model, a real database.
 *
 * Every piece below is unit-tested on its own and none of that proves the thing
 * anyone cares about — that a write made through an HTTP request ends up
 * attributed to whoever made it. The parts that break are the joins: middleware
 * mounted in the wrong order, a context that does not survive the controller's
 * awaits, a plugin applied to a model the route does not use.
 */
import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import { AuditEvent, authenticateAgent, beginAudit, countRead } from '@tumbaland/backend-core';

import { Activity } from '../models/Activity';

let mongo: MongoMemoryServer;

const USER = { id: 'u1', email: 'tom@example.com', name: 'Tom' };
const CLAUDE = {
  keyId: 'client-1',
  scopes: [],
  tenants: { allowed: ['g1'], default: 'g1' },
  actingAs: 'g1',
  kind: 'oauth' as const,
  label: 'Claude',
  credentialId: 'client-1'
};

/** An app wired the way the real routers are, with authentication stubbed. */
function appAs(credential?: typeof CLAUDE) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = USER;
    req.userGroups = ['g1'];
    if (credential) req.apiKey = credential;
    next();
  });
  // What `authenticateAgent` does once a credential is verified — exercised
  // directly here so the test drives the production path rather than a
  // parallel one assembled for it.
  app.use(beginAudit);

  app.post('/activities', async (req, res) => {
    const activity = await new Activity({ ...req.body, userId: USER.id, groupId: 'g1' }).save();
    res.status(201).json({ success: true, data: activity });
  });

  app.put('/activities/:id', async (req, res) => {
    const activity = await Activity.findOneAndUpdate({ _id: req.params.id }, req.body, { new: true });
    res.json({ success: true, data: activity });
  });

  app.delete('/activities/:id', async (req, res) => {
    await Activity.findOneAndDelete({ _id: req.params.id });
    res.json({ success: true });
  });

  app.get('/activities', async (_req, res) => {
    const activities = await Activity.find();
    countRead(res, activities.length);
    res.json({ success: true, data: activities });
  });

  return app;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 80));
const trail = () => AuditEvent.find().sort({ _id: 1 }).lean();

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([Activity.deleteMany({}), AuditEvent.deleteMany({})]);
});

describe('a write made by an assistant', () => {
  it('is attributed on the entry and recorded in the trail', async () => {
    const created = await request(appAs(CLAUDE))
      .post('/activities')
      .send({ date: '2026-09-05', typeId: new mongoose.Types.ObjectId(), hours: 2 })
      .expect(201);
    await settle();

    const entry = await Activity.findById(created.body.data._id);
    expect(entry?.createdBy).toBe('Claude');

    const [event] = await trail();
    expect(event).toMatchObject({
      action: 'create',
      resource: 'activity',
      actorKind: 'assistant',
      actorLabel: 'Claude',
      actorCredentialId: 'client-1',
      tenant: 'g1',
      service: process.env.SERVICE_NAME || 'unknown-service'
    });
  });

  it('records an edit as the fields that actually moved', async () => {
    const app = appAs(CLAUDE);
    const created = await request(app)
      .post('/activities')
      .send({ date: '2026-09-05', typeId: new mongoose.Types.ObjectId(), hours: 3 })
      .expect(201);

    await request(app).put(`/activities/${created.body.data._id}`).send({ hours: 2 }).expect(200);
    await settle();

    const update = (await trail()).find((e) => e.action === 'update');
    expect(update?.changes).toEqual({ hours: { from: 3, to: 2 } });
    expect(update?.actorLabel).toBe('Claude');
  });

  it('keeps what a delete removed', async () => {
    const app = appAs(CLAUDE);
    const created = await request(app)
      .post('/activities')
      .send({ date: '2026-09-05', typeId: new mongoose.Types.ObjectId(), description: 'Sushi' })
      .expect(201);

    await request(app).delete(`/activities/${created.body.data._id}`).expect(200);
    await settle();

    const deleted = (await trail()).find((e) => e.action === 'delete');
    expect(deleted?.snapshot).toMatchObject({ description: 'Sushi' });
  });

  it('records how much it read', async () => {
    const app = appAs(CLAUDE);
    await request(app)
      .post('/activities')
      .send({ date: '2026-09-05', typeId: new mongoose.Types.ObjectId() })
      .expect(201);

    await request(app).get('/activities').expect(200);
    await settle();

    const read = (await trail()).find((e) => e.action === 'read');
    expect(read).toMatchObject({ resource: 'activities', actorLabel: 'Claude', count: 1 });
  });
});

describe('a write made by a person', () => {
  it('is attributed to them, and their reading is not recorded', async () => {
    const app = appAs();
    await request(app)
      .post('/activities')
      .send({ date: '2026-09-05', typeId: new mongoose.Types.ObjectId() })
      .expect(201);
    await request(app).get('/activities').expect(200);
    await settle();

    const events = await trail();
    expect(events.map((e) => e.action)).toEqual(['create']);
    expect(events[0]).toMatchObject({ actorKind: 'person', actorLabel: 'Tom' });

    // Reading their own journal is not an event: one dashboard load hits half a
    // dozen endpoints, and logging those buries everything that matters.
    expect(events.filter((e) => e.action === 'read')).toHaveLength(0);
  });

  it('records the tenant they were acting in', async () => {
    await request(appAs())
      .post('/activities?groupId=g1')
      .send({ date: '2026-09-05', typeId: new mongoose.Types.ObjectId() })
      .expect(201);
    await settle();

    const [event] = await trail();
    expect(event.tenant).toBe('g1');
  });
});

describe('a write made outside any request', () => {
  it('is attributed to nobody rather than to the last actor', async () => {
    // Migrations and backfills run through the same models. A row claiming a
    // script was Claude would be worse than no row at all.
    await new Activity({
      date: new Date('2026-09-05'),
      typeId: new mongoose.Types.ObjectId(),
      userId: USER.id
    }).save();
    await settle();

    expect(await trail()).toHaveLength(0);
  });
});

describe('a router that authenticates per route', () => {
  it('still gets an actor, which a separate middleware mount would not', async () => {
    // Album's photos and finance's tickers put `authenticateAgent()` on each
    // route rather than on the router. A router-level audit mount would run
    // before any of them and find nobody, silently leaving exactly those
    // endpoints unattributed — which is why the context is established inside
    // authentication instead.
    process.env.JWT_SECRET = 'test-jwt-secret';
    const token = jwt.sign({ id: 'u1', email: 'tom@example.com', name: 'Tom' }, 'test-jwt-secret');

    const app = express();
    app.use(express.json());
    app.post('/activities', authenticateAgent(), async (req, res) => {
      const activity = await new Activity({ ...req.body, userId: 'u1' }).save();
      res.status(201).json({ success: true, data: activity });
    });

    const created = await request(app)
      .post('/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-09-05', typeId: new mongoose.Types.ObjectId() })
      .expect(201);
    await settle();

    expect((await Activity.findById(created.body.data._id))?.createdBy).toBe('Tom');
    expect((await trail())[0]).toMatchObject({ actorKind: 'person', actorLabel: 'Tom' });
  });
});
