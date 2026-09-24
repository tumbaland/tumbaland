import type { Server } from 'http';
import logger from '../logging/logger';
import { disconnectDB } from '../database/connection';
import { closeAllSseStreams } from '../sse/sseStream';

export interface RegisterShutdownOptions {
  /** Service name, used for log context and the DB disconnect. */
  serviceName: string;
  /** The HTTP server returned by `app.listen(...)`, closed before the DB. */
  server?: Server;
  /**
   * Whether to close the MongoDB connection on shutdown. Defaults to `true`;
   * set `false` for services that never call `connectDB` (e.g. file, public).
   */
  disconnectDatabase?: boolean;
  /** Optional extra cleanup run before the server/DB are closed. */
  onShutdown?: () => Promise<void> | void;
  /**
   * Force `process.exit` after this many ms if a graceful close hangs, so a
   * stuck connection can't block a container rollout. Defaults to 10s.
   */
  forceExitAfterMs?: number;
}

/**
 * Registers `SIGINT` and `SIGTERM` handlers that drain the service before the
 * process exits: end any open event streams, run the optional cleanup hook,
 * stop accepting new HTTP connections, then close the MongoDB connection.
 * `SIGTERM` matters most — it's the signal Docker/Kubernetes send on stop and rollout, and without a
 * handler the process is force-killed with its DB connection still open.
 *
 * The handler is idempotent (a second signal while shutting down is ignored)
 * and self-arms a force-exit timer so a hung close still terminates.
 */
export const registerShutdown = ({
  serviceName,
  server,
  disconnectDatabase = true,
  onShutdown,
  forceExitAfterMs = 10_000
}: RegisterShutdownOptions): void => {
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info('Received shutdown signal, closing gracefully', { service: serviceName, signal });

    const forceExit = setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit', { service: serviceName });
      process.exit(1);
    }, forceExitAfterMs);
    // Don't let the timer itself keep the event loop alive.
    forceExit.unref?.();

    try {
      // An event stream never finishes by itself, and server.close() waits for it.
      closeAllSseStreams();
      if (onShutdown) await onShutdown();

      if (server) {
        await new Promise<void>((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
        });
      }

      if (disconnectDatabase) await disconnectDB(serviceName);

      clearTimeout(forceExit);
      process.exit(0);
    } catch (error) {
      clearTimeout(forceExit);
      logger.error('Error during graceful shutdown', {
        service: serviceName,
        error: (error as Error)?.message
      });
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
};
