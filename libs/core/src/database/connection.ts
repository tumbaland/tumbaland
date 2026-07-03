import mongoose from 'mongoose';
import logger from '../logging/logger';

let connected = false;

export const connectDB = async (serviceName?: string, uri?: string): Promise<void> => {
  if (connected) return;

  const mongoUri = uri || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  try {
    await mongoose.connect(mongoUri);
    connected = true;

    logger.info('MongoDB connected', { service: serviceName });

    mongoose.connection.on('error', (err: Error) => {
      logger.error('MongoDB connection error', { service: serviceName, error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected', { service: serviceName });
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected', { service: serviceName });
    });
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { service: serviceName, error: (error as Error).message });
    throw error;
  }
};

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
