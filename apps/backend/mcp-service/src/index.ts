import dotenv from 'dotenv';
dotenv.config();

import { connectDB, logger, registerShutdown } from '@tumbaland/backend-core';
import app from './app';

const PORT = Number(process.env.MCP_SERVICE_PORT || 5007);

/**
 * MongoDB is needed for one thing only: verifying the API key a request
 * arrives with. Every read and write goes over HTTP to the owning service, so
 * this process holds no domain data of its own.
 */
async function start(): Promise<void> {
  await connectDB();

  const server = app.listen(PORT, () => {
    logger.info(`mcp-service listening on ${PORT}`);
  });

  registerShutdown({ server, serviceName: 'mcp-service' });
}

start().catch((error) => {
  logger.error('mcp-service failed to start', { error: (error as Error)?.message });
  process.exit(1);
});
