import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { logger, registerShutdown } from '@tumbaland/backend-core';
import app from './app';

const PORT = process.env.PORT || 5003;

// Start the server
const server = app.listen(PORT, () =>
  logger.info('Public service started successfully', { port: PORT })
);

// Graceful shutdown (SIGINT + SIGTERM). No DB connection to close.
registerShutdown({ serviceName: 'public-service', server, disconnectDatabase: false });
