import dotenv from 'dotenv';

dotenv.config();

import { connectDB, logger, registerShutdown, requireEnv } from '@tumbaland/backend-core';
import app from './app';
import { closeAll } from './services/streamHub';
import { startPresenceSweep } from './services/presenceService';
import { startCallSweep } from './services/callService';

// Fail fast if the JWT secret is missing — auth must never run with a default
requireEnv('JWT_SECRET');

const PORT = process.env.PORT || 4004;

// Connect before binding the port: a service that can't reach MongoDB has
// nothing to serve, and listening anyway would pass the health check while
// failing every request. Exiting hands recovery to the container restart policy.
const start = async (): Promise<void> => {
  await connectDB('chat-service');

  const server = app.listen(PORT, () => logger.info('Chat service started successfully', { port: PORT }));

  // Node caps a single request at `requestTimeout` (five minutes by default)
  // and destroys the socket when it is exceeded. An SSE stream is one request
  // held open for hours, so left at the default every client is disconnected
  // every five minutes. The per-user stream cap and the heartbeat are what
  // bound this instead.
  server.requestTimeout = 0;

  // Graceful shutdown (SIGINT + SIGTERM: end the streams, drain HTTP, close the
  // DB). `closeAll` runs first because `server.close()` waits for in-flight
  // responses, and an SSE response never completes on its own.
  const stopPresence = startPresenceSweep();
  const stopCalls = startCallSweep();
  registerShutdown({
    serviceName: 'chat-service',
    server,
    onShutdown: () => {
      stopPresence();
      stopCalls();
      closeAll();
    }
  });
};

start().catch((error: Error) => {
  logger.error('Failed to start chat-service', { error: error.message, stack: error.stack });
  process.exit(1);
});
