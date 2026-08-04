jest.mock('../logging/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), http: jest.fn() }
}));

const connectionHandlers: Record<string, (...args: any[]) => void> = {};

jest.mock('mongoose', () => ({
  __esModule: true,
  default: {
    connect: jest.fn(),
    connection: {
      on: jest.fn((event: string, handler: (...args: any[]) => void) => {
        connectionHandlers[event] = handler;
      }),
      close: jest.fn()
    }
  }
}));

import mongoose from 'mongoose';
import logger from '../logging/logger';
import { disconnectDB } from './connection';

/**
 * `connection.ts` keeps module-level `connected`/`pending` flags, so each
 * connectDB scenario needs its own fresh copy of the module —
 * isolateModulesAsync sandboxes that without leaking into other tests in this
 * file the way a blanket jest.resetModules() would.
 *
 * Note that this does NOT re-create the mongoose/logger mocks: a jest.mock
 * factory result is shared across isolated registries, so the objects returned
 * here are the same instances every time. Resetting their implementations is
 * beforeEach's job — see the comment there.
 */
async function freshConnectDB() {
  let connectDBFn!: typeof import('./connection').connectDB;
  let mongooseMock!: typeof mongoose;
  let loggerMock!: typeof logger;

  await jest.isolateModulesAsync(async () => {
    mongooseMock = (await import('mongoose')).default as unknown as typeof mongoose;
    loggerMock = (await import('../logging/logger')).default as unknown as typeof logger;
    connectDBFn = (await import('./connection')).connectDB;
  });

  return { connectDB: connectDBFn, mongoose: mongooseMock, logger: loggerMock };
}

describe('connectDB', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.MONGODB_URI;
    for (const key of Object.keys(connectionHandlers)) delete connectionHandlers[key];

    // `clearMocks: true` only clears recorded calls, not implementations, so a
    // mockRejectedValue set by one test stays installed for every test after
    // it. Reset connect explicitly — but not connection.on, whose factory
    // implementation is what records into connectionHandlers.
    (mongoose.connect as jest.Mock).mockReset();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('throws when no MongoDB URI is available', async () => {
    const { connectDB } = await freshConnectDB();
    await expect(connectDB('my-service')).rejects.toThrow('MONGODB_URI environment variable is not set');
  });

  it('connects using the explicit uri argument over the env var', async () => {
    process.env.MONGODB_URI = 'mongodb://env-uri';
    const { connectDB, mongoose, logger } = await freshConnectDB();

    await connectDB('my-service', 'mongodb://explicit-uri');

    expect(mongoose.connect).toHaveBeenCalledWith('mongodb://explicit-uri');
    expect(logger.info).toHaveBeenCalledWith('MongoDB connected', { service: 'my-service' });
  });

  it('falls back to MONGODB_URI when no explicit uri is given', async () => {
    process.env.MONGODB_URI = 'mongodb://env-uri';
    const { connectDB, mongoose } = await freshConnectDB();

    await connectDB('my-service');

    expect(mongoose.connect).toHaveBeenCalledWith('mongodb://env-uri');
  });

  it('is a no-op on a second call once already connected', async () => {
    process.env.MONGODB_URI = 'mongodb://env-uri';
    const { connectDB, mongoose } = await freshConnectDB();

    await connectDB('my-service');
    await connectDB('my-service');

    expect(mongoose.connect).toHaveBeenCalledTimes(1);
  });

  it('logs and rethrows when mongoose.connect fails', async () => {
    process.env.MONGODB_URI = 'mongodb://env-uri';
    const { connectDB, mongoose, logger } = await freshConnectDB();
    (mongoose.connect as jest.Mock).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(connectDB('my-service')).rejects.toThrow('ECONNREFUSED');
    expect(logger.error).toHaveBeenCalledWith('Failed to connect to MongoDB', {
      service: 'my-service',
      error: 'ECONNREFUSED'
    });
  });

  /**
   * The driver retries internally for serverSelectionTimeoutMS; anything that
   * reaches us is a real fault, so one failure is one rejection. Callers exit
   * non-zero and the container restart policy takes it from there.
   */
  it('does not retry a failed connection', async () => {
    process.env.MONGODB_URI = 'mongodb://env-uri';
    const { connectDB, mongoose } = await freshConnectDB();
    (mongoose.connect as jest.Mock).mockRejectedValue(new Error('auth failed'));

    await expect(connectDB('my-service')).rejects.toThrow('auth failed');

    expect(mongoose.connect).toHaveBeenCalledTimes(1);
  });

  it('clears the in-flight promise so a later call can retry', async () => {
    process.env.MONGODB_URI = 'mongodb://env-uri';
    const { connectDB, mongoose } = await freshConnectDB();
    (mongoose.connect as jest.Mock).mockRejectedValueOnce(new Error('not ready'));

    await expect(connectDB('my-service')).rejects.toThrow('not ready');
    await connectDB('my-service');

    expect(mongoose.connect).toHaveBeenCalledTimes(2);
  });

  it('lets concurrent callers share one connection attempt', async () => {
    process.env.MONGODB_URI = 'mongodb://env-uri';
    const { connectDB, mongoose } = await freshConnectDB();

    await Promise.all([connectDB('my-service'), connectDB('my-service')]);

    expect(mongoose.connect).toHaveBeenCalledTimes(1);
  });

  it('registers error/disconnected/reconnected handlers that log through the shared logger', async () => {
    process.env.MONGODB_URI = 'mongodb://env-uri';
    const { connectDB, logger } = await freshConnectDB();

    await connectDB('my-service');

    connectionHandlers.error(new Error('boom'));
    expect(logger.error).toHaveBeenCalledWith('MongoDB connection error', { service: 'my-service', error: 'boom' });

    connectionHandlers.disconnected();
    expect(logger.warn).toHaveBeenCalledWith('MongoDB disconnected', { service: 'my-service' });

    connectionHandlers.reconnected();
    expect(logger.info).toHaveBeenCalledWith('MongoDB reconnected', { service: 'my-service' });
  });
});

describe('disconnectDB', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('closes the connection and logs success', async () => {
    await disconnectDB('my-service');

    expect(mongoose.connection.close).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('MongoDB connection closed', { service: 'my-service' });
  });

  it('logs and rethrows when closing fails', async () => {
    (mongoose.connection.close as jest.Mock).mockRejectedValueOnce(new Error('close failed'));

    await expect(disconnectDB('my-service')).rejects.toThrow('close failed');
    expect(logger.error).toHaveBeenCalledWith('Error closing MongoDB connection', {
      service: 'my-service',
      error: 'close failed'
    });
  });
});
