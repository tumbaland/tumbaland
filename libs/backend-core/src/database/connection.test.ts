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
 * `connection.ts` keeps a module-level `connected` flag, so each connectDB
 * scenario needs its own fresh copy of the module (and of its mongoose/logger
 * mocks) — isolateModulesAsync sandboxes that without leaking into other
 * tests in this file the way a blanket jest.resetModules() would.
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

  it('logs and rethrows when mongoose.connect fails on the last allowed attempt', async () => {
    process.env.MONGODB_URI = 'mongodb://env-uri';
    const { connectDB, mongoose, logger } = await freshConnectDB();
    (mongoose.connect as jest.Mock).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(connectDB('my-service', undefined, { maxAttempts: 1 })).rejects.toThrow('ECONNREFUSED');
    expect(logger.error).toHaveBeenCalledWith('Failed to connect to MongoDB, giving up', {
      service: 'my-service',
      attempt: 1,
      error: 'ECONNREFUSED'
    });
  });

  it('retries a failing connection until it succeeds', async () => {
    process.env.MONGODB_URI = 'mongodb://env-uri';
    const { connectDB, mongoose, logger } = await freshConnectDB();
    (mongoose.connect as jest.Mock)
      .mockRejectedValueOnce(new Error('getaddrinfo EAI_AGAIN'))
      .mockRejectedValueOnce(new Error('getaddrinfo EAI_AGAIN'));

    await connectDB('my-service', undefined, { initialDelayMs: 0 });

    expect(mongoose.connect).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith('MongoDB connected', { service: 'my-service' });
  });

  it('gives up after maxAttempts', async () => {
    process.env.MONGODB_URI = 'mongodb://env-uri';
    const { connectDB, mongoose } = await freshConnectDB();
    (mongoose.connect as jest.Mock).mockRejectedValue(new Error('auth failed'));

    await expect(
      connectDB('my-service', undefined, { maxAttempts: 3, initialDelayMs: 0 })
    ).rejects.toThrow('auth failed');

    expect(mongoose.connect).toHaveBeenCalledTimes(3);
  });

  it('caps the backoff delay at maxDelayMs', async () => {
    process.env.MONGODB_URI = 'mongodb://env-uri';
    const { connectDB, mongoose, logger } = await freshConnectDB();
    (mongoose.connect as jest.Mock)
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'));

    await connectDB('my-service', undefined, { initialDelayMs: 1, maxDelayMs: 2 });

    const delays = (logger.warn as jest.Mock).mock.calls.map((call) => call[1].delayMs);
    expect(delays).toEqual([1, 2, 2]);
  });

  it('lets concurrent callers share one retry loop', async () => {
    process.env.MONGODB_URI = 'mongodb://env-uri';
    const { connectDB, mongoose } = await freshConnectDB();
    (mongoose.connect as jest.Mock).mockRejectedValueOnce(new Error('not ready'));

    await Promise.all([
      connectDB('my-service', undefined, { initialDelayMs: 0 }),
      connectDB('my-service', undefined, { initialDelayMs: 0 })
    ]);

    expect(mongoose.connect).toHaveBeenCalledTimes(2);
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
