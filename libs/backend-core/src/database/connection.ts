import mongoose, { ConnectOptions } from 'mongoose';
import logger from '../logging/logger';

let connected = false;
/**
 * Set while a connection attempt is in flight so concurrent callers await that
 * attempt instead of opening a second one against the same mongoose singleton.
 */
let pending: Promise<void> | null = null;
let listenersRegistered = false;

/**
 * How the pool behaves toward a database that is across the internet.
 *
 * The driver's defaults assume a database next door: it opens connections when
 * a request needs one and keeps them until something closes them. From a home
 * connection to Atlas that goes wrong in two ways. A connection costs a TCP, TLS
 * and authentication handshake over the internet, which a request that arrives
 * when the pool is empty pays in full. And a router quietly forgets a connection
 * that has sat idle for a few minutes, so the next request is handed one that is
 * dead and waits on it until the operating system gives up. Both read as a
 * random multi-second stall on the first request after a quiet spell.
 *
 *  - `minPoolSize` keeps a couple of connections open and warm.
 *  - `maxIdleTimeMS` retires one that has sat idle for a minute, well inside a
 *    router's memory, and the pool opens a fresh one in its place.
 *
 * Both can be set per deployment, for a database that is somewhere else.
 */
export function poolOptions(env: NodeJS.ProcessEnv = process.env): ConnectOptions {
  const number = (value: string | undefined, fallback: number) =>
    value !== undefined && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : fallback;

  return {
    minPoolSize: number(env.MONGODB_MIN_POOL_SIZE, 2),
    maxIdleTimeMS: number(env.MONGODB_MAX_IDLE_MS, 60_000)
  };
}

/**
 * Connects once and throws on failure. There is deliberately no retry loop here.
 *
 * MongoDB is Atlas (`mongodb+srv://`), not a sidecar container, so there is no
 * boot race to ride out — and the driver already retries for us: `connect()`
 * keeps doing server selection for `serverSelectionTimeoutMS` (30s by default)
 * before it rejects, so a transient DNS or network blip is absorbed there.
 * Anything that survives that is a real fault — bad credentials, an IP missing
 * from the Atlas allowlist, a dead cluster — and no amount of retrying fixes it.
 *
 * Callers exit non-zero when this throws, which hands the problem to the
 * container restart policy (`restart: unless-stopped`) that already supervises
 * every service. One supervisor, and a service that can't reach its database
 * shows up as a restarting container instead of a healthy one serving errors.
 */
export const connectDB = async (serviceName?: string, uri?: string): Promise<void> => {
  if (connected) return;
  if (pending) return pending;

  const mongoUri = uri || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  pending = connectOnce(mongoUri, serviceName).finally(() => {
    pending = null;
  });

  return pending;
};

async function connectOnce(mongoUri: string, serviceName: string | undefined): Promise<void> {
  try {
    await mongoose.connect(mongoUri, poolOptions());
    connected = true;

    registerConnectionListeners(serviceName);
    logger.info('MongoDB connected', { service: serviceName });
    await logRoundTrip(serviceName);
  } catch (error) {
    logger.error('Failed to connect to MongoDB', {
      service: serviceName,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * How long one round trip to the database takes from here, once, at start.
 *
 * Every query is at least one of these, and a request makes several, so it is the
 * number that explains whether a slow request was slow because of the database's
 * distance or because of something else. Best effort: it never fails a start.
 */
async function logRoundTrip(serviceName?: string): Promise<void> {
  try {
    const db = mongoose.connection.db;
    if (!db) return;
    const started = performance.now();
    await db.admin().ping();
    logger.info('MongoDB round trip', { service: serviceName, ms: Math.round(performance.now() - started) });
  } catch {
    // A start is not worth failing for a measurement.
  }
}

/**
 * Mongoose reconnects on its own once an initial connection has succeeded, so
 * these only report state — but without them a drop is silent and the only
 * symptom is the health endpoint flipping to "disconnected".
 */
function registerConnectionListeners(serviceName?: string): void {
  if (listenersRegistered) return;
  listenersRegistered = true;

  mongoose.connection.on('error', (err: Error) => {
    logger.error('MongoDB connection error', { service: serviceName, error: err.message });
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected', { service: serviceName });
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected', { service: serviceName });
  });
}

export const disconnectDB = async (serviceName?: string): Promise<void> => {
  try {
    await mongoose.connection.close();
    connected = false;
    logger.info('MongoDB connection closed', { service: serviceName });
  } catch (error) {
    logger.error('Error closing MongoDB connection', { service: serviceName, error: (error as Error).message });
    throw error;
  }
};
