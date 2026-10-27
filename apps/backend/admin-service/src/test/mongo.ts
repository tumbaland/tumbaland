import os from 'os';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AuditEvent, UserDay } from '@tumbaland/backend-core';

let mongod: MongoMemoryServer | undefined;

/**
 * A real MongoDB for the aggregation tests: a mocked pipeline always returns
 * what the test expects, which is exactly what these tests exist not to do.
 */
export async function startDb(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  // The driver loads `os` with a dynamic import, which Jest's sandbox refuses, so it is handed over.
  await mongoose.connect(mongod.getUri(), { runtimeAdapters: { os } });
  await Promise.all([AuditEvent.init(), UserDay.init()]);
  // The trail's rows expire after a year, measured from the real clock. Tests use
  // fixed dates, which would one day be old enough for the TTL monitor to
  // remove mid-run.
  await AuditEvent.collection.dropIndex('at_1');
}

export async function stopDb(): Promise<void> {
  await mongoose.disconnect();
  await mongod?.stop();
}

export async function clearDb(): Promise<void> {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}
