import mongoose from 'mongoose';
import logger from '../logging/logger';

export interface ConnectDBOptions {
  /**
   * How many times to try before giving up. Defaults to Infinity: a service that
   * boots before the host's network is up must keep trying, not die once.
   */
  maxAttempts?: number;
  /** Backoff delay for the first retry. Doubles per attempt up to maxDelayMs. */
  initialDelayMs?: number;
  /** Ceiling for the backoff delay. */
  maxDelayMs?: number;
}

const DEFAULT_INITIAL_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30000;

let connected = false;
/**
 * Set while a retry loop is running so concurrent callers await that loop
 * instead of starting a second one against the same mongoose singleton.
 */
let pending: Promise<void> | null = null;
let listenersRegistered = false;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const connectDB = async (
  serviceName?: string,
  uri?: string,
  options: ConnectDBOptions = {}
): Promise<void> => {
  if (connected) return;
  if (pending) return pending;

  const mongoUri = uri || process.env.MONGODB_URI;
  // A missing URI is a config error, not a transient one — retrying can never
  // fix it, so fail immediately rather than looping forever on a typo.
  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  pending = connectWithRetry(mongoUri, serviceName, options).finally(() => {
    pending = null;
  });

  return pending;
};

async function connectWithRetry(
  mongoUri: string,
  serviceName: string | undefined,
  options: ConnectDBOptions
): Promise<void> {
  const maxAttempts = options.maxAttempts ?? Infinity;
  const initialDelayMs = options.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

  for (let attempt = 1; ; attempt++) {
    try {
      await mongoose.connect(mongoUri);
      connected = true;

      registerConnectionListeners(serviceName);
      logger.info('MongoDB connected', { service: serviceName });
      return;
    } catch (error) {
      const message = (error as Error).message;

      if (attempt >= maxAttempts) {
        logger.error('Failed to connect to MongoDB, giving up', {
          service: serviceName,
          attempt,
          error: message
        });
        throw error;
      }

      // Exponential backoff, capped: a Mongo outage lasting hours shouldn't
      // grow the gap past maxDelayMs and leave the service down long after
      // the database comes back.
      const delayMs = Math.min(initialDelayMs * 2 ** (attempt - 1), maxDelayMs);
      logger.warn('Failed to connect to MongoDB, retrying', {
        service: serviceName,
        attempt,
        delayMs,
        error: message
      });
      await sleep(delayMs);
    }
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
