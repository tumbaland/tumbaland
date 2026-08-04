import mongoose from 'mongoose';
import logger from '../logging/logger';

let connected = false;
/**
 * Set while a connection attempt is in flight so concurrent callers await that
 * attempt instead of opening a second one against the same mongoose singleton.
 */
let pending: Promise<void> | null = null;
let listenersRegistered = false;

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
    await mongoose.connect(mongoUri);
    connected = true;

    registerConnectionListeners(serviceName);
    logger.info('MongoDB connected', { service: serviceName });
  } catch (error) {
    logger.error('Failed to connect to MongoDB', {
      service: serviceName,
      error: (error as Error).message
    });
    throw error;
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
