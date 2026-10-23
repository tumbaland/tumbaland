/**
 * Integration tests against a real MongoDB, not mocks.
 *
 * The whole value of this plugin is that it sees what actually changed, and a
 * mocked Mongoose cannot tell you that: hooks that never fire, a `findOneAndUpdate`
 * that returns whatever the mock was told to, a diff computed against a fixture
 * rather than a document. Every bug worth catching here — a hook on the wrong
 * event, an update whose before-image was read after the write, a delete whose
 * snapshot came back empty — passes a mocked test and fails a real one.
 */
import os from 'os';
import mongoose, { Schema } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../logging/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), http: jest.fn() }
}));

import { AuditEvent } from './AuditEvent';
import { auditPlugin } from './plugin';
import { withAuditContext } from './context';
import type { Actor } from './actor';

let mongo: MongoMemoryServer;
let auditCreate: jest.SpiedFunction<typeof AuditEvent.create>;

interface INote {
  title: string;
  hours?: number;
  secret?: string;
  createdBy?: string;
  updatedBy?: string;
}

const NoteSchema = new Schema<INote>(
  { title: String, hours: Number, secret: String },
  { timestamps: true }
);
NoteSchema.plugin(auditPlugin, { resource: 'note', redact: ['secret'] });
const Note = mongoose.model<INote>('AuditTestNote', NoteSchema);

const CLAUDE: Actor = {
  kind: 'assistant',
  userId: 'u1',
  label: 'Claude',
  credentialId: 'client-1',
  tenant: 'g1'
};

/**
 * A Mongoose query builds lazily and only runs when it is awaited, so the await
 * has to happen *inside* the context. Awaiting outside it — which reads
 * identically at the call site — starts the query with no actor in scope and
 * silently records nothing.
 */
const asClaude = <T>(fn: () => Promise<T>): Promise<T> =>
  withAuditContext({ actor: CLAUDE, service: 'test-service' }, async () => await fn());

const asPerson = <T>(fn: () => Promise<T>): Promise<T> =>
  withAuditContext(
    { actor: { kind: 'person', userId: 'u1', label: 'Tom', tenant: 'g1' }, service: 'test-service' },
    async () => await fn()
  );

/** Await the real background writes, including intentional recording failures. */
const settle = async () => {
  await Promise.allSettled(
    auditCreate.mock.results.filter((result) => result.type === 'return').map((result) => result.value)
  );
};

const events = () => AuditEvent.find().sort({ _id: 1 }).lean();

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  // The driver loads `os` with a dynamic import, which Jest's sandbox refuses, so it is handed over.
  await mongoose.connect(mongo.getUri(), { runtimeAdapters: { os } });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([Note.deleteMany({}), AuditEvent.deleteMany({})]);
  auditCreate = jest.spyOn(AuditEvent, 'create');
});

afterEach(async () => {
  // Drain writes before the next test clears the collection, so an event from
  // this request cannot land in the next test's otherwise empty audit trail.
  await settle();
  auditCreate.mockRestore();
});

describe('attribution on the record', () => {
  it('stamps who created it and who last touched it', async () => {
    const note = await asClaude(() => new Note({ title: 'Dinner' }).save());

    expect(note.createdBy).toBe('Claude');
    expect(note.updatedBy).toBe('Claude');
  });

  it('leaves createdBy alone on a later edit, and moves updatedBy', async () => {
    const note = await asClaude(() => new Note({ title: 'Dinner' }).save());

    await asPerson(() => Note.findOneAndUpdate({ _id: note._id }, { title: 'Late dinner' }, { new: true }));

    const after = await Note.findById(note._id);
    expect(after?.createdBy).toBe('Claude');
    expect(after?.updatedBy).toBe('Tom');
  });

  it('writes nothing at all outside a request', async () => {
    // A backfill script is not a person, and a row claiming it was would be
    // worse than no row.
    const note = await new Note({ title: 'From a migration' }).save();
    await settle();

    expect(note.createdBy).toBeUndefined();
    expect(auditCreate).not.toHaveBeenCalled();
    expect(await events()).toHaveLength(0);
  });
});

describe('the trail', () => {
  it('records a save of an existing document as an update, not a second create', async () => {
    // Anything that loads a document, changes a field and saves it — revoking
    // an API key, counting a reveal — would otherwise appear as the thing being
    // created again, with a fresh snapshot and no sign of what changed.
    const note = await asClaude(() => new Note({ title: 'Dinner', hours: 3 }).save());

    await asClaude(async () => {
      const loaded = await Note.findById(note._id);
      loaded!.hours = 2;
      return loaded!.save();
    });
    await settle();

    const actions = (await events()).map((e) => e.action);
    expect(actions).toEqual(['create', 'update']);

    const update = (await events()).find((e) => e.action === 'update');
    expect(update?.changes).toEqual({ hours: { from: 3, to: 2 } });
    expect(update?.snapshot).toBeUndefined();
  });

  it('records nothing when a save changed nothing', async () => {
    const note = await asClaude(() => new Note({ title: 'Dinner' }).save());

    await asClaude(async () => {
      const loaded = await Note.findById(note._id);
      return loaded!.save();
    });
    await settle();

    expect((await events()).filter((e) => e.action === 'update')).toHaveLength(0);
  });

  it('records a create with the document that was written', async () => {
    await asClaude(() => new Note({ title: 'Dinner', hours: 2 }).save());
    await settle();

    const [event] = await events();
    expect(event).toMatchObject({
      action: 'create',
      resource: 'note',
      actorKind: 'assistant',
      actorLabel: 'Claude',
      actorCredentialId: 'client-1',
      tenant: 'g1',
      service: 'test-service'
    });
    expect(event.snapshot).toMatchObject({ title: 'Dinner', hours: 2 });
  });

  it('records an update as before and after, field by field', async () => {
    const note = await asClaude(() => new Note({ title: 'Dinner', hours: 3 }).save());
    await asClaude(() => Note.findOneAndUpdate({ _id: note._id }, { hours: 2 }, { new: true }));
    await settle();

    const update = (await events()).find((e) => e.action === 'update');
    // The point of the whole exercise: "Claude edited an entry" is barely worth
    // storing; "Claude changed hours from 3 to 2" is what someone came to see.
    expect(update?.changes).toEqual({ hours: { from: 3, to: 2 } });
  });

  it('never persists its own before-image into the document', async () => {
    // The obvious way to stash state on a query is `query.set()`, and that
    // writes into the update payload — so the before-image would be saved onto
    // the very document it was taken of, growing a copy of each record inside
    // itself on every edit.
    const note = await asClaude(() => new Note({ title: 'Dinner', hours: 3 }).save());
    await asClaude(() => Note.findOneAndUpdate({ _id: note._id }, { hours: 2 }, { new: true }));

    const raw = await mongoose.connection.db!.collection('audittestnotes').findOne({ _id: note._id });
    expect(Object.keys(raw!).filter((key) => key.startsWith('__audit'))).toEqual([]);
  });

  it('records nothing for an update that changed nothing', async () => {
    const note = await asClaude(() => new Note({ title: 'Dinner', hours: 3 }).save());
    await asClaude(() => Note.findOneAndUpdate({ _id: note._id }, { hours: 3 }, { new: true }));
    await settle();

    expect((await events()).filter((e) => e.action === 'update')).toHaveLength(0);
  });

  it('reports only the fields the update touched', async () => {
    const note = await asClaude(() => new Note({ title: 'Dinner', hours: 3 }).save());
    await asClaude(() => Note.findOneAndUpdate({ _id: note._id }, { hours: 2 }, { new: true }));
    await settle();

    const update = (await events()).find((e) => e.action === 'update');
    expect(Object.keys(update!.changes!)).toEqual(['hours']);
  });

  it('keeps what a delete removed, since nothing else does', async () => {
    const note = await asClaude(() => new Note({ title: 'Dinner', hours: 2 }).save());
    await asClaude(() => Note.findOneAndDelete({ _id: note._id }));
    await settle();

    const deleted = (await events()).find((e) => e.action === 'delete');
    expect(deleted?.snapshot).toMatchObject({ title: 'Dinner', hours: 2 });
    expect(deleted?.resourceId).toBe(String(note._id));
  });

  it('records a bulk delete one row per document', async () => {
    // A day's save deletes the entries it replaces, and "the editor removed
    // three things" is exactly what someone would come here to find.
    await asClaude(async () => {
      await new Note({ title: 'One' }).save();
      await new Note({ title: 'Two' }).save();
      await Note.deleteMany({});
    });
    await settle();

    const deletes = (await events()).filter((e) => e.action === 'delete');
    expect(deletes).toHaveLength(2);
    expect(deletes.map((d) => (d.snapshot as { title: string }).title).sort()).toEqual(['One', 'Two']);
  });

  it('leaves redacted fields out of what it keeps', async () => {
    await asClaude(() => new Note({ title: 'Dinner', secret: 'do not store' }).save());
    await settle();

    const [event] = await events();
    expect(JSON.stringify(event)).not.toContain('do not store');
  });

  it('omits bookkeeping fields nobody would want to read', async () => {
    await asClaude(() => new Note({ title: 'Dinner' }).save());
    await settle();

    const [event] = await events();
    expect(Object.keys(event.snapshot!)).not.toContain('updatedAt');
    expect(Object.keys(event.snapshot!)).not.toContain('__v');
  });
});

describe('recording never breaks the thing it records', () => {
  it('still saves the document when the trail cannot be written', async () => {
    auditCreate.mockRejectedValue(new Error('audit db down'));

    const note = await asClaude(() => new Note({ title: 'Dinner' }).save());
    await settle();

    // Losing a row of history is a cost worth paying; losing the entry someone
    // was logging is not.
    expect(await Note.findById(note._id)).not.toBeNull();
  });
});
